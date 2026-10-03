/** Turn common authentication failures into actionable messages without exposing internals. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "The email or password is incorrect. Please try again.";
  if (value.includes("email not confirmed")) return "Confirm your email address before logging in. Check your inbox for the confirmation email.";
  if (value.includes("already registered") || value.includes("user already exists")) return "An account with this email already exists. Log in instead.";
  if (value.includes("rate limit") || value.includes("too many requests")) return "Too many attempts. Please wait a few minutes and try again.";
  if (value.includes("weak password") || value.includes("password should")) return "Choose a stronger password that meets the account password requirements.";
  if (value.includes("fetch") || value.includes("network") || value.includes("connection")) return "Unable to connect. Check your internet connection and try again.";
  return fallback;
}

export function validAuthEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
