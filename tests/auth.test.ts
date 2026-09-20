import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
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
