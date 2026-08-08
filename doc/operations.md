---
layout: default
title: Operations and security
---

# Operations and security

## Docker

Build the package first because the Dockerfile copies the compiled `dist`
directory into a Node.js 20 Alpine image:

```bash
npm run build
docker build -t cronyaml .
docker run --rm -v "$(pwd)/cron.yaml:/app/cron.yaml" cronyaml
```

The image starts `cronyaml run` and expects `/app/cron.yaml`. Mount a matching
`.env` file beside it if the config uses environment variables.

## Remote-script cache

Remote jobs download a new script for each run and cache it by source URL. The
cache is under the platform's normal application cache location:

- Windows: `%LOCALAPPDATA%\\cronyaml\\scripts`
- Unix-like systems: `$XDG_CACHE_HOME/cronyaml/scripts`, or `~/.cache/cronyaml/scripts`

Fresh download failure is fatal unless `use-cached: true` and a previous copy
exists. Pin remote URLs to commit SHAs for reproducible execution.

## Security

CronYAML intentionally executes local commands and downloaded scripts with the
current user's permissions. Treat YAML, `.env`, and remote sources as code:

- use only trusted config files and GitHub repositories;
- prefer commit-pinned remote URLs;
- keep OAuth client secrets and refresh tokens out of Git;
- use least-privilege credentials and rotate exposed secrets;
- set `cwd`, `env`, and timeouts deliberately.

## Troubleshooting

| Symptom                        | Check                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| No config found                | Run from the intended directory or pass `--file`.                                          |
| Undefined environment variable | Add the variable to the config directory's `.env`, the process environment, or job `env`.  |
| Remote URL rejected            | Use an HTTPS GitHub file URL and include the file path.                                    |
| Remote runtime unknown         | Set `runtime` explicitly.                                                                  |
| Job never starts               | Confirm `enabled: true`, the schedule, and the selected job names passed to `run`.         |
| Scheduled run skipped          | `concurrency.policy: forbid` skips overlap while the previous run is still active.         |
| Gmail setup fails              | Validate the OAuth client, refresh token, Gmail API permission, and `examples/gmail/.env`. |
