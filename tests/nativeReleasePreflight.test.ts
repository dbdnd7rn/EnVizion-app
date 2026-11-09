import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectNativeReleaseConfiguration,
  validateNativeBuildEnvironment,
} from "../scripts/nativeReleasePreflight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const getJson = name => JSON.parse(readFileSync(path.join(root,name),"utf8"));
const fixtures = () => ({
  app: getJson("app.json"),
  eas: getJson("eas.json"),
  pkg: getJson("package.json"),
  advisory: getJson("security/advisory-exceptions.json"),
  now: new Date("2026-11-09T12:00:00Z"),
  exists: asset => typeof asset === "string" &&
    asset.startsWith("./") && existsSync(path.resolve(root,asset)),
});

test("current EnVizion app supports internal Android APK and iPhone preview configuration",()=>{
  const input = fixtures();
  const result = inspectNativeReleaseConfiguration(input);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.configuration.appName,"EnVizion Life");
  assert.equal(result.configuration.iosBundleId,"com.envizionlife.caregiver");
  assert.equal(result.configuration.androidPackage,"com.envizionlife.caregiver");
  assert.equal(result.configuration.previewDistribution,"internal");
  assert.equal(result.configuration.previewAndroid,"apk");
  assert.ok(result.configuration.easProjectId);
  assert.match(result.warnings.join(" "),/Expo project owner is/);
  assert.match(result.warnings.join(" "),/Security exception review due by 2026-11-11/);
  assert.match(result.manual.join(" "),/paid Apple Developer Program membership/);
});

test("missing native configuration and non-installable preview settings fail before EAS build",()=>{
  const f=fixtures();
  f.app.expo.ios.bundleIdentifier = "com invalid id";
  f.app.expo.android.versionCode = 0;
  f.app.expo.extra.eas.projectId = "not-a-real-id";
  f.app.expo.icon = "./assets/not-real-icon.png";
  f.eas.build.preview.distribution = "store";
  f.eas.build.preview.android.buildType = "app-bundle";
  f.eas.build.preview.ios = { simulator:true };
  const report=inspectNativeReleaseConfiguration(f);
  const issues=report.errors.join(" ");
  assert.match(issues,/Invalid iOS bundle identifier/);
  assert.match(issues,/Android versionCode must be/);
  assert.match(issues,/EAS project ID must be a valid UUID/);
  assert.match(issues,/App icon\/splash image is missing/);
  assert.match(issues,/internal distribution/);
  assert.match(issues,/installable APK/);
  assert.match(issues,/simulator-only/);
});

test("a security advisory exception expires without automatic renewal",()=>{
  const f=fixtures();
  f.now = new Date("2026-11-12T00:00:00Z");
  const report=inspectNativeReleaseConfiguration(f);
  assert.match(report.errors.join(" "),/Security exception expired 2026-11-11/);
  assert.ok(report.errors.length>=4);
});

test("EAS build environment check requires only browser-safe Supabase publishable values",()=>{
  assert.deepEqual(validateNativeBuildEnvironment({
    EXPO_PUBLIC_SUPABASE_URL:"https://test-project.supabase.co",
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_demo",
  }),[]);
  assert.match(validateNativeBuildEnvironment({}).join(" "),/EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(validateNativeBuildEnvironment({}).join(" "),/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(validateNativeBuildEnvironment({
    EXPO_PUBLIC_SUPABASE_URL:"http://example.com",
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"test",
  }).join(" "),/must use HTTPS/);
});

test("mobile release preflight does not require private credentials from CI and cannot claim UAT passed",()=>{
  const source = readFileSync(path.join(root,"scripts/verify-native-release.mjs"),"utf8");
  const workflow = readFileSync(path.join(root,".github/workflows/security-quality-gate.yml"),"utf8");
  assert.match(source,/process\.argv\.includes\("--require-env"\)/);
  assert.match(source,/This does not create an installable app or authorize a pilot\/store release/);
  assert.match(workflow,/name: Native release preflight/);
  assert.match(workflow,/npm run preflight:native/);
});
