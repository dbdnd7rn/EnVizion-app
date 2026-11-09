/**
 * Non-secret Expo/EAS release configuration inspection.
 * A passing result means the configuration is eligible for a native build;
 * it does NOT mean Apple/Google credentials exist, a build has been installed,
 * or pilot/clinical approval has been granted.
 */
const packageIdPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function inspectNativeReleaseConfiguration({
  app,
  eas,
  pkg,
  advisory,
  now = new Date(),
  exists = () => true,
} = {}) {
  const errors = [];
  const warnings = [];
  const manual = [];
  const expo = app?.expo ?? {};
  const build = eas?.build ?? {};
  const ios = expo.ios ?? {};
  const android = expo.android ?? {};
  const projectId = expo.extra?.eas?.projectId;
  const buildSource = eas?.cli?.appVersionSource;
  const preview = build.preview ?? {};
  const production = build.production ?? {};

  const requiredString = (value, path) => {
    if (typeof value !== "string" || value.trim() === "")
      errors.push("Missing required " + path);
  };

  requiredString(expo.name, "expo.name");
  requiredString(expo.slug, "expo.slug");
  requiredString(expo.scheme, "expo.scheme");
  requiredString(expo.owner, "expo.owner");
  requiredString(ios.bundleIdentifier, "expo.ios.bundleIdentifier");
  requiredString(android.package, "expo.android.package");
  requiredString(projectId, "expo.extra.eas.projectId");

  if (expo.version && !semverPattern.test(expo.version))
    errors.push("expo.version must be a valid x.y.z version.");
  if (!expo.version) errors.push("Missing expo.version.");

  if (ios.bundleIdentifier && !packageIdPattern.test(ios.bundleIdentifier))
    errors.push("Invalid iOS bundle identifier.");
  if (android.package && !packageIdPattern.test(android.package))
    errors.push("Invalid Android package identifier.");
  if (projectId && !uuidPattern.test(projectId))
    errors.push("EAS project ID must be a valid UUID; do not generate a replacement for an existing project.");

  if (!/^[a-z][a-z0-9+.-]*$/i.test(expo.scheme || ""))
    errors.push("expo.scheme must be a valid deep-link scheme.");
  if (ios.buildNumber === undefined || !/^[1-9]\d*$/.test(String(ios.buildNumber)))
    errors.push("iOS buildNumber must be a positive integer string.");
  if (!Number.isInteger(android.versionCode) || android.versionCode <= 0)
    errors.push("Android versionCode must be a positive integer.");
  if (preview.distribution !== "internal")
    errors.push("EAS preview build must use internal distribution.");
  if (preview.android?.buildType !== "apk")
    errors.push("EAS preview Android build must produce an installable APK.");
  if (preview.ios?.simulator === true)
    errors.push("EAS preview iOS profile is simulator-only and cannot be installed on a physical iPhone.");
  if (!build.production)
    errors.push("EAS production build profile is missing.");
  if (production.android?.buildType === "apk")
    errors.push("EAS production Android app-store builds should produce an AAB, not an APK.");
  if (production.ios?.simulator === true)
    errors.push("EAS production iOS builds must target actual devices.");

  for (const assetPath of [
    expo.icon,
    expo.splash?.image,
    android.icon,
    android.adaptiveIcon?.foregroundImage,
  ]) {
    if (typeof assetPath !== "string" || !exists(assetPath))
      errors.push("App icon/splash image is missing: " + String(assetPath));
  }

  const pluginNames = new Set((expo.plugins ?? []).map(plugin =>
    typeof plugin === "string" ? plugin : Array.isArray(plugin) ? plugin[0] : ""));
  for (const plugin of ["expo-notifications","expo-audio","expo-calendar","expo-local-authentication"])
    if (!pluginNames.has(plugin))
      warnings.push("Confirm native permission configuration for " + plugin + ".");

  if (typeof expo.owner === "string" && expo.owner.trim())
    warnings.push("Expo project owner is '" + expo.owner +
      "'. Confirm authorized client ownership before transferring or submitting; do not change owner/projectId in code to simulate a transfer.");
  if (pkg?.version && expo.version && pkg.version !== expo.version)
    warnings.push("package.json version (" + pkg.version + ") differs from app.json version (" + expo.version +
      "). Expo app.json controls the native marketing version; align during the next approved release.");
  if (buildSource === "local" && production.autoIncrement === true)
    warnings.push("EAS production uses local autoIncrement. Commit version changes per build or plan a controlled migration to remote versioning.");
  if (ios.supportsTablet)
    warnings.push("iPad support is enabled. Confirm iPad layout/device QA and required App Store assets.");
  if (expo.userInterfaceStyle === "light")
    warnings.push("Native userInterfaceStyle is light. Verify the in-app dark theme on both platforms.");

  for (const exception of advisory?.exceptions ?? []) {
    if (!exception.expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn))
      errors.push("Security advisory exception has an invalid review date: " + String(exception.id));
    else {
      const today = now.toISOString().slice(0,10);
      if (today > exception.expiresOn)
        errors.push("Security exception expired " + exception.expiresOn + ": " + exception.id);
      else {
        const daysRemaining = Math.ceil(
          (Date.parse(exception.expiresOn + "T00:00:00Z") -
           Date.parse(today + "T00:00:00Z")) / 86400000);
        if (daysRemaining <= 3)
          warnings.push("Security exception review due by " + exception.expiresOn + ": " + exception.id);
      }
    }
  }

  // These are deliberately manual, never auto-marked complete by CI.
  manual.push(
    "Verify both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the selected EAS build environment; never put service_role secrets in EXPO_PUBLIC variables.",
    "Client confirms Expo/EAS project owner, Apple Developer team and Google Play Console account ownership.",
    "For physical iPhone preview, client/developer provides a paid Apple Developer Program membership and registers the tester's device for ad hoc provisioning.",
    "Confirm Supabase Auth redirect allowlist includes envizionlife://auth/confirmed and envizionlife://auth/reset-password; test Google OAuth and password recovery on native devices.",
    "Generate and install an Android APK and an iOS internal/TestFlight build; test push, deep links, SecureStore, offline Emergency Vault, biometrics, PDF/QR, calendar, microphone and revoked access.",
    "Complete privacy disclosures, store content/rating, accessibility, clinical approvals, participant consent and signed pilot acceptance before any public submission.",
  );

  return {
    errors,
    warnings,
    manual,
    configuration: {
      appName: expo.name ?? null,
      appVersion: expo.version ?? null,
      expoOwner: expo.owner ?? null,
      easProjectId: projectId ?? null,
      iosBundleId: ios.bundleIdentifier ?? null,
      iosBuildNumber: ios.buildNumber ?? null,
      androidPackage: android.package ?? null,
      androidVersionCode: android.versionCode ?? null,
      previewAndroid: preview.android?.buildType ?? null,
      previewDistribution: preview.distribution ?? null,
    },
  };
}

export function validateNativeBuildEnvironment(env) {
  const errors = [];
  for (const key of ["EXPO_PUBLIC_SUPABASE_URL","EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
    const value = env?.[key];
    if (typeof value !== "string" || !value.trim())
      errors.push(key + " must be set in the selected EAS build environment.");
  }
  const url = env?.EXPO_PUBLIC_SUPABASE_URL;
  if (typeof url === "string" && url.trim()) {
    try {
      if (new URL(url).protocol !== "https:")
        errors.push("EXPO_PUBLIC_SUPABASE_URL must use HTTPS.");
    } catch {
      errors.push("EXPO_PUBLIC_SUPABASE_URL is not a valid URL.");
    }
  }
  return errors;
}
