/**
 * Pre-visit questions adapted from EnVizion Life's Professional Care Team
 * for Chronic Illness Management caregiver guide (sections 2–8), plus
 * its introductory care-coordination checklist.
 *
 * These are optional conversation prompts, not clinical advice or orders.
 */
export const doctorVisitSpecialtyOptions = [
  "General / Primary care",
  "Cardiology",
  "Hematology / Oncology",
  "Nephrology",
  "Neurology",
  "Endocrinology",
  "Pulmonology",
  "Rheumatology",
] as const;

export type DoctorVisitSpecialty = (typeof doctorVisitSpecialtyOptions)[number];

export type DoctorVisitSuggestedQuestion = {
  id: string;
  question: string;
  category: string;
};

const suggestions: Record<DoctorVisitSpecialty, readonly DoctorVisitSuggestedQuestion[]> = {
  "General / Primary care": [
    { id: "general-coordination", category: "Care coordination", question: "Who is coordinating the overall care plan, and who should we call for specific concerns?" },
    { id: "general-medications", category: "Medications", question: "Can we review the current medication list, including nonprescription medicines and supplements?" },
    { id: "general-symptoms", category: "Monitoring", question: "Which symptoms or changes from the usual baseline should we track at home?" },
    { id: "general-documents", category: "Care plan", question: "Are there recent test results or discharge instructions we should include in the care plan?" },
    { id: "general-next-steps", category: "Next steps", question: "What requires routine follow-up, a same-day call, or emergency care?" },
  ],
  Cardiology: [
    { id: "cardio-diagnosis", category: "Diagnosis", question: "What is the exact heart diagnosis, and how severe is it?" },
    { id: "cardio-monitoring", category: "Monitoring", question: "Which symptoms should we track at home?" },
    { id: "cardio-medicine", category: "Medications", question: "Which medicines are most important, and what side effects should we report?" },
    { id: "cardio-contact", category: "Warning signs", question: "What blood pressure, heart rate, weight, or symptom changes should prompt a call?" },
    { id: "cardio-lifestyle", category: "Care plan", question: "Are there diet, fluid, sodium, or activity instructions?" },
  ],
  "Hematology / Oncology": [
    { id: "onco-diagnosis", category: "Diagnosis", question: "What is the exact diagnosis, stage or classification, and treatment goal?" },
    { id: "onco-side-effects", category: "Warning signs", question: "Which side effects are expected, and which require urgent contact?" },
    { id: "onco-impact", category: "Care plan", question: "How will treatment affect infection risk, bleeding, nutrition, and energy?" },
    { id: "onco-labs", category: "Tests", question: "Which blood counts or laboratory results are most important to follow?" },
    { id: "onco-hours", category: "Next steps", question: "Who should we call after hours?" },
  ],
  Nephrology: [
    { id: "nephro-stage", category: "Diagnosis", question: "What stage of kidney disease is present, and what is the current kidney function?" },
    { id: "nephro-medicine", category: "Medications", question: "Which medicines or over-the-counter products should be avoided or dose-adjusted?" },
    { id: "nephro-diet", category: "Care plan", question: "What are the individualized fluid, sodium, potassium, and phosphorus instructions?" },
    { id: "nephro-contact", category: "Warning signs", question: "What symptoms should prompt a same-day call?" },
    { id: "nephro-dialysis", category: "Next steps", question: "If dialysis is needed, what access care and emergency instructions should we know?" },
  ],
  Neurology: [
    { id: "neuro-changes", category: "Monitoring", question: "What changes should we expect, and what changes are concerning?" },
    { id: "neuro-medicine", category: "Medications", question: "What is the medication schedule, and what side effects should we report?" },
    { id: "neuro-rehab", category: "Care plan", question: "Would physical, occupational, or speech therapy help?" },
    { id: "neuro-safety", category: "Home safety", question: "What home-safety changes are recommended?" },
    { id: "neuro-emergency", category: "Warning signs", question: "What symptoms mean call 911 rather than the office?" },
  ],
  Endocrinology: [
    { id: "endo-targets", category: "Monitoring", question: "What are the individualized glucose or hormone targets?" },
    { id: "endo-illness", category: "Care plan", question: "What should we do during illness, poor intake, or vomiting?" },
    { id: "endo-urgent", category: "Warning signs", question: "Which symptoms require urgent treatment?" },
    { id: "endo-medicines", category: "Medications", question: "How should medicines be timed with meals or other medicines?" },
    { id: "endo-screening", category: "Next steps", question: "What routine eye, kidney, foot, or cardiovascular screening is needed for diabetes?" },
  ],
  Pulmonology: [
    { id: "pulmo-inhalers", category: "Medications", question: "Which inhaler is for daily control, and which is for quick relief?" },
    { id: "pulmo-technique", category: "Care plan", question: "Can you check the inhaler or nebulizer technique?" },
    { id: "pulmo-oxygen", category: "Monitoring", question: "What is the person's usual oxygen saturation baseline and prescribed oxygen plan?" },
    { id: "pulmo-warning", category: "Warning signs", question: "What symptoms should prompt same-day contact versus 911?" },
    { id: "pulmo-rehab", category: "Next steps", question: "Would pulmonary rehabilitation be appropriate?" },
  ],
  Rheumatology: [
    { id: "rheum-diagnosis", category: "Diagnosis", question: "What is the exact autoimmune or inflammatory diagnosis?" },
    { id: "rheum-progress", category: "Monitoring", question: "How will we know whether treatment is working?" },
    { id: "rheum-labs", category: "Tests", question: "Which laboratory tests are needed to monitor the disease or medicines?" },
    { id: "rheum-infection", category: "Warning signs", question: "What infection precautions or vaccines should we discuss?" },
    { id: "rheum-organs", category: "Warning signs", question: "Which new symptoms could indicate organ involvement?" },
  ],
};

/** Older visits may contain clinician job titles or user-entered specialties. */
export function resolveDoctorVisitSpecialty(input: string): DoctorVisitSpecialty {
  const value = input.toLowerCase().trim();
  if (/(cardiol|heart specialist)/.test(value)) return "Cardiology";
  if (/(oncol|haematol|hematol|cancer specialist)/.test(value)) return "Hematology / Oncology";
  if (/(nephrol|kidney specialist|renal specialist)/.test(value)) return "Nephrology";
  if (/(neurol|brain specialist|stroke specialist)/.test(value)) return "Neurology";
  if (/(endocrin|diabetologist|hormone specialist)/.test(value)) return "Endocrinology";
  if (/(pulmon|respiratory specialist|lung specialist)/.test(value)) return "Pulmonology";
  if (/(rheumatol|arthritis specialist)/.test(value)) return "Rheumatology";
  return "General / Primary care";
}

/** Ignore casing, punctuation and extra whitespace when checking duplicates. */
export function normalizeDoctorVisitQuestion(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function doctorVisitQuestionAlreadyAdded(
  question: string,
  existing: readonly { questionText: string }[],
): boolean {
  const normalized = normalizeDoctorVisitQuestion(question);
  return Boolean(normalized) && existing.some(
    (item) => normalizeDoctorVisitQuestion(item.questionText) === normalized,
  );
}

export function availableDoctorVisitSuggestions(
  specialty: string,
  existing: readonly { questionText: string }[],
): DoctorVisitSuggestedQuestion[] {
  return suggestions[resolveDoctorVisitSpecialty(specialty)].filter(
    (suggestion) => !doctorVisitQuestionAlreadyAdded(suggestion.question, existing),
  );
}
