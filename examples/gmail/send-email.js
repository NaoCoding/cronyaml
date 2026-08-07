#!/usr/bin/env node

/**
 * Send a plain-text email through the Gmail API.
 *
 * Required environment variables:
 *   GMAIL_ACCESS_TOKEN - OAuth 2.0 access token with gmail.send scope
 *   GMAIL_TO           - recipient email address
 *
 * Optional environment variables:
 *   GMAIL_SUBJECT      - email subject
 *   GMAIL_BODY         - email body
 */

const accessToken = process.env.GMAIL_ACCESS_TOKEN;
const to = process.env.GMAIL_TO;
const subject = process.env.GMAIL_SUBJECT ?? "Email sent by CronYAML";
const body = process.env.GMAIL_BODY ?? "Hello from CronYAML!";

if (!accessToken || !to) {
  console.error(
    "[Gmail] Set GMAIL_ACCESS_TOKEN and GMAIL_TO before running this script."
  );
  process.exit(1);
}

if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
  console.error("[Gmail] GMAIL_TO and GMAIL_SUBJECT cannot contain line breaks.");
  process.exit(1);
}

const rawMessage = [
  `To: ${to}`,
  `Subject: ${subject}`,
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="UTF-8"',
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from(body, "utf8").toString("base64"),
].join("\r\n");

const raw = Buffer.from(rawMessage, "utf8")
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const response = await fetch(
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  }
);

if (!response.ok) {
  const error = await response.text();
  console.error(`[Gmail] API request failed (${response.status}): ${error}`);
  process.exit(1);
}

const result = await response.json();
console.log(`[Gmail] Email sent to ${to}. Message ID: ${result.id}`);
