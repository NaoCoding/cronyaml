import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import dotenv from "dotenv";
import { parse as parseYaml } from "yaml";
import { validate as isCronValid } from "node-cron";
import { ConfigError } from "../errors.js";
import { parseDuration } from "../utils/duration.js";
import { DEFAULT_CONFIG_FILENAMES, findConfigPath } from "../utils/paths.js";
import { rawConfigSchema } from "./schema.js";
import type { CronYamlFile, JobConfig, ValidatedConfig } from "../types.js";
import { normalizeGitHubSource } from "../executor/remote-script.js";

const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const ENV_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function interpolate(value: string, environment: Record<string, string>, field: string): string {
  return value.replace(ENV_PATTERN, (_match, name: string) => {
    const resolved = environment[name];
    if (resolved === undefined) throw new ConfigError(`${field} references undefined environment variable:\n\n${name}`);
    return resolved;
  });
}

function interpolateUnknown(value: unknown, environment: Record<string, string>, field: string): unknown {
  if (typeof value === "string") return interpolate(value, environment, field);
  if (Array.isArray(value)) return value.map((item, index) => interpolateUnknown(item, environment, `${field}[${index}]`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateUnknown(item, environment, `${field}.${key}`)]));
  }
  return value;
}

function validateTimezone(timezone: string, field: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new ConfigError(`${field}: invalid timezone ${JSON.stringify(timezone)}`);
  }
}

export function getConfigPath(file?: string, cwd = process.cwd()): string {
  if (file) return resolve(cwd, file);
  const found = findConfigPath(cwd);
  if (found) return found;
  throw new ConfigError([
    "No CronYAML configuration found.",
    "",
    "Expected one of:",
    ...DEFAULT_CONFIG_FILENAMES.map((name) => `- ${name}`),
    "",
    "Run:",
    "",
    "  cronyaml init",
  ].join("\n"));
}

export function loadConfig(file?: string, cwd = process.cwd()): ValidatedConfig {
  const path = getConfigPath(file, cwd);
  if (!existsSync(path)) throw new ConfigError(`Configuration file not found: ${path}`);
  if (!statSync(path).isFile()) throw new ConfigError(`Configuration path is not a file: ${path}`);

  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigError(`Invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
  }

  const directory = dirname(path);
  const dotenvValues = dotenv.parse(existsSync(resolve(directory, ".env")) ? readFileSync(resolve(directory, ".env")) : "");
  const environment = { ...dotenvValues, ...process.env } as Record<string, string>;
  const interpolated = interpolateUnknown(parsed, environment, "configuration");
  const result = rawConfigSchema.safeParse(interpolated);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`).join("\n");
    throw new ConfigError(`Configuration error\n\n${details}`);
  }

  const raw = result.data as CronYamlFile;
  if (raw.defaults?.timezone) validateTimezone(raw.defaults.timezone, "defaults.timezone");
  if (raw.defaults?.timeout) parseDuration(raw.defaults.timeout, "defaults.timeout");

  const jobs: JobConfig[] = Object.entries(raw.jobs).map(([name, job]) => {
    if (!NAME_PATTERN.test(name) || name.length > 100) throw new ConfigError(`jobs.${name}: invalid job name`);
    if (!isCronValid(job.schedule)) throw new ConfigError(`jobs.${name}.schedule: invalid cron expression: ${JSON.stringify(job.schedule)}`);
    const timezone = job.timezone ?? raw.defaults?.timezone;
    if (timezone) validateTimezone(timezone, `jobs.${name}.timezone`);
    const timeout = job.timeout ?? raw.defaults?.timeout;
    if (timeout) parseDuration(timeout, `jobs.${name}.timeout`);
    const retry = { attempts: job.retry?.attempts ?? 1, delay: job.retry?.delay ?? "0s" };
    parseDuration(retry.delay, `jobs.${name}.retry.delay`);
    const jobCwd = job.cwd ? (isAbsolute(job.cwd) ? job.cwd : resolve(directory, job.cwd)) : directory;
    if (!existsSync(jobCwd) || !statSync(jobCwd).isDirectory()) throw new ConfigError(`jobs.${name}.cwd: directory does not exist: ${jobCwd}`);
    if (job.source) {
      try {
        normalizeGitHubSource(job.source);
      } catch (error) {
        throw new ConfigError(`jobs.${name}.source: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return {
      name,
      schedule: job.schedule,
      command: job.command,
      source: job.source,
      runtime: job.runtime,
      args: job.args ?? [],
      cwd: jobCwd,
      env: { ...dotenvValues, ...process.env, ...job.env } as Record<string, string>,
      timeout,
      enabled: job.enabled ?? true,
      timezone,
      concurrency: { policy: job.concurrency?.policy ?? "allow" },
      retry,
    };
  });
  return { path, directory, defaults: raw.defaults ?? {}, jobs };
}
