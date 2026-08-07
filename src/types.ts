export interface RetryConfig {
  attempts: number;
  delay: string;
}

export interface ConcurrencyConfig {
  policy: "allow" | "forbid";
}

export type ScriptRuntime = "bash" | "sh" | "node" | "python" | "powershell";

export interface JobConfig {
  name: string;
  schedule: string;
  command?: string;
  source?: string;
  runtime?: ScriptRuntime;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: string;
  enabled: boolean;
  timezone?: string;
  concurrency: ConcurrencyConfig;
  retry: RetryConfig;
}

export interface RawJobConfig {
  schedule: string;
  command?: string;
  source?: string;
  runtime?: ScriptRuntime;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: string;
  enabled?: boolean;
  timezone?: string;
  concurrency?: Partial<ConcurrencyConfig>;
  retry?: Partial<RetryConfig>;
}

export interface CronYamlFile {
  version: 1;
  defaults?: { timezone?: string; timeout?: string };
  jobs: Record<string, RawJobConfig>;
}

export interface ValidatedConfig {
  path: string;
  directory: string;
  defaults: { timezone?: string; timeout?: string };
  jobs: JobConfig[];
}

export interface JobExecutionResult {
  jobName: string;
  success: boolean;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  attempt: number;
  exitCode?: number;
  signal?: string;
  stdout?: string;
  stderr?: string;
  timedOut: boolean;
  error?: Error;
}

export interface JobRuntimeState {
  runningCount: number;
  lastStartedAt?: Date;
  lastFinishedAt?: Date;
  lastResult?: JobExecutionResult;
}
