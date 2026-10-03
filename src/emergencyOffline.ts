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


function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function emergencyCodeStatusLabel(value: string) {
  return {
    unknown: "Not recorded",
    full_code: "Full code",
    dnr: "DNR",
    dni: "DNI",
    dnr_dni: "DNR / DNI",
    other: "Other directive",
  }[value] ?? value;
}

export function emergencyPoaStatusLabel(value: string) {
  return {
    unknown: "Not recorded",
    none: "No healthcare POA recorded",
    on_file: "Healthcare POA on file",
    not_on_file: "POA identified · document not on file",
  }[value] ?? value;
}

export function buildEmergencyOnePageHtml(summary: EmergencyOfflineSummary) {
  const row = (label: string, value: unknown) =>
    `<div class="row"><span>${htmlEscape(label)}</span><strong>${htmlEscape(
      String(value ?? "").trim() || "Not recorded",
    )}</strong></div>`;

  const medicationItems = summary.medications.length
    ? summary.medications
        .slice(0, 14)
        .map((medication) =>
          `<li>${htmlEscape(
            [
              medication.name,
              medication.dose,
              medication.route,
              medication.instructions,
              medication.isPrn ? "PRN" : "",
            ]
              .filter(Boolean)
              .join(" · "),
          )}</li>`,
        )
        .join("")
    : "<li>No active medications recorded.</li>";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Emergency Care Summary</title>
<style>
@page{size:A4;margin:11mm}
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#241b2b;font-size:10.5px;line-height:1.32;margin:0}
header{background:#4b2859;color:#fff;padding:13px 15px;border-radius:12px;margin-bottom:8px}
.brand{font-size:8px;letter-spacing:1.3px;font-weight:700;opacity:.85}
h1{font-size:20px;margin:3px 0}
.meta{font-size:8.5px;opacity:.83}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
section{border:1px solid #ded3e3;border-radius:10px;padding:9px;margin-bottom:8px;break-inside:avoid}
h2{font-size:12px;color:#6e397f;margin:0 0 6px}
.row{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #f0eaf2}
.row:last-child{border-bottom:0}
.row span{width:38%;color:#746a78}
.row strong{width:62%;font-weight:600}
ul{margin:3px 0 0 15px;padding:0}
li{margin:2px 0}
.notice{font-size:8px;color:#716878;border-top:1px solid #ddd3e0;padding-top:6px;margin-top:2px}
</style>
</head>
<body>
<header>
<div class="brand">ENVIZION LIFE · EMERGENCY CARE SUMMARY</div>
<h1>${htmlEscape(summary.recipientName || "Care profile")}</h1>
<div class="meta">Offline-ready snapshot · Updated ${htmlEscape(
    new Date(summary.cachedAt).toLocaleString(),
  )}</div>
</header>

<div class="grid">
<section>
<h2>Critical medical information</h2>
${row("Blood type", summary.bloodType)}
${row("Language", summary.primaryLanguage)}
${row("Allergies", summary.allergies)}
${row("Conditions / diagnoses", summary.importantConditions)}
${row("Medical devices", summary.medicalDevices)}
</section>

<section>
<h2>Emergency contacts</h2>
${row("Primary contact", summary.emergencyContactName)}
${row("Contact phone", summary.emergencyContactPhone)}
${row("Emergency number", summary.localEmergencyNumber)}
${row("Preferred hospital", summary.preferredHospital)}
</section>
</div>

<section>
<h2>Active medications</h2>
<ul>${medicationItems}</ul>
</section>

<div class="grid">
<section>
<h2>Advance directives</h2>
${row("Code status", emergencyCodeStatusLabel(summary.codeStatus))}
${row(
    "DNR / directive location",
    summary.dnrLocation || summary.advanceDirectiveLocation,
  )}
${row("Healthcare POA", emergencyPoaStatusLabel(summary.poaStatus))}
${row("POA name", summary.poaName)}
${row("POA phone", summary.poaPhone)}
</section>

<section>
<h2>Emergency notes</h2>
<div>${htmlEscape(summary.emergencyNotes || "No additional notes recorded.")}</div>
</section>
</div>

<div class="notice">
Caregiver-entered preparedness information. Not a verified clinical medical record or emergency monitoring service. Confirm critical details with the treating team when possible.
</div>
</body>
</html>`;
}
