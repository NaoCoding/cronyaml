import cron, { type ScheduledTask } from "node-cron";
import { JobNotFoundError } from "../errors.js";
import { info, warn } from "../logger/logger.js";
import type { JobConfig, JobExecutionResult, JobRuntimeState, ValidatedConfig } from "../types.js";
import { JobExecutor } from "../executor/job-executor.js";

export class CronYamlScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly states = new Map<string, JobRuntimeState>();
  private readonly active = new Set<Promise<JobExecutionResult>>();
  private stopping = false;

  constructor(private readonly config: ValidatedConfig, private readonly executor = new JobExecutor()) {
    for (const job of config.jobs) this.states.set(job.name, { runningCount: 0 });
  }

  start(): void {
    this.stopping = false;
    for (const job of this.config.jobs.filter((item) => item.enabled)) {
      const task = cron.schedule(job.schedule, () => { void this.trigger(job); }, job.timezone ? { timezone: job.timezone } : undefined);
      this.tasks.set(job.name, task);
    }
    info(`Scheduler started. ${this.tasks.size} job${this.tasks.size === 1 ? "" : "s"} scheduled.`);
  }

  async stop(timeoutMs = 30000): Promise<void> {
    this.stopping = true;
    for (const task of this.tasks.values()) task.stop();
    this.tasks.clear();
    if (!this.active.size) return;
    info(`Waiting for ${this.active.size} running job${this.active.size === 1 ? "" : "s"}...`);
    await Promise.race([Promise.allSettled([...this.active]), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  }

  async executeJob(name: string): Promise<JobExecutionResult> {
    const job = this.getJob(name);
    return this.trigger(job, true);
  }

  getState(name: string): JobRuntimeState | undefined { return this.states.get(name); }

  private getJob(name: string): JobConfig {
    const job = this.config.jobs.find((item) => item.name === name);
    if (!job) throw new JobNotFoundError(name);
    return job;
  }

  private async trigger(job: JobConfig, manual = false): Promise<JobExecutionResult> {
    if (this.stopping && !manual) throw new Error("Scheduler is stopping");
    const state = this.states.get(job.name) as JobRuntimeState;
    if (!manual && job.concurrency.policy === "forbid" && state.runningCount > 0) {
      warn(`[${new Date().toLocaleTimeString([], { hour12: false })}] ${job.name} skipped: previous execution still running`);
      return {
        jobName: job.name,
        success: true,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 0,
        attempt: 0,
        timedOut: false,
      };
    }
    state.runningCount += 1;
    state.lastStartedAt = new Date();
    const promise = this.executor.execute(job);
    this.active.add(promise);
    try {
      const result = await promise;
      state.lastResult = result;
      return result;
    } finally {
      state.runningCount -= 1;
      state.lastFinishedAt = new Date();
      this.active.delete(promise);
    }
  }
}
