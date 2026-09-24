import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "envizion.smart-tool-preferences.v1";
const MAX_RECENT = 6;

export type ToolPreferences = {
  pinned: string[];
  recent: string[];
  usage: Record<string, number>;
};

const EMPTY: ToolPreferences = {
  pinned: [],
  recent: [],
  usage: {},
};

function normalize(value: unknown): ToolPreferences {
  if (!value || typeof value !== "object") return { ...EMPTY };

  const item = value as Partial<ToolPreferences>;

  return {
    pinned: Array.isArray(item.pinned)
      ? item.pinned.filter((entry): entry is string => typeof entry === "string")
      : [],
    recent: Array.isArray(item.recent)
      ? item.recent
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, MAX_RECENT)
      : [],
    usage:
      item.usage && typeof item.usage === "object"
        ? Object.fromEntries(
            Object.entries(item.usage).filter(
              ([key, count]) =>
                Boolean(key) && typeof count === "number" && Number.isFinite(count),
            ),
          )
        : {},
  };
}

export async function loadToolPreferences(): Promise<ToolPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

async function persist(preferences: ToolPreferences) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Personalization is helpful, but navigation must keep working if local
    // storage is unavailable or full.
  }
}

export function withRecordedUse(
  preferences: ToolPreferences,
  toolTitle: string,
): ToolPreferences {
  return {
    ...preferences,
    recent: [
      toolTitle,
      ...preferences.recent.filter((title) => title !== toolTitle),
    ].slice(0, MAX_RECENT),
    usage: {
      ...preferences.usage,
      [toolTitle]: (preferences.usage[toolTitle] || 0) + 1,
    },
  };
}

export async function recordToolUse(
  preferences: ToolPreferences,
  toolTitle: string,
): Promise<ToolPreferences> {
  const next = withRecordedUse(preferences, toolTitle);
  await persist(next);
  return next;
}

export function withToggledPin(
  preferences: ToolPreferences,
  toolTitle: string,
): ToolPreferences {
  const pinned = preferences.pinned.includes(toolTitle)
    ? preferences.pinned.filter((title) => title !== toolTitle)
    : [toolTitle, ...preferences.pinned];

  return {
    ...preferences,
    pinned,
  };
}

export async function togglePinnedTool(
  preferences: ToolPreferences,
  toolTitle: string,
): Promise<ToolPreferences> {
  const next = withToggledPin(preferences, toolTitle);
  await persist(next);
  return next;
}

export function rankToolTitles(preferences: ToolPreferences): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const title of preferences.pinned) {
    if (!seen.has(title)) {
      seen.add(title);
      ordered.push(title);
    }
  }

  const recentByUsage = [...preferences.recent].sort(
    (a, b) => (preferences.usage[b] || 0) - (preferences.usage[a] || 0),
  );

  for (const title of recentByUsage) {
    if (!seen.has(title)) {
      seen.add(title);
      ordered.push(title);
    }
  }

  return ordered;
}
