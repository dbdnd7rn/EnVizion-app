import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availableDoctorVisitSuggestions,
  doctorVisitQuestionAlreadyAdded,
  doctorVisitSpecialtyOptions,
  normalizeDoctorVisitQuestion,
  resolveDoctorVisitSpecialty,
} from "../src/doctorVisitQuestionSuggestions.ts";

test("all seven clinician specialties from the EnVizion caregiver guide have unique question sets", () => {
  assert.equal(doctorVisitSpecialtyOptions.length, 8); // Seven specialties plus primary/general care.
  for (const specialty of doctorVisitSpecialtyOptions) {
    const questions = availableDoctorVisitSuggestions(specialty, []);
    assert.equal(questions.length, 5, specialty);
    assert.equal(new Set(questions.map((item) => item.id)).size, 5, specialty);
    assert.equal(new Set(questions.map((item) => item.question)).size, 5, specialty);
    for (const item of questions) {
      assert.ok(item.question.endsWith("?"), item.question);
      assert.ok(item.category.trim(), specialty);
    }
  }
});

test("older clinician names and common specialty spelling variants map to the right guide", () => {
  assert.equal(resolveDoctorVisitSpecialty("Dr Jones - Cardiologist"), "Cardiology");
  assert.equal(resolveDoctorVisitSpecialty("Hematologist/Oncologist"), "Hematology / Oncology");
  assert.equal(resolveDoctorVisitSpecialty("Oncology"), "Hematology / Oncology");
  assert.equal(resolveDoctorVisitSpecialty("Nephrologist"), "Nephrology");
  assert.equal(resolveDoctorVisitSpecialty("Neurologist"), "Neurology");
  assert.equal(resolveDoctorVisitSpecialty("Endocrinologist"), "Endocrinology");
  assert.equal(resolveDoctorVisitSpecialty("Pulmonologist"), "Pulmonology");
  assert.equal(resolveDoctorVisitSpecialty("Rheumatologist"), "Rheumatology");
});

test("unknown, custom or empty specialty gets useful general prompts rather than unrelated advice", () => {
  assert.equal(resolveDoctorVisitSpecialty(""), "General / Primary care");
  assert.equal(resolveDoctorVisitSpecialty("Custom specialty"), "General / Primary care");
  const general = availableDoctorVisitSuggestions("", []);
  assert.equal(general.length, 5);
  assert.match(general[0].question, /coordinating/i);
});

test("saved questions are filtered regardless of casing, punctuation or whitespace", () => {
  const questions = availableDoctorVisitSuggestions("Cardiology", []);
  const first = questions[0].question;
  const existing = [{ questionText: "  " + first.toUpperCase().replace("?", " ? ") + "  " }];
  assert.equal(normalizeDoctorVisitQuestion(existing[0].questionText), normalizeDoctorVisitQuestion(first));
  assert.equal(doctorVisitQuestionAlreadyAdded(first, existing), true);
  const remaining = availableDoctorVisitSuggestions("Cardiology", existing);
  assert.equal(remaining.length, 4);
  assert.ok(!remaining.some((item) => item.id === questions[0].id));
  assert.equal(doctorVisitQuestionAlreadyAdded("New question?", existing), false);
  assert.equal(doctorVisitQuestionAlreadyAdded(" ", existing), false);
});

test("all suggestions disappear only after saving them; custom questions remain supported", () => {
  const suggestions = availableDoctorVisitSuggestions("Neurology", []);
  const stored = suggestions.map((item) => ({ questionText: item.question }));
  assert.deepEqual(availableDoctorVisitSuggestions("Neurologist", stored), []);
  assert.equal(doctorVisitQuestionAlreadyAdded("Can we discuss caregiver respite?", stored), false);
});

test("Doctor Visit Companion renders prompts as editable drafts and keeps existing Supabase persistence", () => {
  const screen = readFileSync(new URL("../src/screens/DoctorVisitCompanionScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /doctorVisitSpecialtyOptions\.map/);
  assert.match(screen, /availableDoctorVisitSuggestions\(selected\.visit\.specialty, selected\.questions\)/);
  assert.match(screen, /suggestedQuestions\.map/);
  assert.match(screen, /setNewQuestion\(suggestion\.question\)/);
  assert.match(screen, /setQuestionCategory\(suggestion\.category\)/);
  assert.match(screen, /doctorVisitQuestionAlreadyAdded\(newQuestion, selected\.questions\)/);
  assert.match(screen, /addDoctorVisitQuestion\(\{/);
  assert.match(screen, /disabled=\{readOnly \|\| Boolean\(busy\)/);
  assert.match(screen, /Recording consent confirmation/);
  assert.match(screen, /Generate AI draft/);
  assert.match(screen, /Share approved visit recap/);
  const backend = readFileSync(new URL("../src/doctorVisits.ts", import.meta.url), "utf8");
  assert.match(backend, /\.from\("doctor_visit_questions"\)/);
  assert.match(backend, /export async function publishDoctorVisitSummary/);
});
