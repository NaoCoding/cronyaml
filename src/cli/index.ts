#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { ConfigError, CronYamlError } from "../errors.js";
import { loadConfig } from "../config/loader.js";
import { CronYamlScheduler } from "../scheduler/scheduler.js";
import { DEFAULT_CONFIG_FILENAMES } from "../utils/paths.js";

const starterConfig = `version: 1

jobs:
  hello:
    schedule: "* * * * *"
    command: "echo 'Hello from CronYAML'"
`;

const program = new Command()
  .name("cronyaml")
  .description("Cron jobs, defined in YAML.")
  .version("0.1.0");

program.command("init")
  .description("create a starter configuration")
  .option("--force", "overwrite an existing file")
  .option("--file <path>", "configuration path", "cron.yaml")
  .action((options: { force?: boolean; file: string }) => {
    const path = resolve(process.cwd(), options.file);
    if (existsSync(path) && !options.force) {
      console.error(`${path} already exists.`);
      process.exitCode = 1;
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, starterConfig, "utf8");
    console.log(`${pc.green("✓")} Created ${path}`);
    console.log("\nNext:\n\n  cronyaml validate\n  cronyaml run");
  });

program.command("validate")
  .description("validate configuration without starting jobs")
  .option("--file <path>", "configuration path")
  .action((options: { file?: string }) => {
    const config = loadConfig(options.file);
    console.log("CronYAML configuration\n");
    for (const job of config.jobs) {
      console.log(`${pc.cyan(job.name)}${job.enabled ? "" : " (disabled)"}`);
      console.log(`  Schedule: ${job.schedule}`);
      if (job.timezone) console.log(`  Timezone: ${job.timezone}`);
      console.log();
    }
    console.log(`${config.jobs.length} jobs valid`);
  });

program.command("list")
  .description("show configured jobs")
  .option("--file <path>", "configuration path")
  .action((options: { file?: string }) => {
    const config = loadConfig(options.file);
    console.log("NAME\tSCHEDULE\tTIMEZONE\tENABLED");
    for (const job of config.jobs) console.log(`${job.name}\t${job.schedule}\t${job.timezone ?? "local"}\t${job.enabled ? "yes" : "no"}`);
  });

program.command("exec <job>")
  .description("execute one configured job immediately")
  .option("--file <path>", "configuration path")
  .action(async (jobName: string, options: { file?: string }) => {
    const scheduler = new CronYamlScheduler(loadConfig(options.file));
    const result = await scheduler.executeJob(jobName);
    process.exitCode = result.success ? 0 : 1;
  });

program.command("run")
  .description("start the scheduler")
  .argument("[jobs...]", "optional jobs to enable")
  .option("--file <path>", "configuration path")
  .action(async (requestedJobs: string[], options: { file?: string }) => {
    const config = loadConfig(options.file);
    const selected = requestedJobs.length ? new Set(requestedJobs) : undefined;
    const filtered = selected ? { ...config, jobs: config.jobs.map((job) => ({ ...job, enabled: job.enabled && selected.has(job.name) })) } : config;
    const scheduler = new CronYamlScheduler(filtered);
    scheduler.start();
    const stop = async () => { console.log("\nStopping scheduler..."); await scheduler.stop(); process.exit(0); };
    process.once("SIGINT", () => { void stop(); });
    process.once("SIGTERM", () => { void stop(); });
    await new Promise<void>(() => undefined);
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof CronYamlError || error instanceof ConfigError ? error.message : error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = error instanceof CronYamlError ? error.exitCode : 1;
  }
}

void main();

export { starterConfig, DEFAULT_CONFIG_FILENAMES };
