# Gmail example

This directory contains a complete remote-script configuration. The job
definition is in [`cron.yaml`](./cron.yaml), and the sender is in
[`send-email.js`](./send-email.js).

`send-email.js` refreshes a Gmail OAuth access token before each send, then
sends a plain-text message through the Gmail API. It uses Node.js 20's built-in
`fetch`, so no additional package is required.

## One-time Google Cloud setup

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the Gmail API for the project.
3. Configure the OAuth consent screen and add your Google account as a test user if the app is in testing mode.
4. Create an OAuth client with application type **Desktop app**.
5. Set the client credentials and run the helper:

```powershell
$env:GMAIL_CLIENT_ID = "your-oauth-client-id"
$env:GMAIL_CLIENT_SECRET = "your-oauth-client-secret"
node examples/gmail/get-refresh-token.js
```

Open the URL printed by the helper, approve the `gmail.send` permission, and
copy the printed `GMAIL_REFRESH_TOKEN` into `.env`. The helper uses
`access_type=offline` and `prompt=consent` so Google returns a refresh token.

## Run the sender

Copy the repository template next to this configuration and replace the Gmail
placeholders. CronYAML loads `.env` from the configuration directory:

```powershell
Copy-Item .env.example examples/gmail/.env
# Edit examples/gmail/.env before continuing.
```

Then run from the repository root:

```powershell
npm run build
node dist\cli\index.js validate --file examples/gmail/cron.yaml
node dist\cli\index.js exec gmail-example --file examples/gmail/cron.yaml
```

The same job can be scheduled with:

```powershell
node dist\cli\index.js run --file examples/gmail/cron.yaml
```

The Gmail account that authorized the refresh token is used as the sender.
Never commit the client secret or refresh token. If either is exposed, revoke
the credential from your Google Account security settings.

See the [examples guide](../../doc/examples.md) for the other bundled examples
and the [configuration reference](../../doc/configuration.md) for the fields
used by this job.
