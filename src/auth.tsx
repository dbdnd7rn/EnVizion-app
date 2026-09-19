import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Brand, Button, C, Card, Heading, Page, S, Txt } from "./ui";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return error?.message ?? null;
      },
      async signUp(fullName, email, password) {
        const redirectTo =
          Platform.OS === "web" && typeof window !== "undefined"
            ? window.location.origin
            : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: redirectTo,
          },
        });

        return {
          error: error?.message ?? null,
          needsConfirmation: !data.session && Boolean(data.user),
        };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Missing AuthProvider");
  return context;
}

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    if (!email.trim() || password.length < 8 || (mode === "signup" && !fullName.trim())) {
      setMessage(
        mode === "signup"
          ? "Enter your name, email, and a password with at least 8 characters."
          : "Enter your email and password.",
      );
      return;
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
          setMessage(
            "Check your email to confirm your account, then return here and sign in.",
          );
          setMode("signin");
        }
      }
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
        eyebrow="ENVIZION LIFE"
        title={mode === "signin" ? "Welcome back." : "Create your EnVizion Life account."}
        body={
          mode === "signin"
            ? "Sign in to securely continue your EnVizion Life workspace."
            : "Your account keeps your EnVizion Life access connected across visits."
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
            placeholder="At least 8 characters"
            placeholderTextColor="#AAA0AF"
          />
        </View>

        {Boolean(message) && (
          <Txt
            style={{
              color: message.toLowerCase().includes("check your email")
                ? C.green
                : C.rose,
            }}
          >
            {message}
          </Txt>
        )}

        <Button
          title={
            busy
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"
          }
          disabled={busy}
          onPress={submit}
        />
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMessage("");
          setMode(mode === "signin" ? "signup" : "signin");
        }}
        style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
      >
        <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
          {mode === "signin"
            ? "New to EnVizion Life? Create an account"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>

      {busy && <ActivityIndicator color={C.purple} />}

      <Txt style={[S.small, { textAlign: "center" }]}>
        Your account protects access to saved care information and authorized staff tools. EnVizion Life
        does not replace emergency or professional medical care.
      </Txt>
    </Page>
  );
}
