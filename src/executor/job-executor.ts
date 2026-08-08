import { failure, info, jobOutput, timestamp, warn } from "../logger/logger.js";
import type { JobConfig, JobExecutionResult } from "../types.js";
import { executeCommand, type JobInvocation } from "./command-executor.js";

export class JobExecutor {
  async execute(job: JobConfig, invocation?: JobInvocation): Promise<JobExecutionResult> {
    let lastResult: JobExecutionResult | undefined;
    for (let attempt = 1; attempt <= job.retry.attempts; attempt += 1) {
      const startedAt = new Date();
      info(`[${timestamp()}] ${job.name} attempt ${attempt}/${job.retry.attempts} started`);
      const commandResult = await executeCommand(job, invocation);
      const finishedAt = new Date();
      lastResult = {
        jobName: job.name,
        success: commandResult.success,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        attempt,
        exitCode: commandResult.exitCode,
        signal: commandResult.signal,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        timedOut: commandResult.timedOut,
        error: commandResult.error,
      };
      if (commandResult.stdout) jobOutput(job.name, commandResult.stdout);
      if (commandResult.stderr) jobOutput(job.name, commandResult.stderr);
      if (lastResult.success) {
        info(`[${timestamp()}] ${job.name} completed in ${(lastResult.durationMs / 1000).toFixed(1)}s`);
        return lastResult;
      }
      const reason = commandResult.timedOut ? "timed out" : "failed";
      failure(`[${timestamp()}] ${job.name} ${reason} after ${(lastResult.durationMs / 1000).toFixed(1)}s`);
      if (attempt < job.retry.attempts) {
        warn(`[${timestamp()}] retrying ${job.name} in ${job.retry.delay}`);
        await new Promise((resolve) => setTimeout(resolve, parseRetryDelay(job.retry.delay)));
      }
    }
    return lastResult as JobExecutionResult;
  }
}

function parseRetryDelay(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  return amount * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2] as "ms" | "s" | "m" | "h" | "d"] ?? 0);
}
