/** Only user-entered text is eligible for external AI inference. No visit records. */
export type TermRequest = {
  visitId: string;
  term: string;
  context: string;
};

export type TermExplanation = {
  known: boolean;
  plainMeaning: string;
  everydayExample: string;
  questionForClinician: string;
  uncertainty: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseTermRequest(input: unknown):
  { ok: true; value: TermRequest } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Enter a medical term to explain." };
  }
  const data = input as Record<string, unknown>;
  if (data.confirmAiSharing !== true) {
    return { ok: false, error: "Confirm that only the text you enter may be sent to the AI service." };
  }
  const visitId = typeof data.visitId === "string" ? data.visitId.trim() : "";
  if (!uuid.test(visitId)) {
    return { ok: false, error: "Choose a valid doctor visit first." };
  }
  if (typeof data.term !== "string" || !data.term.trim() || data.term.length > 160) {
    return { ok: false, error: "Enter a medical word or phrase (up to 160 characters)." };
  }
  if (data.context !== undefined && (typeof data.context !== "string" || data.context.length > 450)) {
    return { ok: false, error: "Keep the optional phrase under 450 characters." };
  }
  const term = data.term.trim();
  const context = typeof data.context === "string" ? data.context.trim() : "";
  return { ok: true, value: { visitId, term, context } };
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Reject malformed AI output; do not silently render a made-up explanation. */
export function parseTermExplanation(input: unknown): TermExplanation | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  if (typeof data.known !== "boolean") return null;
  const plainMeaning = text(data.plainMeaning, 650);
  const everydayExample = text(data.everydayExample, 450);
  const questionForClinician = text(data.questionForClinician, 300);
  const uncertainty = text(data.uncertainty, 350);
  if (!plainMeaning || !questionForClinician) return null;
  return {
    known: data.known,
    plainMeaning,
    everydayExample,
    questionForClinician,
    uncertainty: uncertainty || "This is general information only. Confirm what it means in this visit with the clinician.",
  };
}
