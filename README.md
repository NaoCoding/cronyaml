# CronYAML

> Cron jobs, defined in YAML.

CronYAML is a lightweight Node.js scheduler for running shell commands from a simple YAML file. It keeps the scheduler in the foreground and never modifies the system crontab.

## Installation

```bash
npm install cronyaml
```

## Quick start

```bash
npx cronyaml init
npx cronyaml validate
npx cronyaml run
```

By default CronYAML discovers `cron.yaml` in the current directory, followed by `cron.yml`, `.cron.yaml`, and `.cron.yml`.

```yaml
version: 1

jobs:
  backup:
    schedule: "0 2 * * *"
    command: "npm run backup"
    timeout: "30m"
    retry:
      attempts: 3
      delay: "10s"
    concurrency:
      policy: forbid
```

## CLI

```text
cronyaml init [--force] [--file <path>]
cronyaml validate [--file <path>]
cronyaml list [--file <path>]
cronyaml exec <job> [--file <path>]
cronyaml run [jobs...] [--file <path>]
```

Use `--file` to override discovery, for example `cronyaml run --file config/jobs.yaml`.

## Configuration

Required fields are `version: 1`, `jobs`, `schedule`, and `command`. Jobs can also set `cwd`, `env`, `enabled`, `timezone`, `timeout`, `retry`, and `concurrency`.

Relative `cwd` paths are resolved from the directory containing `cron.yaml`. The scheduler validates all enabled and disabled jobs before starting.

Environment variables are interpolated with `${NAME}`. CronYAML loads `.env` next to `cron.yaml`; actual process environment variables take precedence.

```yaml
version: 1

defaults:
  timezone: Asia/Taipei
  timeout: 10m

jobs:
  report:
    schedule: "0 9 * * 1-5"
    command: "node scripts/report.js --url ${REPORT_URL}"
    env:
      NODE_ENV: production
```

Treat configuration files as executable code: CronYAML intentionally runs shell commands and should not load untrusted YAML.

## Docker

```bash
docker build -t cronyaml .
docker run --rm -v "$(pwd)/cron.yaml:/app/cron.yaml" cronyaml
```

## Programmatic API

```ts
import { loadConfig, CronYamlScheduler } from "cronyaml";

const config = loadConfig("./cron.yaml");
const scheduler = new CronYamlScheduler(config);
scheduler.start();
```

## Scope

CronYAML v1 supports command jobs, retries, timeouts, environment interpolation, timezone validation, overlap prevention, and graceful shutdown. It does not provide persistent history, distributed locks, HTTP jobs, notifications, or hot reloading.

## License

MIT
