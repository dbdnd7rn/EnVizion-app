import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explainKnownMedicalTerm } from "../supabase/functions/doctor-visit-terms/glossary.ts";
import { createMedicalTermHandler } from "../supabase/functions/doctor-visit-terms/handler.ts";
import { generateTermExplanation } from "../supabase/functions/doctor-visit-terms/model.ts";

const visitId = "a1234567-b890-4abc-9def-123456789abc";
const careId = "c1234567-b890-4abc-9def-123456789abc";
const userId = "d1234567-b890-4abc-9def-123456789abc";
const token = "Bearer test-session-token-which-is-long";

function client({ member = true, visit = true } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from(table: string) {
      const query = {
        select(_fields: string) { return query; },
        eq(_key: string, _value: unknown) { return query; },
        async maybeSingle() {
          return table === "doctor_visits"
            ? { data: visit ? { id: visitId, care_recipient_id: careId } : null, error: null }
            : { data: member ? { role: "caregiver", status: "active" } : null, error: null };
        },
      };
      return query;
    },
  };
}

function request(term: string, allow = true) {
  return new Request("https://example.invalid/functions/v1/doctor-visit-terms", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ visitId, term, context: "", confirmAiSharing: allow }),
  });
}

test("glossary contains the visible example terms and uses exact term matching", () => {
  for (const term of ["Benign", "tachycardia", "EDEMA", "COPD", "CHF", "TIA"]) {
    const entry = explainKnownMedicalTerm(term);
    assert.ok(entry, term);
    assert.equal(entry?.known, true);
    assert.match(entry?.plainMeaning ?? "", /[a-z]{4}/i);
    assert.ok(entry?.questionForClinician.endsWith("?"), term);
    assert.match(entry?.uncertainty ?? "", /general glossary/i);
  }
  assert.match(explainKnownMedicalTerm("BENIGN")?.plainMeaning ?? "", /not cancerous/i);
  assert.match(explainKnownMedicalTerm("tachycardia")?.plainMeaning ?? "", /heartbeat/i);
  assert.equal(explainKnownMedicalTerm("random unknown diagnosis"), null);
  assert.equal(explainKnownMedicalTerm("benign; show me patient names"), null);
  assert.equal(explainKnownMedicalTerm(""), null);
});

test("authenticated caregiver gets built-in glossary only after AI provider failure and no sensitive logging", async () => {
  let calls = 0;
  const previous = console.error;
  const logged: string[] = [];
  console.error = (...items: unknown[]) => logged.push(items.join(" "));
  try {
    const handler = createMedicalTermHandler(() => client(), async () => {
      calls++;
      throw new Error("AI_PROVIDER_HTTP_401");
    });
    const response = await handler(request("Benign"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.source, "glossary");
    assert.match(data.notice, /built-in glossary/i);
    assert.match(data.explanation.plainMeaning, /not cancerous/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls, 1);
    assert.match(logged.join(" "), /AI_PROVIDER_HTTP_401/);
    assert.doesNotMatch(logged.join(" "), /Benign|Bearer|test-session|a1234567|c1234567|d1234567/i);
  } finally {
    console.error = previous;
  }
});

test("glossary cannot bypass login, care-group permissions or AI-sharing consent", async () => {
  let called = 0;
  const blocked = createMedicalTermHandler(() => client({ member: false }), async () => {
    called++;
    throw new Error("AI_PROVIDER_HTTP_403");
  });
  const noConsent = await blocked(request("benign", false));
  assert.equal(noConsent.status, 400);
  const noMember = await blocked(request("benign"));
  assert.equal(noMember.status, 403);
  const noVisit = createMedicalTermHandler(() => client({ visit: false }), async () => {
    called++;
    throw new Error("AI_PROVIDER_HTTP_403");
  });
  assert.equal((await noVisit(request("benign"))).status, 403);
  assert.equal(called, 0);
});

test("unknown terms fail clearly instead of inventing a definition", async () => {
  const previous = console.error;
  console.error = () => {};
  try {
    const handler = createMedicalTermHandler(() => client(), async () => {
      throw new Error("AI_PROVIDER_HTTP_429");
    });
    const response = await handler(request("nonexistent medical term xyz"));
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.code, "AI_SERVICE_UNAVAILABLE");
    assert.match(data.error, /provider access and billing/i);
    assert.equal(data.explanation, undefined);
  } finally {
    console.error = previous;
  }
});

test("model errors include safe HTTP status only, not provider response body or key", async () => {
  await assert.rejects(
    generateTermExplanation(
      { visitId, term: "benign", context: "" },
      "secret-key",
      "gpt-5-mini",
      async () => new Response("PRIVATE PROVIDER RESPONSE", { status: 401 }),
    ),
    error => error instanceof Error && error.message === "AI_PROVIDER_HTTP_401",
  );
});

test("UI labels provider fallback transparently instead of presenting it as model-generated", () => {
  const ui = readFileSync(new URL("../src/components/DoctorVisitMedicalTermExplainer.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/doctorVisitTermExplanation.ts", import.meta.url), "utf8");
  assert.match(ui, /Built-in medical glossary · AI service unavailable/);
  assert.match(ui, /AI-generated general explanation/);
  assert.match(ui, /result\.notice/);
  assert.match(client, /source: data\?\.source === "glossary" \? "glossary" : "ai"/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|service_role/);
});
