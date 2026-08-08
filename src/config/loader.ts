import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import dotenv from "dotenv";
import { parse as parseYaml } from "yaml";
import { validate as isCronValid } from "node-cron";
import { ConfigError } from "../errors.js";
import { parseDuration } from "../utils/duration.js";
import { DEFAULT_CONFIG_FILENAMES, findConfigPath } from "../utils/paths.js";
import { rawConfigSchema } from "./schema.js";
import type { CronYamlFile, JobConfig, JobFollowUpConfig, RawJobConfig, RawJobFollowUpConfig, ValidatedConfig } from "../types.js";
import { normalizeGitHubSource } from "../executor/remote-script.js";

const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const ENV_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const FOLLOW_UP_TEMPLATE_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}/g;
const FOLLOW_UP_TEMPLATE_FIELDS = new Set([
  "job.name",
  "result.jobName",
  "result.success",
  "result.startedAt",
  "result.finishedAt",
  "result.durationMs",
  "result.attempt",
  "result.exitCode",
  "result.signal",
  "result.stdout",
  "result.stderr",
]);

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

function normalizeFollowUp(value: RawJobFollowUpConfig | undefined): JobFollowUpConfig | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return { job: value, args: [], env: {}, parameters: {} };
  return {
    job: value.job,
    args: value.args ?? [],
    env: value.env ?? {},
    parameters: value.parameters ?? {},
  };
}

function validateFollowUpGraph(jobs: Record<string, { if_success?: RawJobFollowUpConfig; if_failed?: RawJobFollowUpConfig }>): void {
  const edges = new Map<string, string[]>();
  for (const [name, job] of Object.entries(jobs)) {
    const targets = [job.if_success, job.if_failed]
      .map((followUp) => typeof followUp === "string" ? followUp : followUp?.job)
      .filter((target): target is string => target !== undefined);
    for (const target of targets) {
      if (!Object.prototype.hasOwnProperty.call(jobs, target)) {
        throw new ConfigError(`jobs.${name}: follow-up job does not exist: ${target}`);
      }
      if (target === name) throw new ConfigError(`jobs.${name}: follow-up job cannot reference itself`);
    }
    edges.set(name, targets);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) throw new ConfigError(`job follow-up cycle detected at: ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const target of edges.get(name) ?? []) visit(target);
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of edges.keys()) visit(name);
}

function validateFollowUpTemplates(jobs: Record<string, RawJobConfig>): void {
  const validateValue = (value: string, field: string): void => {
    for (const match of value.matchAll(FOLLOW_UP_TEMPLATE_PATTERN)) {
      const path = match[1];
      if (!FOLLOW_UP_TEMPLATE_FIELDS.has(path)) {
        throw new ConfigError(`${field}: unsupported follow-up template ${path}`);
      }
    }
  };
  const validateFollowUp = (followUp: RawJobFollowUpConfig | undefined, field: string): void => {
    if (followUp === undefined || typeof followUp === "string") return;
    followUp.args?.forEach((value, index) => validateValue(value, `${field}.args[${index}]`));
    for (const [key, value] of Object.entries(followUp.env ?? {})) validateValue(value, `${field}.env.${key}`);
    for (const [key, value] of Object.entries(followUp.parameters ?? {})) validateValue(value, `${field}.parameters.${key}`);
  };
  for (const [name, job] of Object.entries(jobs)) {
    validateFollowUp(job.if_success, `jobs.${name}.if_success`);
    validateFollowUp(job.if_failed, `jobs.${name}.if_failed`);
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
  validateFollowUpGraph(raw.jobs);
  validateFollowUpTemplates(raw.jobs);
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
      useCached: job["use-cached"] ?? false,
      cwd: jobCwd,
      env: { ...dotenvValues, ...process.env, ...job.env } as Record<string, string>,
      timeout,
      enabled: job.enabled ?? true,
      timezone,
      concurrency: { policy: job.concurrency?.policy ?? "allow" },
      retry,
      ifSuccess: normalizeFollowUp(job.if_success),
      ifFailed: normalizeFollowUp(job.if_failed),
    };
  });
  return { path, directory, defaults: raw.defaults ?? {}, jobs };
}
