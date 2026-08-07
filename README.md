# CronYAML

> Cron jobs, defined in YAML.

CronYAML is a lightweight Node.js scheduler for running shell commands from a simple YAML file. It keeps the scheduler in the foreground and never modifies the system crontab.

Repository: [github.com/NaoCoding/cronyaml](https://github.com/NaoCoding/cronyaml)

npm package: [naocoding/cronyaml](https://www.npmjs.com/package/cronyaml)

Documentation: [CronYAML documentation](https://naocoding.github.io/cronyaml/)

## Installation

```bash
npm install cronyaml
```

CronYAML is an ESM-only package and requires Node.js 20 or newer.

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

Instead of a local command, a job can download and run a script from GitHub. The runtime is inferred from the file extension, and `runtime` can be set explicitly when needed:

```yaml
jobs:
  remote-backup:
    schedule: "0 3 * * *"
    source: "https://github.com/my-org/scripts/blob/main/backup.sh"
    args: ["--full"]
```

CronYAML downloads the script when the job runs and keeps a local cache for offline fallback. Supported runtimes are `bash`, `sh`, `node`, `python`, and `powershell`. Prefer a URL pinned to a commit SHA for predictable execution, for example `https://raw.githubusercontent.com/my-org/scripts/<commit>/backup.sh`.

## Remote script example

The repository includes [example.yaml](./example.yaml), which runs the example script from GitHub:

```bash
npx cronyaml validate --file example.yaml
npx cronyaml exec remote-example --file example.yaml
npx cronyaml run --file example.yaml
```

## CLI

For the maintained command reference and configuration guide, see the
[how-to-use documentation](./doc/how-to-use.md). Release history is maintained
in the [release notes](./doc/release-notes.md).

```text
cronyaml init [--force] [--file <path>]
cronyaml validate [--file <path>]
cronyaml list [--file <path>]
cronyaml exec <job> [--file <path>]
cronyaml run [jobs...] [--file <path>]
```

Use `--file` to override discovery, for example `cronyaml run --file config/jobs.yaml`.

## Configuration

Required fields are `version: 1`, `jobs`, `schedule`, and exactly one of `command` or `source`. Jobs can also set `cwd`, `env`, `enabled`, `timezone`, `timeout`, `retry`, and `concurrency`. Remote jobs additionally support `runtime` and `args`.

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

Treat configuration files and remote sources as executable code: CronYAML intentionally runs commands and downloaded scripts with the current user's permissions. Only use trusted YAML and GitHub sources.

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

## License

MIT
