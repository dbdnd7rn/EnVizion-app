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
    [authMessage, loading, recoveryMode, session],
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
          <Txt style={{ color: C.rose }} accessibilityRole="alert">
            {message}
          </Txt>
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
        if (error) setMessage(error);
      } else {
        const result = await signUp(fullName, email, password);
        if (result.error) {
          setMessage(result.error);
        } else if (result.needsConfirmation) {
          const normalized = normalizeEmail(email);
          setPendingConfirmationEmail(normalized);
          setMessage(
            "Check your email to confirm your account, then return here and sign in.",
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
          : "A new confirmation email has been sent. The older link may no longer be useful.",
      );
    } finally {
      setBusy(false);
    }
  }

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
          <Txt
            accessibilityRole="alert"
            style={{ color: successMessage ? C.green : C.rose }}
          >
            {message}
          </Txt>
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

      {busy && <ActivityIndicator color={C.purple} />}

      <Txt style={[S.small, { textAlign: "center" }]}>
        Your account protects access to saved care information and authorized
        staff tools. EnVizion Life does not replace emergency or professional
        medical care.
      </Txt>
    </Page>
  );
}
