import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MIN_PASSWORD_LENGTH,
  AuthTimeoutError,
  withAuthTimeout,
  isPasswordRecoveryCallback,
  normalizeEmail,
  parseAuthCallback,
  passwordValidationMessage,
} from "../src/authHelpers.ts";

test("auth helpers normalize email without changing password data", () => {
  assert.equal(normalizeEmail("  Caregiver@Example.COM  "), "caregiver@example.com");
});

test("new passwords use a length-first requirement", () => {
  assert.ok(passwordValidationMessage("short"));
  assert.equal(
    passwordValidationMessage("x".repeat(MIN_PASSWORD_LENGTH)),
    null,
  );
});

test("native recovery callbacks parse tokens from the URL fragment", () => {
  const callback = parseAuthCallback(
    "envizionlife://auth/reset-password#access_token=access123&refresh_token=refresh456&type=recovery",
  );
  assert.equal(callback.accessToken, "access123");
  assert.equal(callback.refreshToken, "refresh456");
  assert.equal(isPasswordRecoveryCallback(callback), true);
});

test("auth callbacks preserve provider errors without throwing", () => {
  const callback = parseAuthCallback(
    "envizionlife://auth/confirmed?error=access_denied&error_description=Link%20expired",
  );
  assert.equal(callback.error, "access_denied");
  assert.equal(callback.errorDescription, "Link expired");
});

test("auth requests finish normally before their timeout", async () => {
  assert.equal(await withAuthTimeout(Promise.resolve("ready"), 100), "ready");
});

test("stalled auth requests fail instead of spinning indefinitely", async () => {
  await assert.rejects(withAuthTimeout(new Promise<never>(() => {}), 5), AuthTimeoutError);
});

test("auth errors are not suppressed by timeout protection", async () => {
  await assert.rejects(withAuthTimeout(Promise.reject(new Error("test failure")), 100), /test failure/);
});

test("auth screens use one low-glare dark form palette with accessible copy", () => {
  const source = readFileSync(new URL("../src/auth.tsx", import.meta.url), "utf8");
  const darkSection = source.split("const AUTH_DARK = {")[1]?.split("} as const;")[0] ?? "";
  const getColor = (key: string) => {
    const match = darkSection.match(new RegExp("^\\s*" + key + ': "(#[0-9A-Fa-f]{6})"', "m"));
    assert.ok(match, "Missing dark auth token: " + key);
    return match[1];
  };
  const luminance = (value: string) => {
    const channels = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
    const rgb = channels.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  for (const [foreground, background] of [
    ["heading", "panel"], ["label", "panel"], ["inputText", "input"],
    ["placeholder", "input"], ["googleText", "google"],
  ]) {
    assert.ok(contrast(getColor(foreground), getColor(background)) >= 4.5,
      foreground + " on " + background + " must meet WCAG AA");
  }
  assert.ok(luminance(getColor("panel")) < 0.05, "dark mode panel must not become pale");
  assert.ok(luminance(getColor("google")) < 0.08, "Google button must not become white");
});

test("sign in, sign up, forgot, and password recovery reuse dark surfaces without altering auth flow", () => {
  const source = readFileSync(new URL("../src/auth.tsx", import.meta.url), "utf8");
  const form = source.split("export function AuthScreen()")[1] ?? "";
  const recovery = source.split("export function PasswordRecoveryScreen()")[1]?.split("function AuthBrandStatic()")[0] ?? "";
  assert.match(form, /const \{ dark \} = useAppearance\(\)/);
  assert.match(form, /backgroundColor: dark \? AUTH_DARK\.panel/);
  assert.match(form, /style=\{\[S\.input, authInputStyle/);
  assert.match(form, /backgroundColor: dark \? \(pressed \? AUTH_DARK\.googlePressed/);
  assert.match(form, /placeholderTextColor=\{authPlaceholderColor\}/);
  assert.match(recovery, /recoveryInputStyle/);
  assert.match(recovery, /AUTH_DARK\.panel/);
  for (const essential of [
    "signIn(email, password)", "signUp(fullName, email, password)", 
    "requestPasswordReset(email)", "signInWithGoogle()", "switchMode(\"signup\")",
    "switchMode(\"forgot\")", "resendConfirmation(pendingConfirmationEmail)",
  ]) assert.ok(form.includes(essential), essential);
});
