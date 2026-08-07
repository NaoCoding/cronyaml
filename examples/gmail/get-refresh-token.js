#!/usr/bin/env node

/**
 * One-time helper for obtaining a Gmail OAuth refresh token.
 *
 * Use an OAuth client of type "Desktop app". The script prints an OAuth URL,
 * receives the local callback, and prints the refresh token for .env.
 */

import { createServer } from "node:http";

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const scope = "https://www.googleapis.com/auth/gmail.send";

if (!clientId || !clientSecret) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.");
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const callbackUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (callbackUrl.pathname !== "/oauth2callback") {
    response.writeHead(404).end("Not found");
    return;
  }

  const error = callbackUrl.searchParams.get("error");
  const code = callbackUrl.searchParams.get("code");
  if (error || !code) {
    response.writeHead(400).end("Authorization failed. You can close this tab.");
    server.close();
    console.error(`[Gmail] Authorization failed: ${error ?? "no authorization code"}`);
    process.exitCode = 1;
    return;
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    response.writeHead(500).end("Could not determine callback address.");
    server.close();
    process.exitCode = 1;
    return;
  }

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Authorization complete. You can close this tab.");
  server.close();

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenResult = await tokenResponse.json();

  if (!tokenResponse.ok || typeof tokenResult.refresh_token !== "string") {
    console.error(
      `[Gmail] Google token exchange failed (${tokenResponse.status}): ${JSON.stringify(tokenResult)}`
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nAdd this value to your .env file:");
  console.log(`GMAIL_REFRESH_TOKEN=${tokenResult.refresh_token}`);
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("Could not determine the local OAuth callback address.");
    process.exit(1);
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  }).toString();

  console.log("Open this URL in your browser:");
  console.log(authorizationUrl.toString());
  console.log("\nWaiting for the OAuth callback...");
});
