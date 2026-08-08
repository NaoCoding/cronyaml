---
layout: default
title: Programmatic API
---

# Programmatic API

CronYAML exposes the validated configuration loader, scheduler, error classes,
and public TypeScript types from the package root.

## Load and schedule

```ts
import { CronYamlScheduler, loadConfig } from "cronyaml";

const config = loadConfig("./cron.yaml");
const scheduler = new CronYamlScheduler(config);

scheduler.start();
```

`loadConfig(file?)` discovers a config when `file` is omitted and returns a
validated, normalized `ValidatedConfig`. It resolves `cwd`, expands
environment variables, applies defaults, and converts `use-cached` to the
runtime property `useCached`.

`getConfigPath(file?, cwd?)` exposes the same discovery logic without loading
the file. Configuration failures throw `ConfigError`.

## Scheduler lifecycle

| Method                    | Behavior                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| `start()`                 | Schedules enabled jobs that define cron expressions and applies their time zones. |
| `stop(timeoutMs = 30000)` | Stops schedules and waits for active jobs up to the timeout.          |
| `executeJob(name)`        | Runs a named job immediately, including disabled jobs.                |
| `getState(name)`          | Returns running count and the latest start, finish, and result state. |

`executeJob` resolves to a `JobExecutionResult` containing success, timing,
attempt, exit code or signal, captured output, timeout state, and any error.
When the job has an `if_success` or `if_failed` follow-up, the follow-up is
executed before `executeJob` resolves, while the returned result remains the
result of the originally requested job.

## Errors and types

The package also exports `CronYamlError`, `ConfigError`, and
`JobNotFoundError`, plus the types `JobConfig`, `ValidatedConfig`,
`JobExecutionResult`, `JobRuntimeState`, `RetryConfig`, and related public
interfaces. `JobFollowUpConfig` describes normalized conditional follow-ups.

The scheduler does not daemonize itself. Keep the Node.js process alive and let
your service manager, container runtime, or parent process manage restarts.
