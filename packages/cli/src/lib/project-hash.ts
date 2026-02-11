import { createHash } from "crypto";
import { resolve } from "path";

export function projectHash(projectPath: string): string {
  return createHash("sha256")
    .update(resolve(projectPath))
    .digest("hex")
    .slice(0, 16);
}
