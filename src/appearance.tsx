import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setActiveAppearance, type AppearanceMode } from "./themeColors";

const STORAGE_KEY = "@envizion-life/appearance/mode/v1";
type AppearanceContextValue = {
  mode: AppearanceMode;
  dark: boolean;
  ready: boolean;
  saveError: string | null;
  setMode: (value: AppearanceMode) => Promise<void>;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, updateMode] = useState<AppearanceMode>("light");
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const next: AppearanceMode = stored === "dark" ? "dark" : "light";
        setActiveAppearance(next);
        updateMode(next);
      })
      .catch(() => { /* Existing light appearance is the safe fallback. */ })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setMode = useCallback(async (next: AppearanceMode) => {
    setActiveAppearance(next);
    updateMode(next);
    setSaveError(null);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      setSaveError("Display changed for now, but could not be saved on this device.");
    }
  }, []);

  const value = useMemo<AppearanceContextValue>(() => ({
    mode, dark: mode === "dark", ready, saveError, setMode,
  }), [mode, ready, saveError, setMode]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be inside AppearanceProvider");
  return context;
}

/** Subscribe existing React Navigation screens without recreating them on theme changes. */
const wrapped = new WeakMap<React.ComponentType<any>, React.ComponentType<any>>();
export function themedScreen<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  const cached = wrapped.get(Screen);
  if (cached) return cached as React.ComponentType<P>;
  const Wrapped = (props: P) => {
    useAppearance();
    return <Screen {...props} />;
  };
  Wrapped.displayName = "Themed" + (Screen.displayName || Screen.name || "Screen");
  wrapped.set(Screen, Wrapped);
  return Wrapped;
}
