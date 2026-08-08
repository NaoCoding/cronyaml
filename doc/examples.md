---
layout: default
title: Examples
---

# Examples

The repository keeps each example in its own directory. The source files are
available on [GitHub](https://github.com/NaoCoding/cronyaml/tree/main/examples).

## Basic local command

Files: [`examples/basic/cron.yaml`](https://github.com/NaoCoding/cronyaml/blob/main/examples/basic/cron.yaml)
and [`scripts/heartbeat.js`](https://github.com/NaoCoding/cronyaml/blob/main/examples/basic/scripts/heartbeat.js).

The job runs a local Node.js command every five minutes. From the repository
root:

```bash
npx cronyaml validate --file examples/basic/cron.yaml
npx cronyaml exec heartbeat --file examples/basic/cron.yaml
npx cronyaml run --file examples/basic/cron.yaml
```

Its relative `cwd` defaults to `examples/basic`, so `scripts/heartbeat.js` is
resolved from that directory.

## Remote GitHub script

Files: [`example.yaml`](https://github.com/NaoCoding/cronyaml/blob/main/example.yaml)
and [`examples/remote/hello.js`](https://github.com/NaoCoding/cronyaml/blob/main/examples/remote/hello.js).

`hello_remote` downloads the JavaScript file, infers the `node` runtime from
`.js`, and passes an argument to it:

```bash
npx cronyaml validate --file example.yaml
npx cronyaml exec hello_remote --file example.yaml
npx cronyaml run --file example.yaml
```

The root file also contains `hello`, a local shell command. Remote downloads
are fresh by default; add `use-cached: true` when an older cached script is an
acceptable offline fallback.

## Gmail OAuth sender

Files: [`examples/gmail/cron.yaml`](https://github.com/NaoCoding/cronyaml/blob/main/examples/gmail/cron.yaml),
[`send-email.js`](https://github.com/NaoCoding/cronyaml/blob/main/examples/gmail/send-email.js),
and [`get-refresh-token.js`](https://github.com/NaoCoding/cronyaml/blob/main/examples/gmail/get-refresh-token.js).

This example combines a remote Node.js script, environment interpolation,
timeout, and `concurrency.policy: forbid`.

1. Enable the Gmail API and create a desktop OAuth client in Google Cloud.
2. Run the refresh-token helper and approve the `gmail.send` permission.
3. Copy `.env.example` to `examples/gmail/.env` and fill in the credentials.
4. Build and validate the config, then execute it once:

```powershell
npm run build
node dist\cli\index.js validate --file examples/gmail/cron.yaml
node dist\cli\index.js exec gmail-example --file examples/gmail/cron.yaml
```

Read the [Gmail example README](https://github.com/NaoCoding/cronyaml/blob/main/examples/gmail/README.md)
for the complete Google Cloud setup. Never commit a client secret or refresh
token.

## Google Forms response poller

Files: [`examples/google-form/cron.yaml`](https://github.com/NaoCoding/cronyaml/blob/main/examples/google-form/cron.yaml),
[`get-new-responses.js`](https://github.com/NaoCoding/cronyaml/blob/main/examples/google-form/get-new-responses.js),
and [`README.md`](https://github.com/NaoCoding/cronyaml/blob/main/examples/google-form/README.md).

The poller runs every ten seconds, uses the Google Forms API timestamp filter,
and prints the `respondentEmail` values from the preceding ten-second window as
a JSON array. That output can feed a follow-up job with
`for_each: "{{ result.stdout }}"`.
