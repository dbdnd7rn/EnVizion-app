export const MIN_PASSWORD_LENGTH = 12;

export type AuthCallback = {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function passwordValidationMessage(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }

  return null;
}

export function parseAuthCallback(url: string): AuthCallback {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams;
    const hash = new URLSearchParams(
      parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash,
    );
    const value = (key: string) => hash.get(key) ?? query.get(key);

    return {
      accessToken: value("access_token"),
      refreshToken: value("refresh_token"),
      type: value("type"),
      error: value("error"),
      errorDescription: value("error_description"),
    };
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      type: null,
      error: "invalid_callback_url",
      errorDescription: "The authentication link could not be read.",
    };
  }
}

export function isPasswordRecoveryCallback(callback: AuthCallback) {
  return callback.type === "recovery";
}

export const AUTH_REQUEST_TIMEOUT_MS = 20_000;
export const AUTH_STARTUP_TIMEOUT_MS = 12_000;

export class AuthTimeoutError extends Error {
  constructor() {
    super("Authentication request timed out.");
    this.name = "AuthTimeoutError";
  }
}

/** A timeout does not imply that the remote auth request was rejected. */
export async function withAuthTimeout<T>(request: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new AuthTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
