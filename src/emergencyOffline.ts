import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { EmergencyCenterData } from "./emergencyCenter";

export type EmergencyOfflineSummary = {
  version: 1;
  careRecipientId: string;
  cachedAt: string;
  recipientName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  localEmergencyNumber: string;
  preferredHospital: string;
  allergies: string;
  importantConditions: string;
  medicalDevices: string;
  bloodType: string;
  primaryLanguage: string;
  codeStatus: string;
  dnrLocation: string;
  advanceDirectiveLocation: string;
  poaStatus: string;
  poaName: string;
  poaPhone: string;
  emergencyNotes: string;
  medications: Array<{
    name: string;
    dose: string;
    route: string;
    instructions: string;
    isPrn: boolean;
  }>;
};

function key(careRecipientId: string) {
  return `envizion:emergency-offline:${careRecipientId}`;
}

function trim(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function buildEmergencyOfflineSummary(
  careRecipientId: string,
  data: EmergencyCenterData,
): EmergencyOfflineSummary {
  const profile = data.profile;

  return {
    version: 1,
    careRecipientId,
    cachedAt: new Date().toISOString(),
    recipientName: trim(data.recipient.displayName, 160),
    emergencyContactName: trim(data.recipient.emergencyContactName, 160),
    emergencyContactPhone: trim(data.recipient.emergencyContactPhone, 80),
    localEmergencyNumber: trim(profile?.localEmergencyNumber, 80),
    preferredHospital: trim(profile?.preferredHospital, 240),
    allergies: trim(profile?.allergies, 900),
    importantConditions: trim(profile?.importantConditions, 900),
    medicalDevices: trim(profile?.medicalDevices, 700),
    bloodType: trim(profile?.bloodType, 40),
    primaryLanguage: trim(profile?.primaryLanguage, 120),
    codeStatus: trim(profile?.codeStatus || "unknown", 40),
    dnrLocation: trim(profile?.dnrLocation, 500),
    advanceDirectiveLocation: trim(profile?.advanceDirectiveLocation, 500),
    poaStatus: trim(profile?.poaStatus || "unknown", 40),
    poaName: trim(profile?.poaName, 160),
    poaPhone: trim(profile?.poaPhone, 80),
    emergencyNotes: trim(profile?.emergencyNotes, 900),
    medications: data.medications.slice(0, 18).map((medication) => ({
      name: trim(medication.name, 120),
      dose: trim(medication.dose, 80),
      route: trim(medication.route, 80),
      instructions: trim(medication.instructions, 220),
      isPrn: Boolean(medication.isPrn),
    })),
  };
}

async function setValue(storageKey: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(storageKey, value);
    return;
  }
  await SecureStore.setItemAsync(storageKey, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getValue(storageKey: string) {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(storageKey);
  }
  return SecureStore.getItemAsync(storageKey);
}

export async function cacheEmergencyOfflineSummary(
  careRecipientId: string,
  data: EmergencyCenterData,
) {
  const summary = buildEmergencyOfflineSummary(careRecipientId, data);
  let encoded = JSON.stringify(summary);

  if (encoded.length > 7_000) {
    summary.medications = summary.medications.slice(0, 10);
    summary.allergies = summary.allergies.slice(0, 500);
    summary.importantConditions = summary.importantConditions.slice(0, 500);
    summary.emergencyNotes = summary.emergencyNotes.slice(0, 500);
    encoded = JSON.stringify(summary);
  }

  await setValue(key(careRecipientId), encoded);
  return summary;
}

export async function loadEmergencyOfflineSummary(
  careRecipientId: string,
): Promise<EmergencyOfflineSummary | null> {
  const encoded = await getValue(key(careRecipientId));
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(encoded) as EmergencyOfflineSummary;
    if (parsed?.version !== 1 || parsed.careRecipientId !== careRecipientId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearEmergencyOfflineSummary(careRecipientId: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key(careRecipientId));
    return;
  }
  await SecureStore.deleteItemAsync(key(careRecipientId));
}
