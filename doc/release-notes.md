---
layout: default
title: Release notes
---

# Release notes

This page records user-facing changes for each published CronYAML version.
The version in `package.json` is the source of truth for the current package
version.

## 0.1.2

Current release.

- YAML-defined cron jobs for local shell commands.
- CLI commands for initializing, validating, listing, executing, and running
  jobs.
- Per-job schedules, working directories, environment variables, time zones,
  timeouts, retries, and concurrency policies.
- Remote GitHub script execution with runtime detection, explicit runtime
  selection, arguments, SHA-pinnable URLs, and local caching.
- Node.js programmatic API through `loadConfig` and `CronYamlScheduler`.
- Docker image support and example configurations.

## Unreleased

Add changes here as they land, then move them into a numbered section when the
next version is published.

Use this format for future entries:

```markdown
## x.y.z

### Added

- New user-facing capability.

### Changed

- Behavior or configuration change.

### Fixed

- Bug fix.

### Breaking changes

- Any migration required by users.
```
