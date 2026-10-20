import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";
import { secureStoreKey } from "./secureStoreKey";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const nativeStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(secureStoreKey(key)),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(secureStoreKey(key), value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    }),
  removeItem: (key: string) =>
    SecureStore.deleteItemAsync(secureStoreKey(key)),
};

const webStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: Platform.OS === "web" ? webStorage : nativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
