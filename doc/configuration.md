---
layout: default
title: Configuration reference
---

# Configuration reference

CronYAML reads YAML with a required `version: 1` and a non-empty `jobs`
mapping. Every job needs a cron `schedule` and exactly one of `command` or
`source`.

## Complete example

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
    enabled: true
    retry:
      attempts: 3
      delay: 10s
    concurrency:
      policy: forbid

  remote-report:
    schedule: "*/15 * * * *"
    source: "https://github.com/example/ops/blob/main/report.py"
    runtime: python
    args: ["--format", "json"]
    use-cached: false
```

## Top-level fields

| Field               | Required | Behavior                                           |
| ------------------- | -------- | -------------------------------------------------- |
| `version`           | Yes      | Must be the number `1`.                            |
| `defaults.timezone` | No       | IANA time zone used when a job has no `timezone`.  |
| `defaults.timeout`  | No       | Maximum duration used when a job has no `timeout`. |
| `jobs`              | Yes      | Non-empty mapping of job names to job definitions. |

## Job fields

| Field                | Default          | Behavior                                                                           |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `schedule`           | —                | Required cron expression; invalid expressions fail validation.                     |
| `command`            | —                | Local shell command. Mutually exclusive with `source`.                             |
| `source`             | —                | HTTPS GitHub file URL. Mutually exclusive with `command`.                          |
| `runtime`            | inferred         | Remote runtime: `bash`, `sh`, `node`, `python`, or `powershell`.                   |
| `args`               | `[]`             | String arguments passed after a remote script path; requires `source`.             |
| `use-cached`         | `false`          | Permit the last cached remote script if a fresh download fails; requires `source`. |
| `cwd`                | config directory | Working directory. Relative paths are based on the config directory.               |
| `env`                | —                | Job environment additions and `${NAME}` references.                                |
| `enabled`            | `true`           | Whether `run` schedules the job. `exec` can still run a disabled job.              |
| `timezone`           | default/local    | IANA time zone for this job; overrides `defaults.timezone`.                        |
| `timeout`            | no timeout       | Maximum execution time, such as `30s`, `10m`, or `1h`.                             |
| `retry.attempts`     | `1`              | Total attempts, from `1` through `100`.                                            |
| `retry.delay`        | `0s`             | Delay between failed attempts.                                                     |
| `concurrency.policy` | `allow`          | `allow` permits overlap; `forbid` skips a scheduled run already in progress.       |

Job names may contain letters, numbers, `.`, `_`, and `-`, and may be up to 100
characters long.

## Environment variables

CronYAML loads `.env` from the directory containing the selected config. The
precedence order is:

1. job-level `env`
2. the process environment
3. the config directory's `.env`

`${NAME}` references are expanded before schema validation. An undefined
reference is an error and names the missing variable.

```yaml
jobs:
  deploy:
    schedule: "0 18 * * 1-5"
    command: "./deploy.sh --environment ${DEPLOY_ENV}"
```

## Remote sources

`source` accepts HTTPS URLs hosted on `github.com`, `www.github.com`, or
`raw.githubusercontent.com`. GitHub `blob` and `raw` file URLs are normalized
to a raw download URL. Runtime inference uses `.sh`, `.bash`, `.py`, `.js`,
`.mjs`, `.cjs`, and `.ps1`; set `runtime` for other extensions.

Remote jobs fetch a fresh copy every run by default and cache it under the
platform's CronYAML cache directory. `use-cached: true` enables offline fallback
to the previous copy. Prefer URLs pinned to a commit SHA when reproducibility
matters.

## Validation rules

Validation happens before the scheduler starts and includes YAML parsing, env
interpolation, schema checks, cron expressions, durations, time zones, job
names, working directories, and GitHub source URLs. Disabled jobs are also
validated.
