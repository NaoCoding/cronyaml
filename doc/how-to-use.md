---
layout: default
title: How to use
---

# How to use CronYAML

## Requirements

- Node.js 20 or newer
- A YAML configuration file containing at least one job

CronYAML is ESM-only. Install it in the project that owns the jobs:

```bash
npm install cronyaml
```

## Create a configuration

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

## CLI commands

| Command | Purpose |
| --- | --- |
| `cronyaml init [--force] [--file <path>]` | Create a starter configuration. |
| `cronyaml validate [--file <path>]` | Validate YAML and print the configured jobs without starting them. |
| `cronyaml list [--file <path>]` | Print a compact table of jobs, schedules, sources, time zones, and enabled state. |
| `cronyaml exec <job> [--file <path>]` | Execute one job immediately. This also works for disabled jobs. |
| `cronyaml run [jobs...] [--file <path>]` | Start the scheduler in the foreground. Optionally limit scheduling to named jobs. |

For example:

```bash
npx cronyaml validate --file config/jobs.yaml
npx cronyaml list
npx cronyaml exec backup
npx cronyaml run backup report
```

The scheduler stops gracefully when it receives `SIGINT` or `SIGTERM`.

## YAML configuration

The top-level version is currently `1`. Each job must contain a cron schedule
and exactly one of `command` or `source`.

```yaml
version: 1

defaults:
  timezone: Asia/Taipei
  timeout: 10m

jobs:
  report:
    schedule: "0 9 * * 1-5"
    command: "node scripts/report.js --url ${REPORT_URL}"
    cwd: scripts
    env:
      NODE_ENV: production
    retry:
      attempts: 3
      delay: 10s
    concurrency:
      policy: forbid
```

### Top-level fields

| Field | Description |
| --- | --- |
| `version` | Required schema version. Set to `1`. |
| `jobs` | Required mapping of job names to job definitions. |
| `defaults.timezone` | Optional IANA time zone used when a job does not define one. |
| `defaults.timeout` | Optional timeout used when a job does not define one. |

### Job fields

| Field | Description |
| --- | --- |
| `schedule` | Required cron expression. |
| `command` | A local shell command. Use this or `source`, but not both. |
| `source` | An HTTPS GitHub file URL. Use this or `command`, but not both. |
| `runtime` | Runtime for a remote script: `bash`, `sh`, `node`, `python`, or `powershell`. Inferred from the file extension when omitted. |
| `args` | String arguments passed to a remote script. Requires `source`. |
| `use-cached` | Allow a remote job to use its previous cached script when downloading fails. Defaults to `false`, so remote jobs download the script on every run. Requires `source`. |
| `cwd` | Working directory for the job. Relative paths are resolved from the configuration file's directory. |
| `env` | Environment variables added to the job. `${NAME}` placeholders are interpolated before validation. |
| `enabled` | Whether the job starts with `run`. Defaults to `true`. |
| `timezone` | IANA time zone for this job. Overrides `defaults.timezone`. |
| `timeout` | Maximum execution time, such as `30s`, `10m`, or `1h`. |
| `retry.attempts` | Total attempts, from `1` to `100`. Defaults to `1`. |
| `retry.delay` | Delay between attempts, such as `10s`. Defaults to `0s`. |
| `concurrency.policy` | `allow` permits overlap; `forbid` skips a scheduled run while the job is already running. Defaults to `allow`. |

## Run a remote GitHub script

Remote jobs download the script when they run. By default, a download failure
causes the job to fail rather than running an old cached script. Set
`use-cached: true` only when offline fallback is desired. GitHub `blob` URLs are
accepted and normalized internally:

```yaml
version: 1

jobs:
  remote-example:
    schedule: "*/5 * * * *"
    source: "https://github.com/NaoCoding/cronyaml/blob/main/examples/remote/hello.js"
    args: ["world"]
    # use-cached: true
```

For reproducible execution, prefer a URL pinned to a commit SHA, for example:

```yaml
source: "https://raw.githubusercontent.com/my-org/scripts/<commit>/backup.sh"
```

Only use trusted configuration files and remote sources. CronYAML intentionally
runs commands and downloaded scripts with the current user's permissions.

## Environment variables

CronYAML loads a `.env` file next to the configuration file. Actual process
environment variables take precedence over values from `.env`, and job-level
`env` values take precedence over both.

```yaml
jobs:
  deploy:
    schedule: "0 18 * * 1-5"
    command: "./deploy.sh --environment ${DEPLOY_ENV}"
```

An undefined `${NAME}` reference causes validation to fail with the referenced
variable name.

## Docker

Build the image and mount a configuration file into the container:

```bash
docker build -t cronyaml .
docker run --rm -v "$(pwd)/cron.yaml:/app/cron.yaml" cronyaml
```

## Programmatic API

The package exports `loadConfig` and `CronYamlScheduler`:

```ts
import { loadConfig, CronYamlScheduler } from "cronyaml";

const config = loadConfig("./cron.yaml");
const scheduler = new CronYamlScheduler(config);
scheduler.start();
```
