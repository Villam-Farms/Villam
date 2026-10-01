import { authErrorMessage, validAuthEmail } from "@/lib/auth-errors";

describe("authentication error messages", () => {
  it.each([
    ["Invalid login credentials", "The email or password is incorrect. Please try again."],
    ["Email not confirmed", "Confirm your email address before logging in. Check your inbox for the confirmation email."],
    ["User already registered", "An account with this email already exists. Log in instead."],
    ["Too many requests", "Too many attempts. Please wait a few minutes and try again."],
    ["Weak password", "Choose a stronger password that meets the account password requirements."],
    ["Network request failed", "Unable to connect. Check your internet connection and try again."],
  ])("explains %s", (error, expected) => {
    expect(authErrorMessage(error, "Try again")).toBe(expected);
    expect(authErrorMessage(new Error(error), "Try again")).toBe(expected);
  });
  it("does not expose unexpected internal errors", () => {
    expect(authErrorMessage(new Error("Database secret details"), "Try again")).toBe("Try again");
    expect(authErrorMessage(null, "Try again")).toBe("Try again");
  });
  it.each(["", "ada", "ada@", "ada example@farm.com", "ada@farm"])("rejects invalid email %s", email => {
    expect(validAuthEmail(email)).toBe(false);
  });
  it("accepts a complete email", () => expect(validAuthEmail("ada+farm@example.com")).toBe(true));
});
