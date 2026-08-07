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
});
