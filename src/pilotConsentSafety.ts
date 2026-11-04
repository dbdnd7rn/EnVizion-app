import type { ProgramDocumentType, PilotConsentState } from "./pilot";

export const requiredPilotDocumentTypes: readonly ProgramDocumentType[] = [
  "privacy_notice",
  "pilot_consent",
  "terms_of_use",
];

export const pilotDocumentLabels: Record<ProgramDocumentType, string> = {
  privacy_notice: "Privacy notice",
  pilot_consent: "Pilot participation consent",
  terms_of_use: "Terms of use",
};

/**
 * Only current published, effective documents count towards the pilot gate.
 * Never infer consent from an unpublished, retired, future-dated or absent form.
 */
export function missingPilotDocumentTypes(
  currentPublishedTypes: readonly string[],
): ProgramDocumentType[] {
  const available = new Set(currentPublishedTypes);
  return requiredPilotDocumentTypes.filter((type) => !available.has(type));
}

/** Non-pilot accounts retain ordinary app access, but invited/active pilot
 * members require every current document and the exact-version acceptance.
 */
export function pilotConsentMayProceed(
  state: PilotConsentState,
): boolean {
  if (!state.enrolled || !["invited", "active"].includes(state.status ?? "")) {
    return true;
  }
  return state.missingRequiredTypes.length === 0 &&
    state.outstanding.length === 0;
}
