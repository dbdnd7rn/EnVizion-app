import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync(
  new URL("../src/screens/StaffClinicalContentScreens.tsx", import.meta.url),
  "utf8",
);
const art = readFileSync(
  new URL("../src/components/ClinicalGlassArtwork.tsx", import.meta.url),
  "utf8",
);
const libraryStart = screen.indexOf("export function StaffClinicalContentScreen()");
const editorStart = screen.indexOf("export function ClinicalContentEditorScreen(");
const library = screen.slice(libraryStart, editorStart);
const editor = screen.slice(editorStart);

test("clinical dashboard uses real content and all four governance stages", () => {
  assert.ok(libraryStart >= 0 && editorStart > libraryStart);
  assert.match(library, /loadManagedClinicalContent\(\)/);
  assert.match(library, /item\.status === "draft"/);
  assert.match(library, /item\.status === "clinical_review"/);
  assert.match(library, /item\.status === "approved"/);
  assert.match(library, /item\.status === "published"/);
  assert.match(library, /counts\.clinical_review/);
  assert.match(library, /items\.map|visible\.map/);
  assert.match(library, /"ClinicalContentEditor"/);
  assert.match(library, /contentId: item\.uuid/);
});

test("clinical dashboard filters, sorts and refreshes data on return from editor", () => {
  assert.match(library, /useFocusEffect/);
  assert.match(library, /TextInput/);
  assert.match(library, /onChangeText=\{setSearch\}/);
  assert.match(library, /setFilter/);
  assert.match(library, /setNewestFirst/);
  assert.match(library, /new Date\(a\.updatedAt\)/);
  assert.match(library, /void refresh\(true\)/);
  assert.match(library, /ClinicalContentRecord\[\]/);
});

test("realtime status is truthful and optional, and no sample clinical records are injected", () => {
  assert.match(library, /supabase\.channel\("staff-clinical-content-updates"\)/);
  assert.match(library, /status === "SUBSCRIBED"/);
  assert.match(library, /connected \? "● Live" : "Manual refresh"/);
  assert.match(library, /supabase\.removeChannel/);
  assert.doesNotMatch(library, /Jane M\.|Mr Nsanganiza|faker|sampleItems/);
});

test("versioned editing and role-gated approval remain accessible", () => {
  for (const op of [
    "saveClinicalContent", "submitClinicalContentForReview",
    "approveClinicalContent", "publishClinicalContent",
    "returnClinicalContentToDraft", "loadClinicalContentVersions",
  ]) assert.match(editor, new RegExp(op));
  assert.match(editor, /role === "admin"/);
  assert.match(editor, /Version history/);
  assert.match(editor, /loadClinicalContentItem/);
});

test("art is decorative, reduced-motion-aware and not a static screenshot", () => {
  assert.match(art, /ClinicalGlassArtwork/);
  assert.match(art, /isReduceMotionEnabled/);
  assert.match(art, /reduceMotionChanged/);
  assert.match(art, /pointerEvents="none"/);
});