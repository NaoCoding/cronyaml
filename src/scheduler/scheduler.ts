import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import cron, { type ScheduledTask } from "node-cron";
import { JobNotFoundError } from "../errors.js";
import { info, warn } from "../logger/logger.js";
import type { JobConfig, JobExecutionResult, JobFollowUpConfig, JobRuntimeState, ValidatedConfig } from "../types.js";
import { JobExecutor } from "../executor/job-executor.js";
import type { JobInvocation } from "../executor/command-executor.js";

const MAX_FOLLOW_UP_RUNS = 1000;

interface FollowUpIteration {
  index: number;
  iteration: number;
  item?: unknown;
}

export class CronYamlScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly states = new Map<string, JobRuntimeState>();
  private readonly checkpoints = new Map<string, Record<string, unknown>>();
  private readonly checkpointBootstrap = new Set<string>();
  private readonly active = new Set<Promise<JobExecutionResult>>();
  private stopping = false;

  constructor(private readonly config: ValidatedConfig, private readonly executor = new JobExecutor()) {
    for (const job of config.jobs) {
      this.states.set(job.name, { runningCount: 0 });
      if (job.checkpoint) this.initializeCheckpoint(job);
    }
  }

  start(): void {
    this.stopping = false;
    for (const job of this.config.jobs.filter((item) => item.enabled && item.schedule !== undefined)) {
      if (!job.schedule) continue;
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

  private async trigger(job: JobConfig, manual = false, invocation?: JobInvocation): Promise<JobExecutionResult> {
    if (this.stopping && !manual) throw new Error("Scheduler is stopping");
    if (!manual && this.checkpointBootstrap.delete(job.name)) {
      const now = new Date();
      info(`[${now.toLocaleTimeString([], { hour12: false })}] ${job.name} checkpoint initialized; first scheduled run skipped`);
      return {
        jobName: job.name,
        success: true,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        attempt: 0,
        timedOut: false,
      };
    }
    if (manual) this.checkpointBootstrap.delete(job.name);
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
    const promise = this.executor.execute(job, this.withCheckpointInput(job, invocation));
    this.active.add(promise);
    try {
      const result = await promise;
      state.lastResult = result;
      if (result.success && !this.commitCheckpoint(job, result)) return result;
      await this.runFollowUp(job, result);
      return result;
    } finally {
      state.runningCount -= 1;
      state.lastFinishedAt = new Date();
      this.active.delete(promise);
    }
  }

  private async runFollowUp(job: JobConfig, result: JobExecutionResult): Promise<void> {
    if (result.attempt === 0) return;
    const followUp = result.success ? job.ifSuccess : job.ifFailed;
    if (!followUp) return;

    const target = this.getJob(followUp.job);
    let iterations: FollowUpIteration[];
    try {
      iterations = this.createFollowUpIterations(followUp, result);
    } catch (error) {
      warn(`[${new Date().toLocaleTimeString([], { hour12: false })}] follow-up ${target.name} skipped: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    for (const iteration of iterations) {
      const suffix = iterations.length > 1 ? ` (${iteration.iteration}/${iterations.length})` : "";
      try {
        const invocation = this.createInvocation(followUp, result, iteration);
        info(`[${new Date().toLocaleTimeString([], { hour12: false })}] ${job.name} ${result.success ? "succeeded" : "failed"}; running ${target.name}${suffix}`);
        const followUpResult = await this.trigger(target, true, invocation);
        if (!followUpResult.success) {
          warn(`[${new Date().toLocaleTimeString([], { hour12: false })}] follow-up ${target.name}${suffix} failed after ${job.name}`);
        }
      } catch (error) {
        warn(`[${new Date().toLocaleTimeString([], { hour12: false })}] follow-up ${target.name}${suffix} errored: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private createFollowUpIterations(followUp: JobFollowUpConfig, result: JobExecutionResult): FollowUpIteration[] {
    if (followUp.forEach !== undefined) {
      const value = this.interpolate(followUp.forEach, result, { index: 0, iteration: 1 });
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("for_each must resolve to a JSON array");
      }
      if (!Array.isArray(parsed)) throw new Error("for_each must resolve to a JSON array");
      if (parsed.length > MAX_FOLLOW_UP_RUNS) throw new Error(`for_each cannot run more than ${MAX_FOLLOW_UP_RUNS} jobs`);
      return parsed.map((item, index) => ({ item, index, iteration: index + 1 }));
    }

    let count = 1;
    if (followUp.repeat !== undefined) {
      const value = typeof followUp.repeat === "number"
        ? String(followUp.repeat)
        : this.interpolate(followUp.repeat, result, { index: 0, iteration: 1 });
      if (!/^\d+$/.test(value.trim())) throw new Error("repeat must resolve to a non-negative integer");
      count = Number(value.trim());
      if (count > MAX_FOLLOW_UP_RUNS) throw new Error(`repeat cannot run more than ${MAX_FOLLOW_UP_RUNS} jobs`);
    }
    return Array.from({ length: count }, (_unused, index) => ({ index, iteration: index + 1 }));
  }

  private createInvocation(followUp: JobFollowUpConfig, result: JobExecutionResult, iteration: FollowUpIteration): JobInvocation {
    const interpolate = (value: string): string => value.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}/g, (_match, path: string) => {
      const resolved = resolveTemplateValue(path, result, iteration);
      if (resolved === undefined) throw new Error(`unknown follow-up parameter: ${path}`);
      return formatTemplateValue(resolved);
    });
    const env = Object.fromEntries(Object.entries(followUp.env).map(([key, value]) => [key, interpolate(value)]));
    const parameters = Object.fromEntries(Object.entries(followUp.parameters).map(([key, value]) => [key, interpolate(value)]));
    return {
      args: followUp.args.map(interpolate),
      env: { ...env, ...parameters },
    };
  }

  private interpolate(value: string, result: JobExecutionResult, iteration: FollowUpIteration): string {
    return value.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}/g, (_match, path: string) => {
      const resolved = resolveTemplateValue(path, result, iteration);
      if (resolved === undefined) throw new Error(`unknown follow-up parameter: ${path}`);
      return formatTemplateValue(resolved);
    });
  }

  private initializeCheckpoint(job: JobConfig): void {
    const checkpoint = job.checkpoint as NonNullable<JobConfig["checkpoint"]>;
    if (existsSync(checkpoint.path)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(checkpoint.path, "utf8"));
      } catch (error) {
        throw new Error(`jobs.${job.name}.checkpoint.path is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`jobs.${job.name}.checkpoint.path must contain a JSON object`);
      }
      this.checkpoints.set(job.name, parsed as Record<string, unknown>);
      return;
    }

    const initial = Object.fromEntries(Object.entries(checkpoint.initialize).map(([key, value]) => [
      key,
      value === "now" ? new Date().toISOString() : value,
    ]));
    this.checkpoints.set(job.name, initial);
    if (Object.keys(initial).length) {
      writeCheckpoint(checkpoint.path, initial);
      this.checkpointBootstrap.add(job.name);
    }
  }

  private withCheckpointInput(job: JobConfig, invocation?: JobInvocation): JobInvocation | undefined {
    if (!job.checkpoint) return invocation;
    const checkpoint = this.checkpoints.get(job.name) ?? {};
    const input = Object.fromEntries(Object.entries(job.checkpoint.input).map(([key, value]) => {
      const rendered = value.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}/g, (_match, path: string) => {
        if (path !== "checkpoint" && !path.startsWith("checkpoint.")) throw new Error(`jobs.${job.name}.checkpoint.input references ${path}`);
        const resolved = resolveObjectPath(checkpoint, path === "checkpoint" ? [] : path.slice("checkpoint.".length).split("."));
        if (resolved === undefined) throw new Error(`jobs.${job.name}.checkpoint.input references missing ${path}`);
        return formatTemplateValue(resolved);
      });
      return [key, rendered];
    }));
    return { ...invocation, env: { ...input, ...invocation?.env } };
  }

  private commitCheckpoint(job: JobConfig, result: JobExecutionResult): boolean {
    if (!job.checkpoint || !Object.keys(job.checkpoint.output).length) return true;
    const checkpoint = this.checkpoints.get(job.name) ?? {};
    const next = { ...checkpoint };
    try {
      for (const [key, template] of Object.entries(job.checkpoint.output)) {
        const match = /^\{\{\s*([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}$/.exec(template);
        if (!match || !match[1].startsWith("result.")) throw new Error(`output ${key} must be a single result template`);
        const value = resolveTemplateValue(match[1], result, { index: 0, iteration: 1 });
        if (value === undefined || value === "") throw new Error(`output ${key} resolved to an empty value`);
        next[key] = value;
      }
      writeCheckpoint(job.checkpoint.path, next);
      this.checkpoints.set(job.name, next);
      return true;
    } catch (error) {
      warn(`[${new Date().toLocaleTimeString([], { hour12: false })}] ${job.name} checkpoint was not updated: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

function resolveTemplateValue(path: string, result: JobExecutionResult, iteration: FollowUpIteration): unknown {
  if (path === "job.name" || path === "result.jobName") return result.jobName;
  if (path === "index") return iteration.index;
  if (path === "iteration") return iteration.iteration;
  if (path === "item") return iteration.item;
  if (path.startsWith("item.")) return resolveObjectPath(iteration.item, path.slice("item.".length).split("."));
  if (!path.startsWith("result.")) return undefined;
  return resolveObjectPath(result, path.slice("result.".length).split(".")) ?? "";
}

function resolveObjectPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const part of path) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatTemplateValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function writeCheckpoint(path: string, checkpoint: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}
