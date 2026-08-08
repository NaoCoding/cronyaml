---
layout: default
title: CronYAML documentation
---

# CronYAML

CronYAML is a lightweight Node.js scheduler for running local commands and
trusted remote scripts from YAML. It stays in the foreground and never edits
the system crontab.

## Start here

```bash
npm install cronyaml
npx cronyaml init
npx cronyaml validate
npx cronyaml run
```

CronYAML requires Node.js 20 or newer. The [getting started guide](getting-started.md)
walks through this workflow from an empty project.

## What CronYAML supports

| Area          | Included capabilities                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Configuration | YAML versioning, config discovery, defaults, validation, environment interpolation           |
| Jobs          | Local shell commands or HTTPS GitHub scripts, working directories, arguments, enable/disable |
| Scheduling    | Cron expressions, IANA time zones, foreground lifecycle, graceful shutdown                   |
| Reliability   | Timeouts, retries, cached remote scripts, and overlap policies                               |
| Interfaces    | `init`, `validate`, `list`, `exec`, and `run` CLI commands plus a TypeScript API             |
| Operations    | Docker image support, structured logging, and trusted-source guidance                        |

Use the [configuration reference](configuration.md) for the complete field
reference, or jump to [examples](examples.md) for runnable jobs.

## Documentation

- [Getting started](getting-started.md) - install, initialize, validate, and run.
- [How to use CronYAML](how-to-use.md) - the end-to-end workflow at a glance.
- [Configuration reference](configuration.md) - every supported YAML field and default.
- [CLI reference](cli.md) - commands, options, output, and exit behavior.
- [Examples](examples.md) - basic, remote, and Gmail examples.
- [Programmatic API](api.md) - `loadConfig` and `CronYamlScheduler`.
- [Operations and security](operations.md) - Docker, caching, shutdown, and troubleshooting.
- [Release notes](release-notes.md) - changes grouped by published version.

## Project links

- [Source repository](https://github.com/NaoCoding/cronyaml)
- [npm package](https://www.npmjs.com/package/cronyaml)
- [Issue tracker](https://github.com/NaoCoding/cronyaml/issues)

## Quick start

```bash
npm install cronyaml
npx cronyaml init
npx cronyaml validate
npx cronyaml run
```

CronYAML requires Node.js 20 or newer and discovers `cron.yaml` in the current
directory by default.
