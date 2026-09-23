import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  archiveCarePlanItem,
  createCarePlanItem,
  loadCarePlan,
  setCarePlanCompletion,
  type CarePlanCategory,
  type CarePlanCompletion,
  type CarePlanItem,
  type CarePlanPriority,
} from "../carePlan";
import {
  carePlanCompletionForItemToday,
  carePlanItemIsForToday,
  carePlanLocalDateKey,
  carePlanTodaySummary,
  carePlanWeekdayLabels,
} from "../carePlanHelpers";
import { notificationTimezone } from "../notificationPreferences";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

const categories: Array<{
  value: CarePlanCategory;
  label: string;
  icon: string;
}> = [
  { value: "medication", label: "Medication", icon: "medical-outline" },
  { value: "meal", label: "Meals", icon: "restaurant-outline" },
  { value: "mobility", label: "Mobility", icon: "walk-outline" },
  { value: "hygiene", label: "Hygiene", icon: "water-outline" },
  { value: "monitoring", label: "Monitoring", icon: "pulse-outline" },
  { value: "appointment", label: "Appointment", icon: "calendar-outline" },
  { value: "comfort", label: "Comfort", icon: "heart-outline" },
  { value: "other", label: "Other", icon: "list-outline" },
];

function categoryLabel(category: CarePlanCategory) {
  return categories.find((item) => item.value === category)?.label ?? "Other";
}

export function CarePlanScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [items, setItems] = useState<CarePlanItem[]>([]);
  const [completions, setCompletions] = useState<CarePlanCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CarePlanCategory>("other");
  const [details, setDetails] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [priority, setPriority] = useState<CarePlanPriority>("routine");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setItems([]);
      setCompletions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadCarePlan(careRecipientId);
      setItems(result.items);
      setCompletions(result.completions);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the daily care plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-plan:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_plan_items",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_plan_completions",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const today = useMemo(
    () => items.filter((item) => carePlanItemIsForToday(item)),
    [items],
  );
  const summary = useMemo(
    () => carePlanTodaySummary(items, completions),
    [completions, items],
  );

  async function saveRoutine() {
    if (!careRecipientId || readOnly) return;
    setBusyId("new");
    setMessage("");

    try {
      await createCarePlanItem({
        careRecipientId,
        title,
        category,
        details,
        localTime,
        timezone: notificationTimezone(),
        daysOfWeek: days,
        priority,
      });
      setTitle("");
      setCategory("other");
      setDetails("");
      setLocalTime("");
      setDays([1, 2, 3, 4, 5, 6, 7]);
      setPriority("routine");
      setAdding(false);
      await refresh();
      setMessage("Daily care routine added.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not add this care routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCompletion(item: CarePlanItem) {
    if (!careRecipientId || readOnly) return;
    const completion = carePlanCompletionForItemToday(item, completions);
    setBusyId(item.id);
    setMessage("");

    try {
      await setCarePlanCompletion({
        careRecipientId,
        itemId: item.id,
        completedOn: carePlanLocalDateKey(new Date(), item.timezone),
        completed: !completion,
      });
      await refresh();
      setMessage(
        completion
          ? item.title + " returned to today’s plan."
          : item.title + " marked complete for today.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this care routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function archive(item: CarePlanItem) {
    if (!careRecipientId || readOnly) return;
    setBusyId("archive-" + item.id);
    try {
      await archiveCarePlanItem(careRecipientId, item.id);
      await refresh();
      setMessage(item.title + " archived from the active care plan.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not archive this routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="DAILY CARE PLAN"
          title="Choose a care profile first."
          body="Daily routines belong to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE PLAN"
        title="Keep the everyday care routine visible to everyone."
        body="Meals, medications, mobility, hygiene, monitoring, appointments, and comfort routines can live in one shared plan."
      />

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>You can review the plan, but only Owners and Caregivers can change it.</Txt>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>TODAY</Text>
          <Text style={S.h2}>{summary.total}</Text>
          <Txt style={S.small}>planned routines</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>DONE</Text>
          <Text style={S.h2}>{summary.completed}</Text>
          <Txt style={S.small}>completed today</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>REMAINING</Text>
          <Text style={S.h2}>{summary.remaining}</Text>
          <Txt style={S.small}>still open</Txt>
        </Card>
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 145 }}>
          <Button
            title="Medication management"
            secondary
            icon="medical-outline"
            onPress={() => n.navigate("Medications")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 145 }}>
          <Button
            title="Appointment prep"
            secondary
            icon="calendar-outline"
            onPress={() => n.navigate("Appointments")}
          />
        </View>
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>{message}</Text>
        </Card>
      )}

      <Section title="Today’s care" />
      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading the shared care plan…</Txt>
        </Card>
      ) : !today.length ? (
        <Card>
          <Icon name="checkmark-done-outline" />
          <Text style={S.h3}>No recurring routines are scheduled for today.</Text>
          <Txt>Add a routine below when there is something the care team should see every day or on selected days.</Txt>
        </Card>
      ) : (
        today.map((item) => {
          const completion = carePlanCompletionForItemToday(item, completions);
          return (
            <Card
              key={item.id}
              style={{
                backgroundColor: completion ? "#EAF4EF" : C.white,
                borderColor:
                  item.priority === "important" && !completion
                    ? "#E7C5A5"
                    : C.line,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.eyebrow}>
                    {categoryLabel(item.category).toUpperCase()}
                    {item.priority === "important" ? " · IMPORTANT" : ""}
                  </Text>
                  <Text style={S.h2}>{item.title}</Text>
                  <Txt style={S.small}>
                    {item.localTime
                      ? item.localTime + " · " + item.timezone
                      : "Any time today"}
                  </Txt>
                </View>
                <Icon
                  name={completion ? "checkmark-circle" : "ellipse-outline"}
                  color={completion ? C.green : C.muted}
                  size={28}
                />
              </View>
              {Boolean(item.details) && <Txt>{item.details}</Txt>}
              <Button
                title={
                  completion
                    ? "Mark as not completed"
                    : busyId === item.id
                      ? "Saving…"
                      : "Mark complete"
                }
                secondary={Boolean(completion)}
                disabled={readOnly || busyId !== null}
                icon={completion ? "arrow-undo-outline" : "checkmark-outline"}
                onPress={() => void toggleCompletion(item)}
              />
            </Card>
          );
        })
      )}

      <Section title="Build the routine" />
      <Button
        title={adding ? "Cancel new routine" : "Add care routine"}
        secondary
        icon={adding ? "close-outline" : "add-outline"}
        disabled={readOnly || busyId !== null}
        onPress={() => setAdding((value) => !value)}
      />

      {adding && (
        <Card>
          <Field label="Routine title" value={title} onChange={setTitle} />
          <Field
            label="Care instructions or notes"
            value={details}
            onChange={setDetails}
            multiline
          />
          <Field
            label="Time (HH:MM, optional)"
            value={localTime}
            onChange={(value) => setLocalTime(value.slice(0, 5))}
          />

          <Text style={S.h3}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: category === item.value }}
                onPress={() => setCategory(item.value)}
                style={[
                  S.pill,
                  {
                    backgroundColor:
                      category === item.value ? C.purple : "#F0EBF1",
                  },
                ]}
              >
                <Text
                  style={[
                    S.small,
                    { color: category === item.value ? C.white : C.ink },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={S.h3}>Days</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {carePlanWeekdayLabels.map((day) => {
              const selected = days.includes(day.iso);
              return (
                <Pressable
                  key={day.iso}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setDays((current) =>
                      selected
                        ? current.filter((value) => value !== day.iso)
                        : [...current, day.iso].sort((a, b) => a - b),
                    )
                  }
                  style={[
                    S.pill,
                    {
                      backgroundColor: selected ? C.purple : "#F0EBF1",
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      { color: selected ? C.white : C.ink },
                    ]}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={S.h3}>Priority</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["routine", "important"] as CarePlanPriority[]).map((value) => (
              <View key={value} style={{ flex: 1 }}>
                <Button
                  title={value === "routine" ? "Routine" : "Important"}
                  secondary={priority !== value}
                  onPress={() => setPriority(value)}
                />
              </View>
            ))}
          </View>

          <Button
            title={busyId === "new" ? "Adding routine…" : "Add to care plan"}
            disabled={
              readOnly ||
              busyId !== null ||
              !title.trim() ||
              !days.length
            }
            onPress={() => void saveRoutine()}
          />
        </Card>
      )}

      <Section title="Active plan library" />
      {items.map((item) => (
        <Card key={"library-" + item.id}>
          <View style={S.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.h3}>{item.title}</Text>
              <Txt style={S.small}>
                {categoryLabel(item.category)} ·{" "}
                {item.daysOfWeek
                  .map(
                    (iso) =>
                      carePlanWeekdayLabels.find((day) => day.iso === iso)
                        ?.label ?? iso,
                  )
                  .join(", ")}
                {item.localTime ? " · " + item.localTime : ""}
              </Txt>
            </View>
            <Icon name="repeat-outline" />
          </View>
          <Button
            title="Archive routine"
            secondary
            disabled={readOnly || busyId !== null}
            onPress={() => void archive(item)}
          />
        </Card>
      ))}

      <Txt style={S.small}>
        This shared plan organizes care routines. It does not replace the
        instructions provided by the healthcare team.
      </Txt>
    </Page>
  );
}
