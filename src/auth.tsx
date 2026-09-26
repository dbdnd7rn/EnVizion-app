import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import { supabase } from "./supabase";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordRecoveryCallback,
  normalizeEmail,
  parseAuthCallback,
  passwordValidationMessage,
} from "./authHelpers";
import { Brand, Button, C, Card, Heading, Page, S, Txt } from "./ui";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  recoveryMode: boolean;
  authMessage: string;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signInWithGoogleIdToken: (idToken: string) => Promise<string | null>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
  completePasswordRecovery: (password: string) => Promise<string | null>;
  cancelPasswordRecovery: () => Promise<void>;
  clearAuthMessage: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityButtonText = "signin_with" | "signup_with";

type GoogleIdentityApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard";
      theme?: "outline";
      size?: "large";
      text?: GoogleIdentityButtonText;
      shape?: "rectangular";
      logo_alignment?: "left";
      width?: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  }
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        fill="#FFC107"
        d="M43.611 20H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-4Z"
      />
      <Path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691Z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20H42V20H24v8h11.303a12.03 12.03 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-4Z"
      />
    </Svg>
  );
}

WebBrowser.maybeCompleteAuthSession();

function redirectUrl(kind: "confirm" | "recovery") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = new URL(window.location.origin);
    url.searchParams.set("auth", kind);
    return url.toString();
  }

  return kind === "recovery"
    ? "envizionlife://auth/reset-password"
    : "envizionlife://auth/confirmed";
}

function isDefinitiveSessionError(error: { status?: number } | null) {
  return error?.status === 401 || error?.status === 403;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const applyNativeAuthUrl = useCallback(async (url: string) => {
    const callback = parseAuthCallback(url);

    if (callback.error) {
      setAuthMessage(
        callback.errorDescription ||
          "This authentication link is invalid or has expired. Request a new link and try again.",
      );
      return;
    }

    if (!callback.accessToken || !callback.refreshToken) {
      return;
    }

    const { error } = await supabase.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });

    if (error) {
      setAuthMessage(
        "This authentication link could not be completed. Request a new link and try again.",
      );
      return;
    }

    if (isPasswordRecoveryCallback(callback)) {
      setRecoveryMode(true);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const {
        data: { session: storedSession },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (storedSession) {
        const { error } = await supabase.auth.getUser();
        if (isDefinitiveSessionError(error)) {
          await supabase.auth.signOut({ scope: "local" });
          if (!active) return;
          setSession(null);
          setAuthMessage("Your session expired. Sign in again to continue.");
        } else {
          setSession(storedSession);
        }
      } else {
        setSession(null);
      }

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        isPasswordRecoveryCallback(parseAuthCallback(window.location.href))
      ) {
        setRecoveryMode(true);
      }

      if (active) setLoading(false);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, nextSession: Session | null) => {
        setSession(nextSession);

        if (event === "PASSWORD_RECOVERY") {
          setRecoveryMode(true);
        }

        if (event === "SIGNED_OUT") {
          setRecoveryMode(false);
        }

        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;

    Linking.getInitialURL().then((url) => {
      if (active && url) void applyNativeAuthUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void applyNativeAuthUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [applyNativeAuthUrl]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recoveryMode,
      authMessage,
      async signIn(email, password) {
        setAuthMessage("");
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        return error?.message ?? null;
      },
      async signInWithGoogle() {
        setAuthMessage("");
        const returnUrl = redirectUrl("confirm");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: returnUrl,
            skipBrowserRedirect: Platform.OS !== "web",
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });

        if (error) return error.message;
        if (Platform.OS === "web") return null;
        if (!data.url) return "Google sign-in could not be started.";

        const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
        if (result.type === "cancel" || result.type === "dismiss") return null;
        if (result.type !== "success" || !result.url) {
          return "Google sign-in did not finish. Please try again.";
        }

        await applyNativeAuthUrl(result.url);
        return null;
      },
      async signInWithGoogleIdToken(idToken) {
        setAuthMessage("");
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        return error?.message ?? null;
      },
      async signUp(fullName, email, password) {
        setAuthMessage("");
        const passwordIssue = passwordValidationMessage(password);
        if (passwordIssue) {
          return { error: passwordIssue, needsConfirmation: false };
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizeEmail(email),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: redirectUrl("confirm"),
          },
        });

        return {
          error: error?.message ?? null,
          needsConfirmation: !data.session && Boolean(data.user),
        };
      },
      async requestPasswordReset(email) {
        setAuthMessage("");
        const { error } = await supabase.auth.resetPasswordForEmail(
          normalizeEmail(email),
          { redirectTo: redirectUrl("recovery") },
        );
        return error?.message ?? null;
      },
      async resendConfirmation(email) {
        setAuthMessage("");
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: normalizeEmail(email),
          options: { emailRedirectTo: redirectUrl("confirm") },
        });
        return error?.message ?? null;
      },
      async completePasswordRecovery(password) {
        const passwordIssue = passwordValidationMessage(password);
        if (passwordIssue) return passwordIssue;

        const { error } = await supabase.auth.updateUser({ password });
        if (error) return error.message;

        setRecoveryMode(false);
        setAuthMessage("Password updated. Sign in again with your new password.");
        await supabase.auth.signOut({ scope: "global" });
        return null;
      },
      async cancelPasswordRecovery() {
        setRecoveryMode(false);
        await supabase.auth.signOut({ scope: "local" });
      },
      clearAuthMessage() {
        setAuthMessage("");
      },
      async signOut() {
        setRecoveryMode(false);
        setAuthMessage("");
        await supabase.auth.signOut();
      },
    }),
    [applyNativeAuthUrl, authMessage, loading, recoveryMode, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Missing AuthProvider");
  return context;
}

export function PasswordRecoveryScreen() {
  const {
    completePasswordRecovery,
    cancelPasswordRecovery,
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");

    const passwordIssue = passwordValidationMessage(password);
    if (passwordIssue) {
      setMessage(passwordIssue);
      return;
    }

    if (password !== confirm) {
      setMessage("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const error = await completePasswordRecovery(password);
      if (error) setMessage(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <View style={{ alignItems: "flex-start" }}>
        <Brand />
      </View>

      <Heading
        eyebrow="ACCOUNT RECOVERY"
        title="Choose a new password."
        body="Use a new password you have not used for this account before."
      />

      <Card style={{ gap: 15 }}>
        <View style={{ gap: 8 }}>
          <Text style={[S.h3, { fontSize: 13 }]}>New password</Text>
          <TextInput
            accessibilityLabel="New password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            style={S.input}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor="#AAA0AF"
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[S.h3, { fontSize: 13 }]}>Confirm new password</Text>
          <TextInput
            accessibilityLabel="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            style={S.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#AAA0AF"
          />
        </View>

        {Boolean(message) && (
          <Text
            accessibilityRole="alert"
            style={[S.body, { color: C.rose }]}
          >
            {message}
          </Text>
        )}

        <Button
          title={busy ? "Updating password…" : "Update password"}
          disabled={busy}
          onPress={() => void save()}
        />
        <Button
          title="Cancel recovery"
          secondary
          disabled={busy}
          onPress={() => void cancelPasswordRecovery()}
        />
      </Card>

      <Txt style={[S.small, { textAlign: "center" }]}>
        For security, EnVizion Life signs you out after the password is changed.
        Sign in again using the new password.
      </Txt>
    </Page>
  );
}

export function AuthScreen() {
  const {
    signIn,
    signInWithGoogle,
    signInWithGoogleIdToken,
    signUp,
    requestPasswordReset,
    resendConfirmation,
    authMessage,
    clearAuthMessage,
  } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");

  useEffect(() => {
    if (authMessage) setMessage(authMessage);
  }, [authMessage]);

  function switchMode(nextMode: "signin" | "signup" | "forgot") {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    clearAuthMessage();
  }

  async function submit() {
    setMessage("");

    if (mode === "forgot") {
      if (!email.trim()) {
        setMessage("Enter your email address.");
        return;
      }

      setBusy(true);
      try {
        const error = await requestPasswordReset(email);
        if (error) {
          setMessage(error);
        } else {
          setMessage(
            "If an EnVizion Life account exists for that email, a password-reset link has been sent.",
          );
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    if (
      !email.trim() ||
      !password ||
      (mode === "signup" && !fullName.trim())
    ) {
      setMessage(
        mode === "signup"
          ? "Enter your name, email, and password."
          : "Enter your email and password.",
      );
      return;
    }

    if (mode === "signup") {
      const passwordIssue = passwordValidationMessage(password);
      if (passwordIssue) {
        setMessage(passwordIssue);
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const error = await signIn(email, password);
        if (error) {
          if (error.toLowerCase().includes("email not confirmed")) {
            setPendingConfirmationEmail(normalizeEmail(email));
            setMessage(
              "Your email address still needs confirmation. Check your inbox and spam folder, or request a new confirmation email below.",
            );
          } else {
            setPendingConfirmationEmail("");
            setMessage(error);
          }
        }
      } else {
        const result = await signUp(fullName, email, password);
        if (result.error) {
          setMessage(result.error);
        } else if (result.needsConfirmation) {
          setPendingConfirmationEmail("");
          setMessage(
            "Account request accepted. Check your inbox and spam folder, then return here and sign in. If this address already has an account, use your existing password instead.",
          );
          setMode("signin");
          setPassword("");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pendingConfirmationEmail) return;

    setBusy(true);
    setMessage("");
    try {
      const error = await resendConfirmation(pendingConfirmationEmail);
      setMessage(
        error
          ? error
          : "Request accepted. If this account is still awaiting confirmation, a new email will be sent. Check your spam folder too. If you already confirmed this address, sign in with your password instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    setMessage("");
    try {
      const error = await signInWithGoogle();
      if (error) setMessage(error);
    } finally {
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      mode === "forgot" ||
      !GOOGLE_WEB_CLIENT_ID ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    let cancelled = false;

    function renderGoogleButton() {
      if (cancelled) return;

      const googleIdentity = window.google?.accounts?.id;
      const container = document.getElementById("envizion-google-signin");
      if (!googleIdentity || !container) return;

      container.innerHTML = "";
      googleIdentity.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        auto_select: false,
        callback: (response) => {
          if (!response.credential) {
            setMessage("Google sign-in did not return a valid credential.");
            return;
          }

          setGoogleBusy(true);
          setMessage("");
          void signInWithGoogleIdToken(response.credential)
            .then((error) => {
              if (error) setMessage(error);
            })
            .finally(() => {
              setGoogleBusy(false);
            });
        },
      });

      googleIdentity.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
      });
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-envizion-google-identity="true"]',
    );

    if (existingScript) {
      if (window.google?.accounts?.id) {
        renderGoogleButton();
      } else {
        existingScript.addEventListener("load", renderGoogleButton, {
          once: true,
        });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.envizionGoogleIdentity = "true";
      script.addEventListener("load", renderGoogleButton, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [mode, signInWithGoogleIdToken]);

  const successMessage =
    message.toLowerCase().includes("check your email") ||
    message.toLowerCase().includes("has been sent") ||
    message.toLowerCase().includes("password updated");

  return (
    <Page>
      <View style={{ alignItems: "flex-start" }}>
        <Brand />
      </View>

      <Heading
        eyebrow="ENVIZION LIFE"
        title={
          mode === "signin"
            ? "Welcome back."
            : mode === "signup"
              ? "Create your EnVizion Life account."
              : "Reset your password."
        }
        body={
          mode === "signin"
            ? "Sign in to securely continue your EnVizion Life workspace."
            : mode === "signup"
              ? "Your account keeps your authorized care access connected across visits."
              : "Enter your email and we’ll send a recovery link. We won’t reveal whether an account exists."
        }
      />

      <Card style={{ gap: 15 }}>
        {mode === "signup" && (
          <View style={{ gap: 8 }}>
            <Text style={[S.h3, { fontSize: 13 }]}>Your name</Text>
            <TextInput
              accessibilityLabel="Your name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              style={S.input}
              placeholder="Your name"
              placeholderTextColor="#AAA0AF"
            />
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Text style={[S.h3, { fontSize: 13 }]}>Email address</Text>
          <TextInput
            accessibilityLabel="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            style={S.input}
            placeholder="you@example.com"
            placeholderTextColor="#AAA0AF"
          />
        </View>

        {mode !== "forgot" && (
          <View style={{ gap: 8 }}>
            <Text style={[S.h3, { fontSize: 13 }]}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              secureTextEntry
              style={S.input}
              placeholder={
                mode === "signup"
                  ? `At least ${MIN_PASSWORD_LENGTH} characters`
                  : "Your password"
              }
              placeholderTextColor="#AAA0AF"
            />
          </View>
        )}

        {Boolean(message) && (
          <Text
            accessibilityRole="alert"
            style={[S.body, { color: successMessage ? C.green : C.rose }]}
          >
            {message}
          </Text>
        )}

        <Button
          title={
            busy
              ? mode === "signin"
                ? "Signing in…"
                : mode === "signup"
                  ? "Creating account…"
                  : "Sending recovery link…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send recovery link"
          }
          disabled={busy}
          onPress={() => void submit()}
        />

        {mode !== "forgot" && (
          <>
            <View
              accessibilityElementsHidden
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ height: 1, flex: 1, backgroundColor: C.line }} />
              <Text style={[S.small, { color: C.muted }]}>or</Text>
              <View style={{ height: 1, flex: 1, backgroundColor: C.line }} />
            </View>
            {Platform.OS === "web" && GOOGLE_WEB_CLIENT_ID ? (
              <View
                style={{
                  minHeight: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy || googleBusy ? 0.55 : 1,
                }}
                pointerEvents={busy || googleBusy ? "none" : "auto"}
              >
                <View
                  nativeID="envizion-google-signin"
                  style={{
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  mode === "signup" ? "Sign up with Google" : "Sign in with Google"
                }
                disabled={busy || googleBusy}
                onPress={() => void continueWithGoogle()}
                style={({ pressed }) => ({
                  minHeight: 52,
                  borderRadius: 15,
                  borderWidth: 1,
                  borderColor: C.line,
                  backgroundColor: pressed ? "#F7F1F8" : C.white,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 11,
                  opacity: busy || googleBusy ? 0.55 : 1,
                })}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GoogleLogo size={22} />
                </View>
                <Text style={[S.h3, { color: C.ink, fontSize: 14 }]}>
                  {googleBusy
                    ? "Opening Google…"
                    : mode === "signup"
                      ? "Sign up with Google"
                      : "Sign in with Google"}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {mode === "signin" && pendingConfirmationEmail && (
          <Button
            title="Resend confirmation email"
            secondary
            disabled={busy}
            onPress={() => void resend()}
          />
        )}
      </Card>

      {mode === "signin" && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode("forgot")}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
              Forgot your password?
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode("signup")}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
              New to EnVizion Life? Create an account
            </Text>
          </Pressable>
        </>
      )}

      {mode === "signup" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => switchMode("signin")}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Already have an account? Sign in
          </Text>
        </Pressable>
      )}

      {mode === "forgot" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => switchMode("signin")}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Back to sign in
          </Text>
        </Pressable>
      )}

      {(busy || googleBusy) && <ActivityIndicator color={C.purple} />}

      <Txt style={[S.small, { textAlign: "center" }]}>
        Your account protects access to saved care information and authorized
        staff tools. EnVizion Life does not replace emergency or professional
        medical care.
      </Txt>
    </Page>
  );
}
