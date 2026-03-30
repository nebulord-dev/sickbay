import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { HealthPanel } from './HealthPanel.js';

import type { CheckResult } from '@nebulord/sickbay-core';

const createCheck = (
  overrides: Partial<CheckResult> & { id: string; name: string },
): CheckResult => ({
  id: overrides.id,
  name: overrides.name,
  category: overrides.category ?? 'dependencies',
  score: overrides.score ?? 80,
  status: overrides.status ?? 'pass',
  issues: overrides.issues ?? [],
  toolsUsed: overrides.toolsUsed ?? ['test'],
  duration: overrides.duration ?? 100,
});

const makeProgress = (name: string, status: 'pending' | 'running' | 'done') => ({ name, status });

describe('HealthPanel', () => {
  describe('scanning with no checks yet', () => {
    it('shows progress items when scanning with no results', () => {
      const progress = [
        makeProgress('eslint', 'done'),
        makeProgress('npm-audit', 'running'),
        makeProgress('knip', 'pending'),
      ];
      const { lastFrame } = render(
        <HealthPanel
          checks={[]}
          isScanning={true}
          progress={progress}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('eslint');
      expect(output).toContain('npm-audit');
      expect(output).toContain('knip');
    });

    it('shows done icon for completed progress items', () => {
      const progress = [makeProgress('eslint', 'done')];
      const { lastFrame } = render(
        <HealthPanel
          checks={[]}
          isScanning={true}
          progress={progress}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // Done status shows ✓
      expect(lastFrame()).toContain('✓');
    });

    it('shows running icon for in-progress items', () => {
      const progress = [makeProgress('npm-audit', 'running')];
      const { lastFrame } = render(
        <HealthPanel
          checks={[]}
          isScanning={true}
          progress={progress}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // Running status shows ◌
      expect(lastFrame()).toContain('◌');
    });

    it('shows pending icon for not-yet-started items', () => {
      const progress = [makeProgress('knip', 'pending')];
      const { lastFrame } = render(
        <HealthPanel
          checks={[]}
          isScanning={true}
          progress={progress}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // Pending status shows ○
      expect(lastFrame()).toContain('○');
    });
  });

  describe('empty state when not scanning', () => {
    it('shows empty state message when no checks and not scanning', () => {
      const { lastFrame } = render(
        <HealthPanel
          checks={[]}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).toContain('No results yet. Press [r] to scan.');
    });
  });

  describe('displaying checks', () => {
    it('shows check name', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint' })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).toContain('ESLint');
    });

    it('shows pass icon for passing checks', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint', status: 'pass' })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // pass → ✓
      expect(lastFrame()).toContain('✓');
    });

    it('shows fail icon for failing checks', () => {
      const checks = [createCheck({ id: 'audit', name: 'npm-audit', status: 'fail', score: 20 })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // fail → ✗
      expect(lastFrame()).toContain('✗');
    });

    it('shows warning icon for warning checks', () => {
      const checks = [createCheck({ id: 'knip', name: 'Knip', status: 'warning', score: 65 })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // warning → ⚠
      expect(lastFrame()).toContain('⚠');
    });

    it('shows score bar for each check', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint', score: 80 })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      // Score bar uses block characters
      expect(lastFrame()).toContain('█');
    });

    it('shows numeric score for each check', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint', score: 73 })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).toContain('73');
    });
  });

  describe('scroll indicators', () => {
    it("shows 'more above' indicator when scrollOffset > 0", () => {
      const checks = Array.from({ length: 5 }, (_, i) =>
        createCheck({ id: `check-${i}`, name: `Check ${i}` }),
      );
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={2}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).toContain('more above');
    });

    it("does not show 'more above' when scrollOffset is 0", () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint' })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).not.toContain('more above');
    });

    it("shows 'more below' indicator when checks exceed availableHeight", () => {
      const checks = Array.from({ length: 10 }, (_, i) =>
        createCheck({ id: `check-${i}`, name: `Check ${i}` }),
      );
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={3}
        />,
      );
      expect(lastFrame()).toContain('more below');
    });

    it("does not show 'more below' when all checks fit", () => {
      const checks = Array.from({ length: 3 }, (_, i) =>
        createCheck({ id: `check-${i}`, name: `Check ${i}` }),
      );
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).not.toContain('more below');
    });
  });

  describe('re-scanning state', () => {
    it('shows Re-scanning indicator when isScanning=true with existing checks', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint' })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={true}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).toContain('Re-scanning...');
    });

    it('does not show Re-scanning when not scanning', () => {
      const checks = [createCheck({ id: 'eslint', name: 'ESLint' })];
      const { lastFrame } = render(
        <HealthPanel
          checks={checks}
          isScanning={false}
          progress={[]}
          scrollOffset={0}
          availableHeight={10}
        />,
      );
      expect(lastFrame()).not.toContain('Re-scanning...');
    });
  });
});
