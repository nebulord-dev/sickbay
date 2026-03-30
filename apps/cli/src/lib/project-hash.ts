import { createHash } from 'crypto';
import { resolve } from 'path';

/**
 * Generates a unique hash for a given project path.
 * This is used to create a consistent filename for storing the project's historical data.
 * The hash is derived from the absolute path of the project, ensuring that different projects with the same name do not collide.
 *
 * @param projectPath - The file system path to the project.
 * @returns A 16-character hexadecimal string representing the hash of the project path.
 */
export function projectHash(projectPath: string): string {
  return createHash('sha256').update(resolve(projectPath)).digest('hex').slice(0, 16);
}
