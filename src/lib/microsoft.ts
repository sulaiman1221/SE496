import "server-only";

// Microsoft sign-in (OAuth 2.0 authorization code flow) and Microsoft Graph
// calls, for sending seat emails from an Outlook account.
//
// The account owner signs in once. Microsoft returns a refresh token, which is
// stored in the email_sender table and swapped for a short-lived access token
// each time emails are sent.

const SCOPES = "offline_access User.Read Mail.Send";
const GRAPH = "https://graph.microsoft.com/v1.0";

// Thrown when the stored sign-in no longer works (expired, revoked, or the
// password changed). The fix is to connect the account again.
export class MicrosoftSignInError extends Error {}

function config() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET. Add them to .env.",
    );
  }
  return { tenantId, clientId, clientSecret };
}

function tokenEndpoint(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

// Where Microsoft sends the browser back to after sign-in. Must match a
// redirect URI on the app registration exactly.
export function callbackUrl(requestUrl: string) {
  return new URL("/api/auth/microsoft/callback", requestUrl).toString();
}

export function signInUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
  const { tenantId, clientId } = config();
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    response_mode: "query",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    // Always show the account picker, so a different account can be connected.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

type Tokens = { accessToken: string; refreshToken: string };

async function requestTokens(params: Record<string, string>): Promise<Tokens> {
  const { tenantId, clientId, clientSecret } = config();
  const res = await fetch(tokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPES,
      ...params,
    }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = firstLine(body.error_description) ?? body.error ?? `HTTP ${res.status}`;
    if (body.error === "invalid_grant") throw new MicrosoftSignInError(message);
    throw new Error(`Microsoft sign-in failed: ${message}`);
  }
  if (!body.refresh_token) {
    throw new Error("Microsoft didn't return a refresh token. Check the offline_access permission.");
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

// Called once, when the account owner comes back from the Microsoft sign-in page.
export function exchangeCode(code: string, redirectUri: string) {
  return requestTokens({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

// Microsoft may return a new refresh token; the caller should store it.
export function refreshTokens(refreshToken: string) {
  return requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function getSignedInUser(accessToken: string) {
  const res = await fetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Couldn't read the Microsoft account: ${await graphError(res)}`);

  const me = await res.json();
  // mail is empty for some accounts; the sign-in name is the address then.
  return {
    email: (me.mail || me.userPrincipalName) as string,
    displayName: (me.displayName ?? null) as string | null,
  };
}

// Sends one email from the signed-in account. Exchange Online allows about
// 30 messages a minute per mailbox, so if Graph says to slow down, wait and
// try again.
// Attachments go inline in the request, which Graph caps at 4 MB in total.
export async function sendMail(
  accessToken: string,
  message: {
    to: string;
    subject: string;
    html: string;
    attachments?: { name: string; contentType: string; content: Uint8Array }[];
  },
) {
  const payload = JSON.stringify({
    message: {
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      toRecipients: [{ emailAddress: { address: message.to } }],
      attachments: (message.attachments ?? []).map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name,
        contentType: a.contentType,
        contentBytes: Buffer.from(a.content).toString("base64"),
      })),
    },
    saveToSentItems: true,
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${GRAPH}/me/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: payload,
      cache: "no-store",
    });
    if (res.ok) return;

    if (res.status === 429 && attempt < 2) {
      const seconds = Math.min(Number(res.headers.get("Retry-After")) || 10, 60);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (res.status === 401) throw new MicrosoftSignInError(await graphError(res));
    throw new Error(await graphError(res));
  }
}

async function graphError(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? `HTTP ${res.status}`;
}

// Microsoft error descriptions carry trace IDs and timestamps on later lines.
function firstLine(text: unknown) {
  return typeof text === "string" ? text.split(/\r?\n/)[0] : undefined;
}
