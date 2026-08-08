#!/usr/bin/env node

/**
 * Print answers to the form's first question from the last ten seconds as a
 * JSON array.
 *
 * Required environment variables:
 *   GOOGLE_FORM_ID
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN (created with forms.body.readonly and
 *                         forms.responses.readonly scopes)
 *
 * Optional first argument:
 *   regex_filter - only first-question answers matching this JavaScript regex
 *                  are output
 */

const formId = process.env.GOOGLE_FORM_ID;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const regexFilter = process.argv[2] ?? ".*";
let answerPattern;

try {
  answerPattern = new RegExp(regexFilter);
} catch (error) {
  console.error(`[Google Forms] Invalid regex_filter ${JSON.stringify(regexFilter)}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!formId || !clientId || !clientSecret || !refreshToken) {
  console.error(
    "[Google Forms] Set GOOGLE_FORM_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN before running this script."
  );
  process.exit(1);
}

async function getAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(`Google token refresh failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

async function getFirstQuestionId(accessToken) {
  const response = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Google Forms API failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  for (const item of Array.isArray(payload.items) ? payload.items : []) {
    const questionId = item.questionItem?.question?.questionId;
    if (typeof questionId === "string") return questionId;

    const groupedQuestionId = item.questionGroupItem?.questions?.[0]?.questionId;
    if (typeof groupedQuestionId === "string") return groupedQuestionId;
  }

  throw new Error("The Google Form does not contain a question.");
}

async function getRecentResponses(accessToken) {
  const since = new Date(Date.now() - 10_000).toISOString();
  const responses = [];
  let pageToken;

  do {
    const url = new URL(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`);
    url.searchParams.set("filter", `timestamp > ${since}`);
    url.searchParams.set("pageSize", "5000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Google Forms API failed (${response.status}): ${JSON.stringify(payload)}`);
    }

    if (Array.isArray(payload.responses)) responses.push(...payload.responses);
    pageToken = typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined;
  } while (pageToken);

  return responses;
}

function getAnswer(response, questionId) {
  const answer = response.answers?.[questionId];
  if (!answer) return undefined;

  if (Array.isArray(answer.textAnswers?.answers)) {
    const values = answer.textAnswers.answers
      .map((item) => item.value)
      .filter((value) => typeof value === "string");
    if (values.length === 1) return values[0];
    if (values.length > 1) return values;
  }

  if (Array.isArray(answer.fileUploadAnswers?.answers)) {
    const files = answer.fileUploadAnswers.answers
      .map((item) => item.fileName ?? item.fileId)
      .filter((value) => typeof value === "string");
    if (files.length === 1) return files[0];
    if (files.length > 1) return files;
  }

  return undefined;
}

function matchesAnswer(answer) {
  if (typeof answer === "string") return answerPattern.test(answer);
  return Array.isArray(answer) && answer.some((value) => typeof value === "string" && answerPattern.test(value));
}

try {
  const accessToken = await getAccessToken();
  const firstQuestionId = await getFirstQuestionId(accessToken);
  const responses = await getRecentResponses(accessToken);
  const answers = responses
    .map((response) => getAnswer(response, firstQuestionId))
    .filter((answer) => answer !== undefined && matchesAnswer(answer));

  // Keep stdout machine-readable: CronYAML exposes this as result.stdout.
  console.log(JSON.stringify(answers));
} catch (error) {
  console.error(`[Google Forms] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
