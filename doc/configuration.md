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
    if_success:
      job: notify-report
      args: ["--source", "{{ result.jobName }}"]
      parameters:
        status: "{{ result.success }}"
    if_failed: notify-report

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
| `runtime`            | inferred         | Remote runtime: `bash`, `sh`, `node`, `python`, or `powershell`; requires `source`. |
| `args`               | `[]`             | String arguments appended to a local command or passed after a remote script path. |
| `use-cached`         | `false`          | Permit the last cached remote script if a fresh download fails; requires `source`. |
| `cwd`                | config directory | Working directory. Relative paths are based on the config directory.               |
| `env`                | —                | Job environment additions and `${NAME}` references.                                |
| `enabled`            | `true`           | Whether `run` schedules the job. `exec` can still run a disabled job.              |
| `timezone`           | default/local    | IANA time zone for this job; overrides `defaults.timezone`.                        |
| `timeout`            | no timeout       | Maximum execution time, such as `30s`, `10m`, or `1h`.                             |
| `retry.attempts`     | `1`              | Total attempts, from `1` through `100`.                                            |
| `retry.delay`        | `0s`             | Delay between failed attempts.                                                     |
| `concurrency.policy` | `allow`          | `allow` permits overlap; `forbid` skips a scheduled run already in progress.       |
| `if_success`         | none             | Run another configured job after this job succeeds.                                  |
| `if_failed`          | none             | Run another configured job after this job fails, after all retries are exhausted.    |

Job names may contain letters, numbers, `.`, `_`, and `-`, and may be up to 100
characters long.

## Conditional follow-ups

`if_success` and `if_failed` accept either a target job name or an object:

```yaml
if_success:
  job: deploy
  args: ["--release", "{{ result.jobName }}"]
  env:
    SOURCE_STATUS: "{{ result.success }}"
  parameters:
    SOURCE_ATTEMPT: "{{ result.attempt }}"
```

Use `repeat` to run the target a dynamic number of times. The value may be a
literal from `0` through `1000`, or a template resolving to a non-negative
integer:

```yaml
if_success:
  job: send-email
  repeat: "{{ result.stdout }}"
```

Use `for_each` when the source job writes a JSON array to stdout. The target is
run once per array item, sequentially. `{{ item }}` is serialized as JSON for
objects, while `{{ item.email }}` accesses a field; `{{ index }}` is zero-based
and `{{ iteration }}` is one-based.

```yaml
if_success:
  job: send-email
  for_each: "{{ result.stdout }}"
  parameters:
    response: "{{ item }}"
    recipient: "{{ item.email }}"
```

`repeat` and `for_each` cannot be used together. A `for_each` value must resolve
to a JSON array, and both modes are capped at 1000 target executions per source
job.

The target job is run immediately, even if it is disabled or has no schedule.
`args` are appended to a local command or passed after the script path for a
remote job. `env` and `parameters` are merged into the target job's environment
(`parameters` take precedence when keys overlap). Templates are resolved after
the source job completes. Supported values are `result.jobName` (also
`job.name`), `result.success`, `result.startedAt`, `result.finishedAt`,
`result.durationMs`, `result.attempt`, `result.exitCode`, `result.signal`,
`result.stdout`, and `result.stderr`; missing optional result fields resolve to
an empty string. Follow-up targets must exist, and cyclic follow-up chains are
rejected during validation.

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
