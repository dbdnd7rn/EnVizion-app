import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("patient dashboard profile and care buttons navigate via the actual nested Main tab navigator",()=>{
  const src=readFileSync(new URL("../src/screens/PatientExperience.tsx",import.meta.url),"utf8");
  const nav=readFileSync(new URL("../src/navigation.ts",import.meta.url),"utf8");
  const app=readFileSync(new URL("../App.tsx",import.meta.url),"utf8");
  assert.match(nav,/Main: NavigatorScreenParams<Tabs> \| undefined/);
  assert.match(nav,/PatientProfile: undefined/);
  assert.match(nav,/PatientCare: undefined/);
  assert.match(app,/<Tab\.Screen name="PatientProfile"/);
  assert.match(app,/<Tab\.Screen name="PatientCare"/);
  assert.match(src,/n\.navigate\("Main", \{ screen: "PatientProfile" \}\)/);
  assert.match(src,/n\.navigate\("Main", \{ screen: "PatientCare" \}\)/);
  assert.doesNotMatch(src,/n\.navigate\("PatientProfile"\)/);
  assert.doesNotMatch(src,/n\.navigate\("PatientCare"\)/);
});

test("patient care progress bar uses a typed percent width between 0 and 100",()=>{
  const src=readFileSync(new URL("../src/screens/PatientExperience.tsx",import.meta.url),"utf8");
  assert.match(src,/const percent = today\.length \? Math\.max\(0, Math\.min\(100, done \/ today\.length \* 100\)\) : 0/);
  assert.match(src, /width: \x60\$\{percent\}%\x60 as \x60\$\{number\}%\x60/);
});
