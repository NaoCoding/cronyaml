#!/usr/bin/env node

/**
 * Send a plain-text email through the Gmail API.
 *
 * Required environment variables:
 *   GMAIL_CLIENT_ID     - OAuth 2.0 client ID
 *   GMAIL_CLIENT_SECRET - OAuth 2.0 client secret
 *   GMAIL_REFRESH_TOKEN - OAuth 2.0 refresh token with gmail.send scope
 *   GMAIL_TO            - recipient email address
 *
 * Optional environment variables:
 *   GMAIL_SUBJECT      - email subject
 *   GMAIL_BODY         - email body
 */

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
const to = process.env.GMAIL_TO;
const subject = process.env.GMAIL_SUBJECT ?? "Email sent by CronYAML";
const body = process.env.GMAIL_BODY ?? "Hello from CronYAML!";

if (!clientId || !clientSecret || !refreshToken || !to) {
  console.error(
    "[Gmail] Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_TO before running this script."
  );
  process.exit(1);
}

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});

const tokenResult = await tokenResponse.json();
if (!tokenResponse.ok || typeof tokenResult.access_token !== "string") {
  console.error(
    `Google token refresh failed (${tokenResponse.status}): ${JSON.stringify(tokenResult)}`
  );
  process.exit(1);
}

if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
  console.error("GMAIL_TO and GMAIL_SUBJECT cannot contain line breaks.");
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
      Authorization: `Bearer ${tokenResult.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  }
);

if (!response.ok) {
  const error = await response.text();
  console.error(`API request failed (${response.status}): ${error}`);
  process.exit(1);
}

const result = await response.json();
console.log(`Email sent to ${to}. Message ID: ${result.id}`);
