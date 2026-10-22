import {
  isCalendarDate, validateAssistantDraft,
  type AssistantHistory, type CareAIAnswer, type ToolkitResource, type CareTrends,
} from "./contracts.ts";

export type RecordKind = "appointments" | "tasks" | "reminders" | "plan" | "notes";
export type CareRecord = { title: string; when?: string | null; status?: string | null };
export type RecordSection = { available: boolean; records: CareRecord[]; hasMore?: boolean };
export type ToolkitContext = {
  includeCareData: boolean;
  canDraft: boolean;
  profileName?: string;
  role?: string;
  trends?: CareTrends;
  timezone: string;
  now?: Date;
  records?: Partial<Record<RecordKind, RecordSection>>;
};
const clean = (s: string) => s.trim().slice(0, 1800);
const answer = (reply: string, resource?: ToolkitResource): CareAIAnswer => ({ reply, action: null, ...(resource ? { resource } : {}) });
const resource = (label: string, destination: ToolkitResource["destination"]) => ({ label, destination });
const REMINDER_TITLE = "What should the reminder say?";
const REMINDER_DATE = "What date is the reminder for? Use YYYY-MM-DD, today, or tomorrow.";
const REMINDER_TIME = "What time is the reminder for? Use HH:MM in 24-hour time, or include AM/PM (for example, 9 AM).";
const NOTE_CONTENT = "What would you like to record in the care note? Write the facts in your own words.";
const permissionReply = () => answer("Select a care profile and enable ‘Use this care profile’s information’ to prepare a reminder or note. Only an authorized caregiver can save it.");
const wantsReminder = (s: string) => /\bremind me\b|\b(?:set|add|create|make|schedule|prepare|draft)\b.{0,35}\breminder\b|^reminder$/i.test(s);
const wantsNote = (s: string) => /\bput\b.{0,60}\bcare communication note\b|\b(?:write|add|create|make|prepare|draft|record|save)\b.{0,65}\b(?:care |communication )?notes?\b|^care notes?$/i.test(s);

export function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function validTimezone(value: unknown) {
  const zone = typeof value === "string" ? value.trim().slice(0, 100) : "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); return zone; } catch { return "UTC"; }
}
/** Exact local calendar-day boundaries, including DST changes and date-line zones. */
export function localDayUTCWindow(now: Date, timezone: string): [string, string] {
  const zone = validTimezone(timezone);
  const date = localParts(now, zone).date;
  const next = new Date(date + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const boundary = (day: string) => {
    const center = Date.parse(day + "T12:00:00Z");
    let low = center - 48 * 3600000, high = center + 48 * 3600000;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const p = Object.fromEntries(formatter.formatToParts(new Date(mid)).map(x => [x.type, x.value]));
      if (`${p.year}-${p.month}-${p.day}` < day) low = mid + 1; else high = mid;
    }
    return new Date(low).toISOString();
  };
  return [boundary(date), boundary(next.toISOString().slice(0, 10))];
}
export function parseToolkitDate(text: string, timezone: string, now = new Date()): string | null {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return isCalendarDate(iso) ? iso : null;
  const relative = text.match(/\b(today|tomorrow)\b/i)?.[1].toLowerCase();
  if (!relative) return null; // Never guess slash dates, weekdays, or a missing year.
  const local = localParts(now, validTimezone(timezone)).date;
  const d = new Date(local + "T12:00:00Z");
  if (relative === "tomorrow") d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function parseToolkitTime(text: string): string | null {
  const explicit = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (explicit) {
    const hour = Number(explicit[1]);
    if (hour < 1 || hour > 12) return null;
    return `${String(hour % 12 + (/^p/i.test(explicit[3]) ? 12 : 0)).padStart(2, "0")}:${explicit[2] || "00"}`;
  }
  return text.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null;
}
function futureLocal(date: string, time: string, context: ToolkitContext) {
  const now = localParts(context.now ?? new Date(), validTimezone(context.timezone));
  return `${date}T${time}` > `${now.date}T${now.time}`;
}

export function requestedToolkitRecords(message: string): RecordKind[] {
  // A request to create a draft does not need a copy of the existing records.
  if (wantsReminder(message) || wantsNote(message)) return [];
  if (/\b(care updates?|overview|current care|care summary|care plan and tasks|what.*(?:next|today))\b/i.test(message)) return ["appointments", "tasks", "reminders", "plan"];
  if (/\b(my|our|show|list|upcoming|next|today|recent|saved|what|when)\b/i.test(message)) {
    if (/\bappointments?|visits?\b/i.test(message)) return ["appointments"];
    if (/\btasks?|to.?do\b/i.test(message)) return ["tasks"];
    if (/\breminders?\b/i.test(message)) return ["reminders"];
    if (/\bcare plan|routines?\b/i.test(message)) return ["plan"];
    if (/\bnotes?|communication log\b/i.test(message)) return ["notes"];
  }
  return [];
}
const sectionInfo: Record<RecordKind, { label: string; link: ToolkitResource }> = {
  appointments: { label: "Upcoming appointments", link: resource("Open appointments", "Appointments") },
  tasks: { label: "Open care tasks", link: resource("Open care tasks", "CareTasks") },
  reminders: { label: "Open reminders (including overdue)", link: resource("Open care calendar", "CareCalendar") },
  plan: { label: "Active care plan", link: resource("Open care plan", "CarePlan") },
  notes: { label: "Recent care notes", link: resource("Open care notes", "CareCommunicationLog") },
};
function formatWhen(value: string | null | undefined, context: ToolkitContext) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return " — date unavailable";
  return " — " + new Intl.DateTimeFormat("en", { timeZone: validTimezone(context.timezone), dateStyle: "medium", timeStyle: "short" }).format(date);
}
function summarize(kinds: RecordKind[], context: ToolkitContext, message: string) {
  if (!context.includeCareData) return answer("I can show saved care information after you select a profile and enable ‘Use this care profile’s information’. For general toolkit help, you can leave it off.");
  const todayOnly = /\btoday\b/i.test(message);
  const date = localParts(context.now ?? new Date(), validTimezone(context.timezone)).date;
  const blocks = kinds.map(kind => {
    const info = sectionInfo[kind], section = context.records?.[kind];
    if (!section?.available) return `${info.label}: I couldn't load these records. Open the page to check or try again.`;
    // The backend applies the date window before limiting results.
    const rows = section.records.filter(r => !todayOnly || kind === "plan" || (r.when && Number.isFinite(Date.parse(r.when)) && localParts(new Date(r.when), validTimezone(context.timezone)).date === date));
    if (!rows.length) return `${info.label}: no matching saved entries were returned${todayOnly ? " for today" : ""}.`;
    return `${info.label}${todayOnly ? " for today" : ""}:\n${rows.map(r => `• ${clean(r.title).slice(0, 180)}${formatWhen(r.when, context)}${r.status ? ` (${clean(r.status).slice(0, 30)})` : ""}`).join("\n")}${section.hasMore ? "\nMore entries are available on the full page." : ""}`;
  });
  return answer(`Saved information for ${clean(context.profileName || "your selected care profile").slice(0, 120)} (${validTimezone(context.timezone)}):\n\n${blocks.join("\n\n")}\n\nThis is a record summary, not medical advice.`, kinds.length === 1 ? sectionInfo[kinds[0]].link : resource("Open care calendar", "CareCalendar"));
}

// Reconstruct only the current guided draft from known assistant questions.
// History is untrusted input: it never provides identity, consent, or write permission.
function reminderFlow(message: string, history: AssistantHistory[], context: ToolkitContext): CareAIAnswer | null {
  const lastAssistant = history.at(-1)?.role === "assistant" ? history.at(-1)!.content : "";
  const inFlow = [REMINDER_TITLE, REMINDER_DATE, REMINDER_TIME].some(q => lastAssistant.startsWith(q));
  if (!wantsReminder(message) && !inFlow) return null;
  if (!context.includeCareData || !context.canDraft) return permissionReply();
  let title = "", date = "", time = "", recurrence: "none" | "daily" | "weekly" = "none";
  const turns = [...history.slice(-12), { role: "user" as const, content: message }];
  // Replay from the latest initiation. A new request replaces an unfinished draft.
  let start = -1;
  for (let i = 0; i < turns.length; i++) if (turns[i].role === "user" && wantsReminder(turns[i].content)) start = i;
  if (start < 0) return answer(`${REMINDER_TITLE}\nLet's start again so I don't use incomplete details.`);
  for (let i = start; i < turns.length; i++) {
    if (turns[i].role !== "user") continue;
    const value = clean(turns[i].content);
    const prompt = turns[i - 1]?.role === "assistant" ? turns[i - 1].content : "";
    if (i === start) {
      date = parseToolkitDate(value, context.timezone, context.now) || "";
      time = parseToolkitTime(value) || "";
      // One-message commands accept an explicit title after 'to' or 'about'.
      const titleMatch = value.match(/\bremind me(?:\s+(?:to|about))\s+(.+)/i) || value.match(/\breminder\s+(?:to|about|for)\s+(.+)/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s+\b(?:today|tomorrow|on\s+\d{4}-\d{2}-\d{2}|at\s+\d|every\s+(?:day|week)|daily|weekly)\b.*$/i, "").trim();
        // 'for tomorrow...' is a date, never a title.
        if (/^(?:today|tomorrow|\d{4}-\d{2}-\d{2})\b/i.test(title)) title = "";
      }
      recurrence = /\b(daily|every day)\b/i.test(value) ? "daily" : /\b(weekly|every week)\b/i.test(value) ? "weekly" : "none";
    } else if (prompt.startsWith(REMINDER_TITLE)) title = value;
    else if (prompt.startsWith(REMINDER_DATE)) date = parseToolkitDate(value, context.timezone, context.now) || "";
    else if (prompt.startsWith(REMINDER_TIME)) time = parseToolkitTime(value) || "";
  }
  if (!title) return answer(REMINDER_TITLE);
  if (title.length > 140) return answer(`${REMINDER_TITLE}\nPlease keep the title to 140 characters; add extra detail in the draft’s optional note.`);
  if (!date) return answer(`${REMINDER_DATE}\nI won't guess an ambiguous date.`);
  if (!time) return answer(`${REMINDER_TIME}\nTimezone: ${validTimezone(context.timezone)}. I won't assume morning or evening.`);
  if (!futureLocal(date, time, context)) return answer(`${REMINDER_DATE}\nThat date and time have passed. Please choose a future date, then check the time.`);
  const medication = /\b(medication|medicine|meds|tablets?|insulin|pills?)\b/i.test(title);
  const action = validateAssistantDraft({ type: "create_reminder", title, date, time, recurrence, note: medication ? "Follow the existing prescription and care-team instructions. This reminder does not recommend a dose." : "" });
  return { reply: `Your reminder draft is ready for ${date} at ${time} (${validTimezone(context.timezone)}). Review the title, date, time, repeat setting and optional note below. Nothing has been saved.`, action };
}
function noteFlow(message: string, history: AssistantHistory[], context: ToolkitContext): CareAIAnswer | null {
  const previous = history.at(-1);
  const awaitingNote = previous?.role === "assistant" && previous.content.startsWith(NOTE_CONTENT);
  if (!wantsNote(message) && !awaitingNote) return null;
  if (!context.includeCareData || !context.canDraft) return permissionReply();
  const text = awaitingNote ? clean(message) : clean(message.match(/\bnotes?\s*:\s*([\s\S]+)/i)?.[1] || "");
  if (!text) return answer(NOTE_CONTENT);
  if (text.length > 1400) return answer(`${NOTE_CONTENT}\nPlease keep it to 1,400 characters so the full note can be preserved.`);
  if (/^(yes|ok(?:ay)?|save|confirm|thanks?|no)$/i.test(text)) return answer(`${NOTE_CONTENT}\nI need the note's actual content first.`);
  const summary = text.split(/\n/)[0].slice(0, 180);
  return { reply: "I've prepared your own words as a care-note draft. Review and edit the summary and details below, then use Confirm & save if they are accurate. Nothing has been saved.", action: validateAssistantDraft({ type: "add_care_note", summary, notes: text }) };
}

const guides: Array<{ match: RegExp; reply: string; resource: ToolkitResource }> = [
  { match: /\b(appointments?|doctor visits?)\b/i, reply: "Use Appointments to record a visit's date, time, place and notes. The Doctor Visit Companion helps you prepare questions and capture visit information. I can also draft a reminder; say ‘Set a reminder’.", resource: resource("Open appointments", "Appointments") },
  { match: /\b(reminders?|calendar|agenda)\b/i, reply: "The family care calendar shows scheduled care and reminders. Say ‘Set a reminder’ and I'll ask for the title, date and time. You review and confirm the draft before saving.", resource: resource("Open care calendar", "CareCalendar") },
  { match: /\b(tasks?|to.?do|responsibilit)\b/i, reply: "Care tasks lets your authorized care team record responsibilities, due dates and progress. Open the page to add, assign or complete a task; I cannot change task status from chat.", resource: resource("Open care tasks", "CareTasks") },
  { match: /\b(care plan|routines?)\b/i, reply: "Your care plan organizes the routines recorded for the selected profile. Follow instructions agreed with the care team. I can show the saved plan or help you find it, but cannot recommend treatment.", resource: resource("Open care plan", "CarePlan") },
  { match: /\b(notes?|communication log)\b/i, reply: "Use Care notes & communication log to record factual updates, calls, decisions and follow-ups. Say ‘Write a care note’ to prepare a draft from your own words, then review it before saving.", resource: resource("Open care notes", "CareCommunicationLog") },
  { match: /\b(contacts?|providers?|directory|insurance)\b/i, reply: "Care Contacts holds the providers, services and other contacts saved for a care profile. Open it to view available contact details and use the call or email controls.", resource: resource("Open care contacts", "CareContacts") },
  { match: /\b(documents?|files?|upload|packet)\b/i, reply: "Care documents is where authorized users organize profile documents. Use the page's controls to add or view a file. I cannot upload or send documents from chat.", resource: resource("Open care documents", "CareDocuments") },
  { match: /\b(invite|care team|co.?caregiver|advocate|access review)\b/i, reply: "Care Team manages invitations and each member's authorized access. The primary advocate controls sharing. I cannot grant access or invite people through chat.", resource: resource("Open care team", "CareTeam") },
  { match: /\b(privacy|consent|share.*information|data|chatgpt|openai|api key)\b/i, reply: "This toolkit assistant uses built-in guidance and your authorized app records. Built-in mode does not send your chat to an external AI provider. When you separately enable Natural conversation, the current message and recent chat are sent to a model provider. Profile sharing remains a separate choice. Switching profiles or privacy modes clears this conversation.", resource: resource("Open privacy settings", "PrivacyData") },
  { match: /\b(dark (?:mode|theme)|accessibility|display|text size)\b/i, reply: "Open Accessibility & display to change the app's appearance. Device accessibility settings control reduced motion and system text size.", resource: resource("Open accessibility & display", "Accessibility") },
  { match: /\b(medication|medicine|prescription|pills?|tablets?)\b/i, reply: "Medication Management records the medication information entered by your care team. Follow the existing prescription and ask the prescriber or pharmacist about doses, side effects or changes. I cannot choose or change treatment.", resource: resource("Open medications", "Medications") },
  { match: /\b(hospital to home|discharge|transition)\b/i, reply: "Hospital to Home helps organize the recorded discharge and follow-up information. Use it to keep instructions and next steps together, and ask the care team to clarify anything uncertain.", resource: resource("Open hospital to home", "Transition") },
];

function coreToolkitReply(message: string, history: AssistantHistory[], context: ToolkitContext): CareAIAnswer {
  const text = clean(message);
  if (!text) return answer("Type a toolkit question, or ask me to prepare a reminder or care note.");
  // These are conservative boundaries, not a diagnostic or symptom-detection service.
  if (/\b(?:suicid\w*|kill myself|end my life|hurt myself|self.harm|cannot stay safe|can't stay safe)\b/i.test(text)) return answer("I'm sorry you're facing this. Please reach out to someone you trust now. If you may act on these thoughts or cannot stay safe, contact local emergency services or go to the nearest emergency department. This toolkit cannot provide crisis care.", resource("Open emergency information", "Emergency"));
  if (/\b(emergency|chest pain|can'?t breathe|cannot breathe|unconscious|overdose|severe bleeding|stroke)\b/i.test(text)) return answer("If this describes a current emergency, seek local emergency help immediately. This assistant cannot assess symptoms or monitor safety. Use the app's emergency information for saved contacts and guidance.", resource("Open emergency information", "Emergency"));
  if (/\b(diagnos\w*|prescribe(?: me| a| some|$)|increase (?:my |the )?dose|decrease (?:my |the )?dose|change (?:my |the )?dose|how much (?:insulin|medicine|medication)|should (?:i|we|he|she|they).*(?:take|stop|start)|is .*safe to take)\b/i.test(text)) return answer("I can help organize care information, but I cannot diagnose, prescribe or decide medication doses or changes. Please ask the care team's clinician or pharmacist. I can help you write a factual note or find your saved contacts.", resource("Open care contacts", "CareContacts"));
  if (/^(cancel|stop|never ?mind|discard|start over)[.!\s]*$/i.test(text)) return answer("Okay, I've stopped preparing that draft. No care records were changed. You can ask another toolkit question or start a new reminder or note.");
  if (/^(?:yes|ok(?:ay)?|confirm|save(?: it)?)[.!\s]*$/i.test(text) && history.at(-1)?.role === "assistant" && /draft.*ready|care-note draft/.test(history.at(-1)!.content)) return answer("Please use the draft's Confirm & save button after reviewing its fields. A chat message cannot save a care record.");
  // Explicit help and a new intent can interrupt a guided conversation.
  if (/^(?:help|what can you do|what do you do)[?!.\s]*$/i.test(text)) return helpReply();
  if (wantsNote(text) || /\b(?:turn|make|save|record|note)\b.*\b(?:this|that|it)\b/i.test(text)) {
    if (!/\bnotes?\s*:/i.test(text) && /\b(?:this|that|it)\b/i.test(text)) {
      if (!context.includeCareData || !context.canDraft) return permissionReply();
      const previous = [...history].reverse().find(t => t.role === "user");
      // Only quote the user's own immediately preceding statement. Never turn an assistant
      // summary into an attributed observation or silently attach to a specific record.
      if (previous && isObservation(previous.content) && !/\b(?:appointment|task|reminder|document)\b/i.test(text))
        return noteFlow("Write a care note: " + previous.content, [], context)!;
      return answer("What should the note say, and is it a general care note or a note for a particular appointment or task? I won't guess what ‘this’ refers to. For a general care note, type ‘Write a care note:’ followed by your words.");
    }
    if (/\b(?:to|for|on)\b.{0,30}\b(?:appointment|task|document)\b/i.test(text)) {
      const appointment = /\bappointment\b/i.test(text);
      return answer("To add a note to that specific record, open it and use its note field. Chat can prepare a general care-log note, but it cannot attach notes to individual records yet. You can say ‘Write a care note:’ followed by the facts.", resource(appointment ? "Open appointments" : "Open care tasks", appointment ? "Appointments" : "CareTasks"));
    }
    return noteFlow(text, [], context)!;
  }
  if (wantsTrends(text)) {
    if (!context.includeCareData) return answer("Enable ‘Use this care profile’s information’ to see activity trends for the selected profile.");
    if (!context.trends) return answer("I couldn't load a complete activity chart. Please retry; missing records won't be shown as zero.");
    return { reply: "Here's the last seven calendar days of recorded care activity. Today is still in progress. These counts describe documentation and completed reminders, not health improvement or quality of care.", action: null, trends: context.trends };
  }
  if (wantsReminder(text)) return reminderFlow(text, [], context)!;
  const kinds = requestedToolkitRecords(text);
  if (kinds.length) return summarize(kinds, context, text);
  const guided = noteFlow(text, history, context) || reminderFlow(text, history, context);
  if (guided) return guided;
  if (/\b(who am i|my role|selected profile|care recipient|care receiver|who.*caring for)\b/i.test(text)) {
    return context.includeCareData ? answer(`Selected care profile: ${context.profileName || "name not recorded"}. Your recorded role is ${context.role || "unavailable"}.`, resource("Open care team", "CareTeam")) : answer("Enable profile information to see the selected care profile and your recorded role.");
  }
  if (/\b(stress\w*|overwhelm\w*|exhaust\w*|tired|lonely|sad|anxious|struggling|worried|well.?being|check in)\b/i.test(text)) return answer("Caregiving can take a lot out of you. If possible, pause for a short break and ask someone you trust for support with one practical task. Would you like to open caregiver wellness, review your tasks, or write a care note?", resource("Open caregiver wellness", "Wellness"));
  if (/\b(how are you|how.*doing|chat for a bit)\b/i.test(text)) return answer("I'm here to help you with the toolkit. How are you feeling today? You can tell me you're tired or stressed, ask about your care tasks, or prepare a reminder.");
  if (/^(hi|hey|hello|hey bro|hi bro|hello bro|good morning|good afternoon|good evening|yooo?)[!.\s]*$/i.test(text)) return answer("Hello! I'm your EnVizion toolkit assistant. I can help you find pages, show authorized care updates, and prepare reminders or care notes. What would you like help with?");
  if (/^(thanks?|thank you|thank you bro|thanks bro)[!.\s]*$/i.test(text)) return answer("You're welcome. I'm here whenever you need help with the toolkit.");
  if (/^(?:i(?:'m| am) |it(?:'s| is) |feeling )?(?:doing well|good|great|okay|ok|fine|better|chilling|happy)[.!\s]*$/i.test(text)) return answer("Glad to hear it. We can keep things easy. Want to look at the week, get one small task organized, or just check in? ");
  if (/\b(?:rough|hard|bad|busy) day\b|\bnot (?:great|okay|good)\b/i.test(text)) return answer("Sounds like a lot today. What's been the hardest part: the practical tasks, finding time for yourself, or something else?");
  if (/\b(?:practical tasks|too much to do|where (?:do|should) i start)\b/i.test(text)) return answer("Let's take one thing at a time. We can look at your saved tasks, choose something you want to handle, and prepare a reminder. What would help first?", resource("Open care tasks", "CareTasks"));
  if (/^(?:because|mostly|just|it is|it's)\b/i.test(text) && /hardest part|caregiving can|feeling today/i.test(history.at(-1)?.content || "")) return answer("I hear you. We can stay with that for a moment, or make one practical thing easier. Would you like to tell me more, look at your tasks, or make a note of what happened?");
  if (/\b(?:not feeling well|feel(?:ing)? sick|feel(?:ing)? unwell|under the weather|feeling ill|don't feel well)\b/i.test(text)) return answer("I'm sorry you're not feeling well. What symptoms are you having, and when did they start? If symptoms are severe or rapidly worsening, seek urgent medical help. Nothing will be put in a care log unless you ask.");
  if (isObservation(text)) return answer("Thanks for sharing that. Would you like to keep it in the care log? Say ‘Turn that into a note’ and I'll prepare your exact words for review. Or tell me more.");
  const guide = guides.find(g => g.match.test(text));
  if (guide) return answer(guide.reply, guide.resource);
  return helpReply("I don't understand that request yet. I'm a focused toolkit assistant, so I can't answer every topic.");
}
function helpReply(intro = "I help with EnVizion toolkit tasks using built-in guidance and authorized records.") {
  return answer(`${intro}\n\nTry:\n• Show my appointments\n• Show my care tasks\n• Set a reminder\n• Write a care note\n• Where are my care contacts?\n• I'm feeling tired\n\nReminders and notes always need your review and confirmation. I cannot diagnose, change medication, or save records just because you type ‘yes’.`);
}

export function mustHandleInToolkit(message: string, history: AssistantHistory[]): boolean {
  const text = message.trim();
  if (wantsReminder(text) || wantsNote(text) || wantsTrends(text)) return true;
  if (/\b(?:turn|make|save|record|note)\b.*\b(?:this|that|it)\b/i.test(text)) return true;
  if (/\b(?:suicid\w*|kill myself|end my life|hurt myself|self.harm|cannot stay safe|can't stay safe|emergency|chest pain|can'?t breathe|cannot breathe|unconscious|overdose|severe bleeding|stroke|diagnos\w*|prescribe(?: me| a| some|$)|increase (?:my |the )?dose|decrease (?:my |the )?dose|change (?:my |the )?dose|how much (?:insulin|medicine|medication)|should (?:i|we|he|she|they).*(?:take|stop|start)|is .*safe to take)\b/i.test(text)) return true;
  if (/^(?:cancel|stop|never ?mind|discard|start over|yes|ok(?:ay)?|confirm|save(?: it)?)[.!\s]*$/i.test(text)) return true;
  const last = history.at(-1);
  return last?.role === "assistant" && [REMINDER_TITLE, REMINDER_DATE, REMINDER_TIME, NOTE_CONTENT].some(prompt => last.content.startsWith(prompt));
}
export const wantsTrends = (text: string) => /\b(trends?|graphs?|charts?|care activity|activity (?:this week|over time))\b/i.test(text);
function isObservation(text: string) {
  return text.length > 12 && !text.includes("?") && !wantsNote(text) && !wantsReminder(text) &&
    !requestedToolkitRecords(text).length && !wantsTrends(text) &&
    /\b(?:ate|slept|drank|walked|called|spoke|visited|noticed|reported|said|felt|feeling|booked|finished|helped|today|yesterday)\b/i.test(text);
}
export function toolkitReply(message: string, history: AssistantHistory[], context: ToolkitContext): CareAIAnswer {
  const result = coreToolkitReply(message, history, context);
  if (result.action || /What should the reminder say|What date is the reminder|What time is the reminder|What would you like to record|What should the note say/.test(result.reply)) return result;
  if (/emergency|crisis care|cannot diagnose/.test(result.reply)) return result;
  const suggestions = result.trends ? ["Show my care tasks", "Write a care note"] :
    /keep it in the care log/.test(result.reply) ? ["Turn that into a note", "Show care trends"] :
    /hardest part/.test(result.reply) ? ["Too much to do", "I'm feeling tired"] :
    /feeling today/.test(result.reply) ? ["I'm doing well", "I'm feeling overwhelmed"] :
    ["Show care trends", "Show my care tasks", "Write a care note"];
  return {...result, suggestions};
}
