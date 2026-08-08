---
layout: default
title: Getting started
---

# Getting started

## Requirements

- Node.js 20 or newer
- A project directory containing at least one CronYAML job

CronYAML is ESM-only. Install it locally so the CLI and package use the same
project dependencies:

```bash
npm install cronyaml
```

## Create and run your first job

```bash
npx cronyaml init
npx cronyaml validate
npx cronyaml run
```

`init` creates `cron.yaml` with a job that prints a greeting every minute.
`run` stays in the foreground so the process manager, container, or terminal
that launched it owns the scheduler lifecycle.

## Choose a configuration file

Without `--file`, CronYAML checks the current directory in this order:

1. `cron.yaml`
2. `cron.yml`
3. `.cron.yaml`
4. `.cron.yml`

Use an explicit path when a project has multiple configurations:

```bash
npx cronyaml validate --file config/jobs.yaml
npx cronyaml run --file config/jobs.yaml
```

Relative paths are resolved from the current working directory. Relative job
`cwd` values are resolved from the directory containing the chosen config.

## A first local job

```yaml
version: 1

jobs:
  report:
    schedule: "0 9 * * 1-5"
    command: "node scripts/report.js"
    timeout: "10m"
```

See the [configuration reference](configuration.md) for all fields and the
[CLI reference](cli.md) for command behavior.
