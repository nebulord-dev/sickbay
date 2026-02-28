import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer, fileExists } from '../utils/file-helpers.js';

/**
 * AssetSizeRunner scans common asset directories for images, SVGs, and fonts, and checks their file sizes against defined thresholds.
 * It reports individual files that exceed size limits, as well as the total asset size for the project.
 * The runner provides actionable feedback on optimizing large assets to improve web performance.
 */

const ASSET_DIRS = ['public', 'src/assets', 'static', 'assets'];

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico']);
const SVG_EXTENSION = '.svg';
const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
// Video/audio are intentionally large — skip them
const SKIP_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mp3', '.wav', '.flac', '.avi', '.mov']);

// Thresholds in bytes
const IMAGE_WARN = 500 * 1024;    // 500KB
const IMAGE_CRITICAL = 2 * 1024 * 1024; // 2MB
const SVG_WARN = 100 * 1024;      // 100KB
const FONT_WARN = 500 * 1024;     // 500KB
const TOTAL_WARN = 5 * 1024 * 1024;    // 5MB
const TOTAL_CRITICAL = 10 * 1024 * 1024; // 10MB

interface AssetFile {
  path: string;
  size: number;
  type: 'image' | 'svg' | 'font' | 'other';
}

export class AssetSizeRunner extends BaseRunner {
  name = 'asset-size';
  category = 'performance' as const;
  applicableRuntimes = ['browser'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const assets: AssetFile[] = [];

      for (const dir of ASSET_DIRS) {
        if (fileExists(projectPath, dir)) {
          scanAssets(join(projectPath, dir), projectPath, assets);
        }
      }

      const issues: Issue[] = [];
      let totalSize = 0;

      for (const asset of assets) {
        totalSize += asset.size;
        const sizeKB = Math.round(asset.size / 1024);
        const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);

        if (asset.type === 'image') {
          if (asset.size > IMAGE_CRITICAL) {
            issues.push({
              severity: 'critical',
              message: `${asset.path} — ${sizeMB}MB image (exceeds 2MB)`,
              file: asset.path,
              fix: { description: 'Compress with tools like squoosh.app, tinypng.com, or convert to WebP/AVIF format' },
              reportedBy: ['asset-size'],
            });
          } else if (asset.size > IMAGE_WARN) {
            issues.push({
              severity: 'warning',
              message: `${asset.path} — ${sizeKB}KB image (exceeds 500KB)`,
              file: asset.path,
              fix: { description: 'Compress or convert to a more efficient format (WebP, AVIF)' },
              reportedBy: ['asset-size'],
            });
          }
        } else if (asset.type === 'svg') {
          if (asset.size > SVG_WARN) {
            issues.push({
              severity: 'warning',
              message: `${asset.path} — ${sizeKB}KB SVG (exceeds 100KB, likely unoptimized)`,
              file: asset.path,
              fix: { description: 'Optimize with SVGO or svgomg.net — remove metadata, simplify paths' },
              reportedBy: ['asset-size'],
            });
          }
        } else if (asset.type === 'font') {
          if (asset.size > FONT_WARN) {
            issues.push({
              severity: 'warning',
              message: `${asset.path} — ${sizeKB}KB font (exceeds 500KB)`,
              file: asset.path,
              fix: { description: 'Subset the font to include only needed characters, or use WOFF2 format' },
              reportedBy: ['asset-size'],
            });
          }
        }
      }

      // Check total asset size
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      if (totalSize > TOTAL_CRITICAL) {
        issues.push({
          severity: 'critical',
          message: `Total asset size is ${totalMB}MB — exceeds 10MB threshold`,
          fix: { description: 'Review and optimize all static assets to reduce total payload' },
          reportedBy: ['asset-size'],
        });
      } else if (totalSize > TOTAL_WARN) {
        issues.push({
          severity: 'warning',
          message: `Total asset size is ${totalMB}MB — consider optimizing`,
          fix: { description: 'Compress images, subset fonts, and remove unused assets' },
          reportedBy: ['asset-size'],
        });
      }

      const criticalCount = issues.filter((i) => i.severity === 'critical').length;
      const warningCount = issues.filter((i) => i.severity === 'warning').length;
      const score = Math.max(20, 100 - criticalCount * 20 - warningCount * 8);

      return {
        id: 'asset-size',
        category: this.category,
        name: 'Asset Sizes',
        score,
        status: criticalCount > 0 ? 'fail' : warningCount > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['asset-size'],
        duration: elapsed(),
        metadata: {
          totalAssets: assets.length,
          totalSizeBytes: totalSize,
          totalSizeMB: totalMB,
          images: assets.filter((a) => a.type === 'image').length,
          svgs: assets.filter((a) => a.type === 'svg').length,
          fonts: assets.filter((a) => a.type === 'font').length,
        },
      };
    } catch (err) {
      return {
        id: 'asset-size',
        category: this.category,
        name: 'Asset Sizes',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `Asset size check failed: ${err}`, reportedBy: ['asset-size'] }],
        toolsUsed: ['asset-size'],
        duration: elapsed(),
      };
    }
  }
}

function scanAssets(dir: string, projectRoot: string, assets: AssetFile[]): void {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanAssets(fullPath, projectRoot, assets);
      } else {
        const ext = extname(entry).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) continue;

        let type: AssetFile['type'] = 'other';
        if (IMAGE_EXTENSIONS.has(ext)) type = 'image';
        else if (ext === SVG_EXTENSION) type = 'svg';
        else if (FONT_EXTENSIONS.has(ext)) type = 'font';
        else continue; // Only track known asset types

        assets.push({
          path: fullPath.replace(projectRoot + '/', ''),
          size: stat.size,
          type,
        });
      }
    }
  } catch { /* directory doesn't exist or unreadable */ }
}
