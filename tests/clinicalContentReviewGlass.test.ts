import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screens = readFileSync(
  new URL("../src/screens/StaffClinicalContentScreens.tsx", import.meta.url), "utf8",
);
const editor = screens.slice(screens.indexOf("/** One design across every governed guide"));
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("all managed clinical guides use the same shared glass content editor", () => {
  assert.match(app, /name="ClinicalContentEditor"/);
  assert.match(app, /themedScreen\(ClinicalContentEditorScreen\)/);
  assert.match(editor, /ClinicalGlassArtwork/);
  assert.match(editor, /EditorGlassPanel/);
  assert.match(editor, /Guide details/);
  assert.match(editor, /Sources & clinical notes/);
  assert.match(editor, /Guide sections/);
  assert.match(editor, /Review & publishing/);
  assert.match(editor, /Version history/);
  assert.match(editor, /item.sections.map/);
});

test("all original clinical content fields still use record-backed values", () => {
  for (const field of ["title", "category", "description", "readTime", "url", "reviewNotes"]) {
    assert.match(editor, new RegExp('setField\\("'+field+'"'));
  }
  assert.match(editor, /updateSection\(index, \{ title: value \}\)/);
  assert.match(editor, /updateSection\(index, \{ body: value \}\)/);
  assert.match(editor, /setField\("sections"/);
  assert.match(editor, /loadClinicalContentItem\(route.params.contentId\)/);
  assert.match(editor, /loadClinicalContentVersions\(route.params.contentId\)/);
});

test("clinical workflow retains save, review, approval, publishing, return and role restrictions", () => {
  for (const action of [
    "saveClinicalContent", "submitClinicalContentForReview",
    "approveClinicalContent", "publishClinicalContent", "returnClinicalContentToDraft",
  ]) assert.match(editor, new RegExp(action));
  assert.match(editor, /role === "admin"/);
  assert.match(editor, /item.status === "clinical_review"/);
  assert.match(editor, /item.status === "approved"/);
  assert.match(editor, /item.status !== "draft"/);
  assert.match(editor, /workflowBlocked = busy \|\| haveUnsaved/);
});

test("editor prevents accidental navigation, section deletion and publishing", () => {
  assert.match(editor, /editableSnapshot\(item\) !== editableSnapshot\(savedItem\)/);
  assert.match(editor, /usePreventRemove\(dirty/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /pendingRemove === index/);
  assert.match(editor, /setPendingWorkflow\("publish"\)/);
  assert.match(editor, /setPendingWorkflow\("return_draft"\)/);
  assert.match(editor, /setSavedItem\(updated\)/);
});

test("editor is accessible and disables published fields without changing governance rules", () => {
  assert.match(editor, /accessibilityRole="header"/);
  assert.match(editor, /accessibilityRole="button"/);
  assert.match(editor, /accessibilityState=\{\{ expanded: open \}\}/);
  assert.match(editor, /fieldEditable = canEdit && !busy/);
  assert.match(editor, /item.status !== "published"/);
  assert.match(editor, /editable=\{fieldEditable\}/);
  assert.match(editor, /no previous versions yet/i);
});