import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseTermRequest,
  parseTermExplanation,
  type TermRequest,
  type TermExplanation,
} from "../supabase/functions/doctor-visit-terms/contracts.ts";
import { createMedicalTermHandler } from "../supabase/functions/doctor-visit-terms/handler.ts";
import { generateTermExplanation } from "../supabase/functions/doctor-visit-terms/model.ts";

const visitId = "a1234567-b890-4abc-9def-123456789abc";
const careId = "c1234567-b890-4abc-9def-123456789abc";
const memberId = "u1234567-b890-4abc-9def-123456789abc";

const explanation: TermExplanation = {
  known: true,
  plainMeaning: "A faster-than-usual heartbeat.",
  everydayExample: "A clinician might use this word when describing a fast pulse.",
  questionForClinician: "What does the term mean in this visit?",
  uncertainty: "Only the treating clinician can explain the patient's specific finding.",
};

function validPayload() {
  return { visitId, term: "tachycardia", context: "The clinician mentioned it.", confirmAiSharing: true };
}

test("medical term requests are explicit, short, and opt-in", () => {
  assert.equal(parseTermRequest({ ...validPayload(), confirmAiSharing: false }).ok, false);
  assert.equal(parseTermRequest({ ...validPayload(), visitId: "different-patient" }).ok, false);
  assert.equal(parseTermRequest({ ...validPayload(), term: "" }).ok, false);
  assert.equal(parseTermRequest({ ...validPayload(), term: "x".repeat(161) }).ok, false);
  assert.equal(parseTermRequest({ ...validPayload(), context: "x".repeat(451) }).ok, false);
  assert.deepEqual(parseTermRequest(validPayload()), {
    ok: true,
    value: { visitId, term: "tachycardia", context: "The clinician mentioned it." },
  });
});

test("AI result must provide recognizable, bounded explanation and clinician question", () => {
  assert.equal(parseTermExplanation(null), null);
  assert.equal(parseTermExplanation({ known: true, plainMeaning: "something" }), null);
  assert.equal(parseTermExplanation({ ...explanation, known: "yes" }), null);
  assert.deepEqual(parseTermExplanation(explanation), explanation);
  assert.equal(parseTermExplanation({ ...explanation, plainMeaning: "x".repeat(1000) })?.plainMeaning.length, 650);
  const unknown = parseTermExplanation({
    known: false, plainMeaning: "I cannot reliably identify this term.",
    questionForClinician: "Could you spell and explain this term?",
  });
  assert.equal(unknown?.known, false);
  assert.match(unknown?.uncertainty ?? "", /clinician/i);
});

function fakeClient({
  visitExists = true,
  memberActive = true,
  signedIn = true,
}: {
  visitExists?: boolean;
  memberActive?: boolean;
  signedIn?: boolean;
} = {}) {
  const checkedTables: string[] = [];
  const filters: Array<[string, string, unknown]> = [];
  return {
    checkedTables,
    filters,
    client: {
      auth: {
        getUser: async () => ({
          data: { user: signedIn ? { id: memberId } : null },
          error: signedIn ? null : "not authenticated",
        }),
      },
      from(table: string) {
        checkedTables.push(table);
        const query = {
          select(_fields: string) { return query; },
          eq(column: string, value: unknown) {
            filters.push([table, column, value]);
            return query;
          },
          then(resolve: (data: unknown) => void) { resolve({ data: null, error: null }); },
          async maybeSingle() {
            if (table === "doctor_visits") {
              return { data: visitExists ? { id: visitId, care_recipient_id: careId, raw_notes: "PRIVATE NOTES" } : null, error: null };
            }
            if (table === "care_recipient_members") {
              return { data: memberActive ? { role: "caregiver", status: "active" } : null, error: null };
            }
            return { data: null, error: null };
          },
        };
        return query;
      },
    },
  };
}

function request(body: unknown, token = "Bearer test-session-token-which-is-long") {
  return new Request("https://example.invalid/functions/v1/doctor-visit-terms", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("term endpoint rejects unauthenticated and inaccessible visits BEFORE any model call", async () => {
  let called = 0;
  const inaccessible = fakeClient({ visitExists: false });
  const handler = createMedicalTermHandler(() => inaccessible.client, async () => {
    called++; return explanation;
  });
  assert.equal((await handler(request(validPayload(), ""))).status, 401);
  assert.equal((await handler(request({ ...validPayload(), confirmAiSharing: false }))).status, 400);
  assert.equal((await handler(request(validPayload()))).status, 403);
  assert.equal(called, 0);
  assert.deepEqual(inaccessible.checkedTables, ["doctor_visits"]);

  const inactive = fakeClient({ memberActive: false });
  const denied = createMedicalTermHandler(() => inactive.client, async () => {
    called++; return explanation;
  });
  assert.equal((await denied(request(validPayload()))).status, 403);
  assert.equal(called, 0);
  assert.deepEqual(inactive.checkedTables, ["doctor_visits", "care_recipient_members"]);

  const signedOut = fakeClient({ signedIn: false });
  const deniedLogin = createMedicalTermHandler(() => signedOut.client, async () => {
    called++; return explanation;
  });
  assert.equal((await deniedLogin(request(validPayload()))).status, 401);
  assert.equal(called, 0);
});

test("authenticated active membership receives explanation without sending care records to model", async () => {
  const mock = fakeClient();
  let sent: TermRequest | null = null;
  const handler = createMedicalTermHandler(() => mock.client, async input => {
    sent = input;
    return explanation;
  });
  const response = await handler(request(validPayload()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual((await response.json()).explanation, explanation);
  assert.deepEqual(sent, { visitId, term: "tachycardia", context: "The clinician mentioned it." });
  assert.ok(mock.filters.some(([table, field, value]) => table === "doctor_visits" && field === "id" && value === visitId));
  assert.ok(mock.filters.some(([table, field, value]) => table === "care_recipient_members" && field === "user_id" && value === memberId));
  assert.ok(mock.filters.some(([table, field, value]) => table === "care_recipient_members" && field === "status" && value === "active"));
});

test("server-only OpenAI request contains only typed text; no patient identifiers or transcript", async () => {
  const requestData: TermRequest = { visitId, term: "edema", context: "Doctor said swelling." };
  let payload: any = null;
  const result = await generateTermExplanation(
    requestData,
    "server-only-test-key",
    "gpt-5-mini",
    async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer server-only-test-key");
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(explanation) } }] }), { status: 200 });
    },
  );
  assert.deepEqual(result, explanation);
  const sentText = JSON.stringify(payload.messages);
  assert.match(sentText, /edema/);
  assert.match(sentText, /Doctor said swelling/);
  assert.doesNotMatch(sentText, new RegExp(visitId));
  assert.doesNotMatch(sentText, new RegExp(careId));
  assert.doesNotMatch(sentText, /PRIVATE NOTES|transcript|care_recipient_id/i);
  assert.ok(payload.max_completion_tokens <= 1000);
});

test("AI provider errors do not leak secrets or claim a definition was generated", async () => {
  const input: TermRequest = { visitId, term: "something", context: "" };
  await assert.rejects(() => generateTermExplanation(input, ""), /AI_NOT_CONFIGURED/);
  await assert.rejects(() => generateTermExplanation(
    input, "secret", "gpt-5-mini",
    async () => new Response("secret provider error", { status: 503 }),
  ), /AI_PROVIDER_HTTP_503/);
});

test("Doctor Visit screen exposes opt-in explainer, per-visit reset, no auto transcript or record writes", () => {
  const screen = readFileSync(new URL("../src/screens/DoctorVisitCompanionScreen.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/components/DoctorVisitMedicalTermExplainer.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/doctorVisitTermExplanation.ts", import.meta.url), "utf8");
  assert.match(screen, /<DoctorVisitMedicalTermExplainer/);
  assert.match(screen, /key=\{selected\.visit\.id\}/);
  assert.match(ui, /useState\(false\)/);
  assert.match(ui, /allowAi/);
  assert.match(ui, /onValueChange=/);
  assert.match(ui, /setResult\(null\)/);
  assert.match(ui, /maxLength=\{160\}/);
  assert.match(ui, /maxLength=\{450\}/);
  assert.match(ui, /Only what you enter here is used as context/);
  assert.match(ui, /Results are not saved to the patient record or shared with family/);
  assert.match(client, /supabase\.functions\.invoke\("doctor-visit-terms"/);
  assert.match(client, /confirmAiSharing: true/);
  assert.doesNotMatch(client, /rawNotes|transcriptText|careRecipientName|service_role|OPENAI_API_KEY/);
});
