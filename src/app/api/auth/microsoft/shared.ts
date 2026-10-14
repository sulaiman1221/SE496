// Remembers the sign-in's state and where to go afterwards, between leaving
// for Microsoft and coming back.
export const OAUTH_COOKIE = "microsoft_oauth";

// Only same-site paths, so the sign-in can't be used to redirect elsewhere.
export function safeReturnPath(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/exams";
}
