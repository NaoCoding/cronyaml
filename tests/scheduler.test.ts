import { describe, expect, it, vi } from "vitest";
import { CronYamlScheduler } from "../src/scheduler/scheduler.js";
import type { JobConfig, JobExecutionResult, ValidatedConfig } from "../src/types.js";

const job: JobConfig = {
  name: "disabled",
  schedule: "* * * * *",
  command: "echo test",
  cwd: process.cwd(),
  enabled: false,
  concurrency: { policy: "allow" },
  retry: { attempts: 1, delay: "0s" },
};

const config: ValidatedConfig = { path: "cron.yaml", directory: process.cwd(), defaults: {}, jobs: [job] };

it("allows manual execution of disabled jobs", async () => {
  const result: JobExecutionResult = { jobName: "disabled", success: true, startedAt: new Date(), finishedAt: new Date(), durationMs: 1, attempt: 1, timedOut: false };
  const executor = { execute: vi.fn(async () => result) };
  const scheduler = new CronYamlScheduler(config, executor as never);
  await expect(scheduler.executeJob("disabled")).resolves.toEqual(result);
  expect(executor.execute).toHaveBeenCalledOnce();
});

describe("scheduler", () => {
  it("starts only enabled jobs", () => {
    const scheduler = new CronYamlScheduler(config);
    scheduler.start();
    expect(scheduler.getState("disabled")?.runningCount).toBe(0);
    void scheduler.stop();
  });

  it("runs the success follow-up and passes templated args and parameters", async () => {
    const source: JobConfig = {
      ...job,
      name: "source",
      ifSuccess: {
        job: "next",
        args: ["--source", "{{ result.jobName }}", "{{ result.stdout }}"],
        env: { SOURCE_STATUS: "{{ result.success }}" },
        parameters: { SOURCE_ATTEMPT: "{{ result.attempt }}" },
      },
    };
    const next: JobConfig = { ...job, name: "next" };
    const configWithFollowUp: ValidatedConfig = { ...config, jobs: [source, next] };
    const sourceResult: JobExecutionResult = {
      jobName: "source", success: true, startedAt: new Date(), finishedAt: new Date(), durationMs: 1,
      attempt: 2, stdout: "output", timedOut: false,
    };
    const nextResult: JobExecutionResult = {
      jobName: "next", success: true, startedAt: new Date(), finishedAt: new Date(), durationMs: 1,
      attempt: 1, timedOut: false,
    };
    const executor = {
      execute: vi.fn(async (current: JobConfig) => current.name === "source" ? sourceResult : nextResult),
    };
    const scheduler = new CronYamlScheduler(configWithFollowUp, executor as never);

    await expect(scheduler.executeJob("source")).resolves.toEqual(sourceResult);
    expect(executor.execute).toHaveBeenNthCalledWith(2, next, {
      args: ["--source", "source", "output"],
      env: { SOURCE_STATUS: "true", SOURCE_ATTEMPT: "2" },
    });
  });

  it("runs the failure follow-up after retries are exhausted", async () => {
    const source: JobConfig = {
      ...job,
      name: "source",
      ifFailed: { job: "alert", args: [], env: {}, parameters: { FAILED_JOB: "{{ job.name }}" } },
    };
    const alert: JobConfig = { ...job, name: "alert" };
    const failed: JobExecutionResult = {
      jobName: "source", success: false, startedAt: new Date(), finishedAt: new Date(), durationMs: 1,
      attempt: 1, timedOut: false,
    };
    const alerted: JobExecutionResult = {
      jobName: "alert", success: true, startedAt: new Date(), finishedAt: new Date(), durationMs: 1,
      attempt: 1, timedOut: false,
    };
    const executor = {
      execute: vi.fn(async (current: JobConfig) => current.name === "source" ? failed : alerted),
    };
    const scheduler = new CronYamlScheduler({ ...config, jobs: [source, alert] }, executor as never);

    await expect(scheduler.executeJob("source")).resolves.toEqual(failed);
    expect(executor.execute).toHaveBeenNthCalledWith(2, alert, { args: [], env: { FAILED_JOB: "source" } });
  });
});
