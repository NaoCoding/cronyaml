export interface RetryConfig {
  attempts: number;
  delay: string;
}

export interface ConcurrencyConfig {
  policy: "allow" | "forbid";
}

export interface JobConfig {
  name: string;
  schedule: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: string;
  enabled: boolean;
  timezone?: string;
  concurrency: ConcurrencyConfig;
  retry: RetryConfig;
}

export interface CronYamlFile {
  version: 1;
  defaults?: { timezone?: string; timeout?: string };
  jobs: Record<string, Omit<JobConfig, "name" | "enabled" | "concurrency" | "retry"> & {
    enabled?: boolean;
    concurrency?: Partial<ConcurrencyConfig>;
    retry?: Partial<RetryConfig>;
  }>;
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
