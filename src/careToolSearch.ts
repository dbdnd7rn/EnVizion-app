/**
 * Local-only toolkit discovery. This searches the existing navigation registry;
 * it does not search or expose a care recipient's private clinical records.
 */
export type CareToolScope = "all" | "pinned" | "recent" | `category:${string}`;
export type CareToolSort = "relevance" | "alphabetical" | "recent";

export type SearchableCareTool = {
  title: string;
  subtitle: string;
  keywords?: string;
  category: string;
  groupSubtitle?: string;
};

export type CareToolHistory = {
  pinned: readonly string[];
  recent: readonly string[];
  usage: Readonly<Record<string, number>>;
};

export function normalizeCareToolSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIASES: Record<string, readonly string[]> = {
  med: ["medication", "medicine", "meds", "pharmacy", "refill", "dose"],
  meds: ["medication", "medicine", "pharmacy", "refill", "dose"],
  medicine: ["medication", "meds", "pharmacy", "dose"],
  prescriptions: ["medication", "pharmacy", "refill", "dose"],
  rx: ["medication", "prescription", "pharmacy"],
  refill: ["refill", "medication", "pharmacy"],
  docs: ["document", "vault", "files"],
  files: ["document", "vault", "files"],
  documents: ["document", "vault", "files"],
  appt: ["appointment", "visit", "calendar"],
  appts: ["appointment", "visit", "calendar"],
  appointments: ["appointment", "visit", "calendar"],
  doctor: ["doctor", "provider", "specialist", "visit"],
  doctors: ["doctor", "provider", "specialist", "visit"],
  visit: ["visit", "appointment", "doctor"],
  visits: ["visit", "appointment", "doctor"],
  shifts: ["shift", "schedule", "coverage"],
  staffing: ["coverage", "shift", "caregiver"],
  coverage: ["coverage", "shift", "availability"],
  schedule: ["schedule", "calendar", "shift"],
  planning: ["plan", "prepare", "routine"],
  emergency: ["emergency", "warning", "urgent", "red flag"],
  emergencies: ["emergency", "warning", "urgent", "red flag"],
  contacts: ["contact", "provider", "phone"],
  symptoms: ["symptom", "warning", "tracker"],
};

function variants(token: string): string[] {
  const alternate = ALIASES[token] ?? [];
  const singular =
    token.length > 4 && token.endsWith("ies")
      ? token.slice(0, -3) + "y"
      : token.length > 4 && token.endsWith("s")
        ? token.slice(0, -1)
        : token;
  return [...new Set([token, singular, ...alternate])];
}

function matchingScore(tool: SearchableCareTool, query: string): number {
  const normalized = normalizeCareToolSearch(query);
  if (!normalized) return 0;
  const title = normalizeCareToolSearch(tool.title);
  const keywords = normalizeCareToolSearch(tool.keywords ?? "");
  const subtitle = normalizeCareToolSearch(tool.subtitle);
  const category = normalizeCareToolSearch(tool.category);
  const groupSubtitle = normalizeCareToolSearch(tool.groupSubtitle ?? "");

  let total = title.includes(normalized) ? 16 : 0;
  for (const token of normalized.split(/\s+/)) {
    let best = 0;
    for (const candidate of variants(token)) {
      const literal = candidate === token;
      const phrase = ` ${candidate}`;
      const weight = literal ? 1 : 0.65;
      if (title.includes(candidate)) best = Math.max(best, 10 * weight);
      if (title.startsWith(candidate) || title.includes(phrase))
        best = Math.max(best, 12 * weight);
      if (keywords.includes(candidate)) best = Math.max(best, 7 * weight);
      if (subtitle.includes(candidate)) best = Math.max(best, 5 * weight);
      if (category.includes(candidate)) best = Math.max(best, 4 * weight);
      if (groupSubtitle.includes(candidate)) best = Math.max(best, 2 * weight);
    }
    // Multiple terms must all match; do not show unrelated tools for
    // searches such as "medication refill".
    if (best === 0) return -1;
    total += best;
  }
  return total;
}

export function findCareTools<T extends SearchableCareTool>(
  items: readonly T[],
  query: string,
  scope: CareToolScope,
  sort: CareToolSort,
  history: CareToolHistory,
): T[] {
  const searchActive = Boolean(normalizeCareToolSearch(query));
  const filtered = items
    .map((item, index) => ({
      item,
      index,
      score: searchActive ? matchingScore(item, query) : 0,
    }))
    .filter(({ item, score }) => {
      if (searchActive && score < 0) return false;
      if (scope === "pinned") return history.pinned.includes(item.title);
      if (scope === "recent") return history.recent.includes(item.title);
      if (scope.startsWith("category:"))
        return item.category === scope.slice("category:".length);
      return true;
    });

  filtered.sort((a, b) => {
    if (sort === "alphabetical")
      return a.item.title.localeCompare(b.item.title);
    if (sort === "recent") {
      const aRecent = history.recent.indexOf(a.item.title);
      const bRecent = history.recent.indexOf(b.item.title);
      if (aRecent !== bRecent)
        return (aRecent < 0 ? Number.MAX_SAFE_INTEGER : aRecent) -
          (bRecent < 0 ? Number.MAX_SAFE_INTEGER : bRecent);
    }
    if (searchActive && a.score !== b.score) return b.score - a.score;
    const aPinned = Number(history.pinned.includes(a.item.title));
    const bPinned = Number(history.pinned.includes(b.item.title));
    if (aPinned !== bPinned) return bPinned - aPinned;
    if (searchActive || scope !== "all") {
      const aUse = history.usage[a.item.title] ?? 0;
      const bUse = history.usage[b.item.title] ?? 0;
      if (aUse !== bUse) return bUse - aUse;
    }
    return a.index - b.index;
  });

  return filtered.map(({ item }) => item);
}
