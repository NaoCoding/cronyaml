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
});
