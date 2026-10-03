import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AgendaEvent, AgendaView } from "./careAgendaHelpers";
import type { CareReminder } from "./reminderHelpers";

export type CareCalendarOfflineSnapshot = {
  version: 1;
  careRecipientId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  view: AgendaView;
  cachedAt: string;
  events: AgendaEvent[];
  reminders: CareReminder[];
};

function key(input: {
  careRecipientId: string;
  rangeStartIso: string;
  view: AgendaView;
}) {
  return [
    "envizion:care-calendar",
    input.careRecipientId,
    input.view,
    input.rangeStartIso.slice(0, 10),
  ].join(":");
}

function compactEvent(event: AgendaEvent): AgendaEvent {
  return {
    ...event,
    title: event.title.slice(0, 160),
    subtitle: event.subtitle.slice(0, 260),
    sourceLabel: event.sourceLabel.slice(0, 80),
  };
}

function compactReminder(reminder: CareReminder): CareReminder {
  return {
    ...reminder,
    title: reminder.title.slice(0, 160),
    note: reminder.note.slice(0, 220),
  };
}

export async function cacheCareCalendarOfflineSnapshot(
  snapshot: Omit<CareCalendarOfflineSnapshot, "version" | "cachedAt">,
) {
  if (Platform.OS === "web") return null;

  const value: CareCalendarOfflineSnapshot = {
    version: 1,
    cachedAt: new Date().toISOString(),
    ...snapshot,
    events: snapshot.events.slice(0, 50).map(compactEvent),
    reminders: snapshot.reminders.slice(0, 30).map(compactReminder),
  };

  let encoded = JSON.stringify(value);

  while (encoded.length > 7_000 && value.events.length > 10) {
    value.events = value.events.slice(0, value.events.length - 5);
    encoded = JSON.stringify(value);
  }

  while (encoded.length > 7_000 && value.reminders.length > 5) {
    value.reminders = value.reminders.slice(0, value.reminders.length - 5);
    encoded = JSON.stringify(value);
  }

  if (encoded.length > 7_000) {
    value.events = value.events.slice(0, 10).map((event) => ({
      ...event,
      subtitle: "",
    }));
    value.reminders = value.reminders.slice(0, 5).map((reminder) => ({
      ...reminder,
      note: "",
    }));
    encoded = JSON.stringify(value);
  }

  await SecureStore.setItemAsync(
    key({
      careRecipientId: value.careRecipientId,
      rangeStartIso: value.rangeStartIso,
      view: value.view,
    }),
    encoded,
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );

  return value;
}

export async function loadCareCalendarOfflineSnapshot(input: {
  careRecipientId: string;
  rangeStartIso: string;
  view: AgendaView;
}) {
  if (Platform.OS === "web") return null;

  const encoded = await SecureStore.getItemAsync(key(input));
  if (!encoded) return null;

  try {
    const value = JSON.parse(encoded) as CareCalendarOfflineSnapshot;
    if (
      value?.version !== 1 ||
      value.careRecipientId !== input.careRecipientId ||
      value.view !== input.view ||
      value.rangeStartIso !== input.rangeStartIso
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}
