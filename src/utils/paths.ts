import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_CONFIG_FILENAMES = [
  "cron.yaml",
  "cron.yml",
  ".cron.yaml",
  ".cron.yml",
] as const;

export function findConfigPath(cwd = process.cwd()): string | undefined {
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const path = resolve(cwd, filename);
    if (existsSync(path)) return path;
  }
  return undefined;
}
