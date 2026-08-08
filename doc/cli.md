---
layout: default
title: CLI reference
---

# CLI reference

All commands accept `--file <path>` to select a configuration. If omitted,
CronYAML uses the [discovery order](getting-started.md#choose-a-configuration-file).

| Command                                   | Purpose                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `cronyaml init [--force] [--file <path>]` | Create a starter config; refuse to overwrite unless `--force` is set.                       |
| `cronyaml validate [--file <path>]`       | Parse and validate every job without starting schedules.                                    |
| `cronyaml list [--file <path>]`           | Print a tab-separated summary of name, schedule, source type, time zone, and enabled state. |
| `cronyaml exec <job> [--file <path>]`     | Execute one job immediately and return a failing exit code when it fails.                   |
| `cronyaml run [jobs...] [--file <path>]`  | Start enabled schedules in the foreground; optional names limit the schedules.              |

## Common workflows

```bash
# Create a config in a subdirectory.
npx cronyaml init --file config/cron.yaml

# Inspect without executing anything.
npx cronyaml validate --file config/cron.yaml
npx cronyaml list --file config/cron.yaml

# Run one job now, or schedule a selected subset.
npx cronyaml exec backup --file config/cron.yaml
npx cronyaml run backup report --file config/cron.yaml
```

`validate` always checks disabled jobs. `run` schedules only jobs whose
`enabled` value is true; naming jobs on the command line further filters that
set. `exec` is manual and can execute a disabled job.

The scheduler handles `SIGINT` and `SIGTERM` gracefully: it stops new
schedules, waits for active jobs for up to 30 seconds, and then exits.
