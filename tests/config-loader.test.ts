import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import { getConfigPath, loadConfig } from "../src/config/loader.js";

function tempProject(): string {
  const directory = mkdtempSync(join(tmpdir(), "cronyaml-"));
  mkdirSync(join(directory, "scripts"));
  return directory;
}

describe("configuration loader", () => {
  it("discovers cron.yaml by default", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), "version: 1\njobs:\n  hello:\n    schedule: '* * * * *'\n    command: echo hello\n");
    expect(getConfigPath(undefined, directory)).toBe(join(directory, "cron.yaml"));
    expect(loadConfig(undefined, directory).jobs[0]?.name).toBe("hello");
  });

  it("gives cron.yaml priority over older aliases", () => {
    const directory = tempProject();
    const yaml = "version: 1\njobs:\n  job:\n    schedule: '* * * * *'\n    command: echo hello\n";
    writeFileSync(join(directory, "cron.yml"), yaml);
    writeFileSync(join(directory, "cron.yaml"), yaml.replace("job:", "preferred:"));
    expect(loadConfig(undefined, directory).jobs[0]?.name).toBe("preferred");
  });

  it("interpolates .env and resolves cwd relative to the config", () => {
    const directory = tempProject();
    writeFileSync(join(directory, ".env"), "GREETING=hello\n");
    writeFileSync(join(directory, "cron.yaml"), "version: 1\njobs:\n  job:\n    schedule: '* * * * *'\n    command: echo ${GREETING}\n    cwd: scripts\n");
    const config = loadConfig(undefined, directory);
    expect(config.jobs[0]?.command).toBe("echo hello");
    expect(config.jobs[0]?.cwd).toBe(join(directory, "scripts"));
  });

  it("rejects undefined environment variables", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), "version: 1\njobs:\n  job:\n    schedule: '* * * * *'\n    command: echo ${CRONYAML_TEST_MISSING}\n");
    expect(() => loadConfig(undefined, directory)).toThrow(ConfigError);
  });

  it("loads a GitHub source and infers its script runtime", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), [
      "version: 1",
      "jobs:",
      "  remote:",
      "    schedule: '* * * * *'",
      "    source: https://github.com/example/scripts/blob/main/hello.py",
      "    args:",
      "      - world",
      "",
    ].join("\n"));
    const job = loadConfig(undefined, directory).jobs[0];
    expect(job?.source).toBe("https://github.com/example/scripts/blob/main/hello.py");
    expect(job?.args).toEqual(["world"]);
    expect(job?.command).toBeUndefined();
  });

  it("requires exactly one command source", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), "version: 1\njobs:\n  job:\n    schedule: '* * * * *'\n");
    expect(() => loadConfig(undefined, directory)).toThrow(ConfigError);
  });

  it("loads success and failure follow-ups with runtime parameters", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), [
      "version: 1",
      "jobs:",
      "  build:",
      "    schedule: '* * * * *'",
      "    command: echo build",
      "    if_success: deploy",
      "    if_failed:",
      "      job: alert",
      "      args: ['--source', '{{ result.jobName }}']",
      "      parameters:",
      "        status: '{{ result.success }}'",
      "  deploy:",
      "    schedule: '* * * * *'",
      "    command: echo deploy",
      "  alert:",
      "    schedule: '* * * * *'",
      "    command: echo alert",
      "",
    ].join("\n"));

    const jobs = loadConfig(undefined, directory).jobs;
    expect(jobs.find((job) => job.name === "build")?.ifSuccess).toEqual({ job: "deploy", args: [], env: {}, parameters: {} });
    expect(jobs.find((job) => job.name === "build")?.ifFailed).toEqual({
      job: "alert",
      args: ["--source", "{{ result.jobName }}"],
      env: {},
      parameters: { status: "{{ result.success }}" },
    });
  });

  it("rejects missing and cyclic follow-up jobs", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), [
      "version: 1",
      "jobs:",
      "  first:",
      "    schedule: '* * * * *'",
      "    command: echo first",
      "    if_success: missing",
      "",
    ].join("\n"));
    expect(() => loadConfig(undefined, directory)).toThrow("follow-up job does not exist");

    writeFileSync(join(directory, "cron.yaml"), [
      "version: 1",
      "jobs:",
      "  first:",
      "    schedule: '* * * * *'",
      "    command: echo first",
      "    if_success: second",
      "  second:",
      "    schedule: '* * * * *'",
      "    command: echo second",
      "    if_failed: first",
      "",
    ].join("\n"));
    expect(() => loadConfig(undefined, directory)).toThrow("follow-up cycle detected");
  });

  it("rejects unsupported follow-up templates during validation", () => {
    const directory = tempProject();
    writeFileSync(join(directory, "cron.yaml"), [
      "version: 1",
      "jobs:",
      "  first:",
      "    schedule: '* * * * *'",
      "    command: echo first",
      "    if_success:",
      "      job: second",
      "      parameters:",
      "        value: '{{ result.unknown }}'",
      "  second:",
      "    schedule: '* * * * *'",
      "    command: echo second",
      "",
    ].join("\n"));
    expect(() => loadConfig(undefined, directory)).toThrow("unsupported follow-up template");
  });
});
