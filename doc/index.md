---
layout: default
title: CronYAML documentation
---

# CronYAML

CronYAML is a lightweight Node.js scheduler for running shell commands from a
YAML file. It keeps the scheduler in the foreground and never modifies the
system crontab.

## Documentation

- [How to use CronYAML](how-to-use.md) - installation, CLI commands, YAML
  configuration, remote scripts, Docker, and the programmatic API.
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
