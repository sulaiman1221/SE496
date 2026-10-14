import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, signInUrl } from "@/lib/microsoft";
import { OAUTH_COOKIE, safeReturnPath } from "./shared";

// Starts connecting the Outlook account that seat emails are sent from:
// sends the browser to Microsoft's sign-in page. Microsoft sends it back to
// ./callback afterwards.
export function GET(request: NextRequest) {
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  // Checked in the callback, so only sign-ins started here are accepted.
  const state = crypto.randomUUID();

  const response = NextResponse.redirect(
    signInUrl({ state, redirectUri: callbackUrl(request.url) }),
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/auth/microsoft",
    maxAge: 10 * 60,
  });
  return response;
}
