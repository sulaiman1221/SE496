import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, exchangeCode, getSignedInUser } from "@/lib/microsoft";
import { createServerClient } from "@/lib/supabase/server";
import { OAUTH_COOKIE, safeReturnPath } from "../shared";

// Microsoft sends the browser here after sign-in. Swaps the one-time code for
// tokens and saves the account as the seat email sender, then goes back to
// the page the sign-in started from.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const saved = readCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const returnTo = safeReturnPath(saved?.returnTo);

  const back = (emailError?: string) => {
    const url = new URL(returnTo, request.url);
    if (emailError) url.searchParams.set("emailError", emailError);
    const response = NextResponse.redirect(url);
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/microsoft" });
    return response;
  };

  const error = params.get("error");
  if (error) {
    return back(
      error === "access_denied"
        ? "The Microsoft sign-in was cancelled."
        : `Microsoft sign-in failed: ${params.get("error_description")?.split(/\r?\n/)[0] ?? error}`,
    );
  }

  const code = params.get("code");
  if (!code || !saved || params.get("state") !== saved.state) {
    return back("The Microsoft sign-in expired. Try connecting again.");
  }

  try {
    const tokens = await exchangeCode(code, callbackUrl(request.url));
    const user = await getSignedInUser(tokens.accessToken);

    const supabase = createServerClient();
    const { error: saveError } = await supabase.from("email_sender").upsert({
      id: true,
      email: user.email,
      display_name: user.displayName,
      refresh_token: tokens.refreshToken,
    });
    if (saveError) throw new Error(`Couldn't save the account: ${saveError.message}`);
  } catch (e) {
    console.error(e);
    return back(e instanceof Error ? e.message : "Couldn't connect the Outlook account.");
  }

  return back();
}

function readCookie(value: string | undefined): { state: string; returnTo: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.state === "string" ? parsed : null;
  } catch {
    return null;
  }
}
