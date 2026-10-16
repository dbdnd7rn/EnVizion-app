import { toolkitReply, requestedToolkitRecords, wantsTrends, localParts, validTimezone, localDayUTCWindow, type RecordKind, type RecordSection } from "./toolkit.ts";
import type { AssistantHistory, CareTrends } from "./contracts.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const safe = (value: unknown, size: number) => typeof value === "string" ? value.trim().slice(0, size) : "";
// A deliberately small interface permits handler tests against an in-memory RLS client.
// Production always supplies a Supabase client scoped to the verified user's JWT.
export type QueryResult = { data: any; error: unknown };
export interface ReadQuery extends PromiseLike<QueryResult> {
  select(fields: string): ReadQuery;
  eq(column: string, value: unknown): ReadQuery;
  gte(column: string, value: unknown): ReadQuery;
  lt(column: string, value: unknown): ReadQuery;
  is(column: string, value: null): ReadQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): ReadQuery;
  limit(value: number): ReadQuery;
  maybeSingle(): PromiseLike<QueryResult>;
}
export interface CareReadClient {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from(table: string): ReadQuery;
}
const tables: Record<RecordKind, { table: string; fields: string; date?: string }> = {
  appointments: { table: "appointments", fields: "title,starts_at", date: "starts_at" },
  tasks: { table: "care_tasks", fields: "title,due_at,status", date: "due_at" },
  reminders: { table: "care_reminders", fields: "title,scheduled_for,snoozed_until,recurrence", date: "scheduled_for" },
  plan: { table: "care_plan_items", fields: "title", },
  notes: { table: "care_communications", fields: "summary,occurred_at", date: "occurred_at" },
};
async function loadSection(client: CareReadClient, careId: string, kind: RecordKind, now: Date, today: boolean, timezone: string): Promise<RecordSection> {
  const spec = tables[kind];
  let q = client.from(spec.table).select(spec.fields).eq("care_recipient_id", careId);
  if (kind === "appointments") q = q.gte("starts_at", now.toISOString());
  if (kind === "tasks") q = q.eq("status", "open");
  if (kind === "reminders") q = q.is("completed_at", null).is("dismissed_at", null);
  if (kind === "plan") q = q.eq("active", true);
  if (today && spec.date) {
    const [start, end] = localDayUTCWindow(now, timezone);
    q = q.gte(spec.date, start).lt(spec.date, end);
  }
  if (spec.date) q = q.order(spec.date, { ascending: kind !== "notes", nullsFirst: false });
  else q = q.order("created_at", { ascending: false });
  const result = await q.limit(6);
  if (result.error) return { available: false, records: [] };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    available: true, hasMore: rows.length > 5,
    records: rows.slice(0, 5).map((r: Record<string, unknown>) => ({
      title: safe(kind === "notes" ? r.summary : r.title, 180) || "Untitled saved entry",
      when: spec.date ? safe(r[spec.date], 50) || null : null,
      status: kind === "tasks" ? safe(r.status, 30) : kind === "reminders" && r.recurrence !== "none" ? `${safe(r.recurrence, 20)}; recorded schedule` : null,
    })),
  };
}

export async function loadTrends(client: CareReadClient, careId: string, now: Date, timezone: string): Promise<CareTrends | undefined> {
  const today = localParts(now, timezone).date;
  const days = Array.from({length:7}, (_, i) => {
    const day = new Date(today + "T12:00:00Z"); day.setUTCDate(day.getUTCDate() - 6 + i);
    return {date: day.toISOString().slice(0,10), notes:0, completedReminders:0};
  });
  // An anchor at the start of today minus six calendar days, corrected for the local zone.
  const [todayStart] = localDayUTCWindow(now, timezone);
  const anchor = new Date(Date.parse(todayStart) - 6 * 86400000 + 12 * 3600000);
  const [start] = localDayUTCWindow(anchor, timezone);
  const specs = [
    {table:"care_communications", date:"occurred_at", key:"notes" as const},
    {table:"care_reminders", date:"completed_at", key:"completedReminders" as const},
  ];
  const results = await Promise.all(specs.map(spec => client.from(spec.table).select(spec.date)
    .eq("care_recipient_id", careId).gte(spec.date,start).lt(spec.date,now.toISOString()).order(spec.date).limit(1000)));
  // Never render a capped or failed query as a complete trend.
  if (results.some(r => r.error || !Array.isArray(r.data) || r.data.length >= 1000)) return undefined;
  results.forEach((result, i) => result.data.forEach((row: Record<string, unknown>) => {
    const stamp = row[specs[i].date];
    if (typeof stamp !== "string" || !Number.isFinite(Date.parse(stamp))) return;
    const day = days.find(d => d.date === localParts(new Date(stamp), timezone).date);
    if (day) day[specs[i].key]++;
  }));
  return {updatedAt:now.toISOString(), timezone, days};
}

export function createToolkitHandler(makeClient: (auth: string) => CareReadClient, now: () => Date = () => new Date()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Sign in to use the toolkit assistant." }, 401);
    try {
      const raw = await req.text();
      if (raw.length > 32000) return json({ error: "This message is too large. Please shorten it." }, 413);
      let body: Record<string, unknown>;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        body = parsed;
      } catch { return json({ error: "Please send a valid toolkit request." }, 400); }
      const client = makeClient(auth);
      const { data: { user }, error } = await client.auth.getUser(auth.slice(7));
      if (error || !user) return json({ error: "Please sign in again." }, 401);
      const message = safe(body.message, 1800);
      if (!message) return json({ error: "Please enter a message." }, 400);
      const history: AssistantHistory[] = Array.isArray(body.history) ? body.history.slice(-12).flatMap(turn => {
        if (!turn || typeof turn !== "object" || (turn.role !== "user" && turn.role !== "assistant")) return [];
        const content = safe(turn.content, 1800);
        return content ? [{ role: turn.role as "user" | "assistant", content }] : [];
      }) : [];
      const includeCareData = body.includeCareData === true;
      const timezone = validTimezone(body.timezone);
      const careId = safe(body.careRecipientId, 64);
      const records: Partial<Record<RecordKind, RecordSection>> = {};
      let trends: CareTrends | undefined;
      let profileName = "", role = "", canDraft = false;
      const current = now();
      if (includeCareData) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(careId)) return json({ error: "Select a valid care profile first." }, 400);
        const person = await client.from("care_recipients").select("id,display_name").eq("id", careId).maybeSingle();
        if (person.error || !person.data) return json({ error: "This care profile isn't available to your account." }, 403);
        const membership = await client.from("care_recipient_members").select("role,status").eq("care_recipient_id", careId).eq("user_id", user.id).eq("status", "active").maybeSingle();
        if (membership.error || !membership.data) return json({ error: "Access to this care profile could not be verified." }, 403);
        profileName = safe(person.data.display_name, 120);
        role = safe(membership.data.role, 40);
        canDraft = ["owner", "caregiver", "primary_advocate", "co_caregiver"].includes(role);
        if (wantsTrends(message)) trends = await loadTrends(client, careId, current, timezone);
        await Promise.all(requestedToolkitRecords(message).map(async kind => {
          records[kind] = await loadSection(client, careId, kind, current, /\btoday\b/i.test(message), timezone);
        }));
      }
      // No model, external fetch, service-role key, or database write is involved.
      const response = toolkitReply(message, history, { includeCareData, canDraft, profileName, role, timezone, now: current, records, trends });
      return json({ ...response, engine: "toolkit" });
    } catch {
      return json({ error: "The toolkit assistant couldn't load your information. Please try again." }, 500);
    }
  };
}
