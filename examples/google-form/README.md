# Google Forms response poller

This example runs every ten seconds and prints the answers to the form's first
question from responses submitted in the preceding ten-second window as a JSON
array. The array is available to CronYAML as `result.stdout`, so it can be
passed to a follow-up job with `for_each: "{{ result.stdout }}"`. The included
follow-up job sends one Gmail notification per answer.

## Setup

1. Create or select a Google Cloud project and enable the Google Forms API.
2. Create an OAuth client of type **Desktop app**.
3. Copy the client ID and secret into the environment.
4. Find the form ID in `https://docs.google.com/forms/d/<FORM_ID>/edit`.
5. Generate a refresh token with both the Forms body and response read-only
scopes. The body scope is needed to discover which question is first:

```powershell
$env:GOOGLE_CLIENT_ID = "your-client-id"
$env:GOOGLE_CLIENT_SECRET = "your-client-secret"
node examples/google-form/get-refresh-token.js
```

6. Create `examples/google-form/.env` with:

```dotenv
GOOGLE_FORM_ID=your-form-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token
GMAIL_TO=notification-recipient@example.com
```

The Gmail refresh token must have the `gmail.send` scope. Text, choice, scale,
date, and time answers are returned as strings. Checkbox questions and file
upload questions may return an array when multiple values/files were submitted.

## Run

```powershell
npm run build
node dist\cli\index.js validate --file examples/google-form/cron.yaml
node dist\cli\index.js run --file examples/google-form/cron.yaml
```

The script writes only the JSON email array to stdout. Authentication and API
errors go to stderr and make the polling job fail. The disabled email job is
started by `if_success.for_each` and receives `GMAIL_TO`, `GMAIL_SUBJECT`, and
`GMAIL_BODY` through follow-up parameters.
