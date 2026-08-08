---
layout: default
title: How to use
---

# How to use CronYAML

This page is the short end-to-end guide. Use the focused references for the
complete [configuration](configuration.md), [CLI](cli.md), [examples](examples.md),
[API](api.md), and [operations](operations.md) details.

## Requirements

- Node.js 20 or newer
- A YAML configuration file containing at least one job

CronYAML is ESM-only. Install it in the project that owns the jobs:

```bash
npm install cronyaml
```

## 1. Create a configuration

Run `init` to create a starter `cron.yaml`:

```bash
npx cronyaml init
```

By default, CronYAML looks for these files in order:

1. `cron.yaml`
2. `cron.yml`
3. `.cron.yaml`
4. `.cron.yml`

Use `--file <path>` with any command to choose a different configuration
file.

## 2. Validate and inspect it

```bash
npx cronyaml validate
npx cronyaml list
```

Validation expands environment variables, checks cron expressions and time
zones, resolves the working directory, and verifies that each job defines
exactly one execution source.

## 3. Run jobs

Run all enabled jobs in the foreground:

```bash
npx cronyaml run
```

Run one job immediately, including a disabled job:

```bash
npx cronyaml exec report
```

Stop a running scheduler with `Ctrl+C`, `SIGINT`, or `SIGTERM`; CronYAML stops
new schedules and waits for active jobs for up to 30 seconds.

## CLI commands

| Command                                   | Purpose                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `cronyaml init [--force] [--file <path>]` | Create a starter configuration.                                                   |
| `cronyaml validate [--file <path>]`       | Validate YAML and print the configured jobs without starting them.                |
| `cronyaml list [--file <path>]`           | Print a compact table of jobs, schedules, sources, time zones, and enabled state. |
| `cronyaml exec <job> [--file <path>]`     | Execute one job immediately. This also works for disabled jobs.                   |
| `cronyaml run [jobs...] [--file <path>]`  | Start the scheduler in the foreground. Optionally limit scheduling to named jobs. |

For example:

```bash
npx cronyaml validate --file config/jobs.yaml
npx cronyaml list
npx cronyaml exec backup
npx cronyaml run backup report
```

For the full YAML reference, continue to [configuration](configuration.md).
