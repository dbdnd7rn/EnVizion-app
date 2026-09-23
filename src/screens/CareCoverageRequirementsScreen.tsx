import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  createCareCoverageRequirement,
  deleteCareCoverageRequirement,
  loadCareCoverageRequirements,
  updateCareCoverageRequirement,
  type CareCoverageRequirement,
} from "../careCoverageRequirements";
import {
  detectedTimezone,
  localDateTimeToIso,
  reminderLocalParts,
} from "../reminders";
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

type Draft = {
  label: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string;
  note: string;
};

const weekdays = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 7, label: "Sun" },
] as const;

function blankDraft(): Draft {
  return {
    label: "Care coverage required",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "07:00",
    endTime: "09:00",
    timezone: detectedTimezone(),
    effectiveFrom: reminderLocalParts(new Date().toISOString()).date,
    effectiveUntil: "",
    note: "",
  };
}

function fromRequirement(item: CareCoverageRequirement): Draft {
  return {
    label: item.label,
    daysOfWeek: [...item.daysOfWeek],
    startTime: item.startLocalTime,
    endTime: item.endLocalTime,
    timezone: item.timezone,
    effectiveFrom: item.effectiveFrom,
    effectiveUntil: item.effectiveUntil ?? "",
    note: item.note,
  };
}

function daysLabel(days: number[]) {
  const normalized = [...new Set(days)].sort((a, b) => a - b);
  if (
    normalized.length === 5 &&
    normalized.every((day, index) => day === index + 1)
  ) {
    return "Mon–Fri";
  }
  if (
    normalized.length === 2 &&
    normalized[0] === 6 &&
    normalized[1] === 7
  ) {
    return "Weekends";
  }
  if (normalized.length === 7) return "Every day";
  return weekdays
    .filter((item) => normalized.includes(item.day))
    .map((item) => item.label)
    .join(", ");
}

export function CareCoverageRequirementsScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [requirements, setRequirements] = useState<
    CareCoverageRequirement[]
  >([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setRequirements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setRequirements(await loadCareCoverageRequirements(careRecipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load recurring care coverage requirements.",
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
      .channel("care-coverage-requirements:" + careRecipientId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coverage_requirements",
          filter: "care_recipient_id=eq." + careRecipientId,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const ordered = useMemo(
    () =>
      [...requirements].sort((a, b) => {
        const dayDifference =
          Math.min(...a.daysOfWeek) - Math.min(...b.daysOfWeek);
        if (dayDifference) return dayDifference;
        return a.startLocalTime.localeCompare(b.startLocalTime);
      }),
    [requirements],
  );

  function openNew() {
    setEditingId(null);
    setDraft(blankDraft());
    setFormOpen(true);
    setPendingDeleteId(null);
    setMessage("");
  }

  function openEdit(item: CareCoverageRequirement) {
    setEditingId(item.id);
    setDraft(fromRequirement(item));
    setFormOpen(true);
    setPendingDeleteId(null);
    setMessage("");
  }

  function validateDraft() {
    const label = draft.label.trim();
    if (!label) throw new Error("Give this recurring care window a name.");
    if (!draft.daysOfWeek.length) {
      throw new Error("Choose at least one weekday.");
    }

    const startCheck = localDateTimeToIso("2026-01-15", draft.startTime);
    const endCheck = localDateTimeToIso("2026-01-15", draft.endTime);
    if (!startCheck || !endCheck) {
      throw new Error("Use 24-hour times such as 07:00 and 09:00.");
    }
    if (draft.startTime === draft.endTime) {
      throw new Error("Start and end time cannot be the same.");
    }

    const fromCheck = localDateTimeToIso(draft.effectiveFrom, "12:00");
    if (!fromCheck) {
      throw new Error("Use a valid effective-from date such as 2026-09-23.");
    }

    if (draft.effectiveUntil) {
      const untilCheck = localDateTimeToIso(draft.effectiveUntil, "12:00");
      if (!untilCheck) {
        throw new Error("Use a valid end date or leave it blank.");
      }
      if (new Date(untilCheck).getTime() < new Date(fromCheck).getTime()) {
        throw new Error(
          "The recurring care requirement cannot end before it starts.",
        );
      }
    }

    return {
      label,
      daysOfWeek: [...new Set(draft.daysOfWeek)].sort((a, b) => a - b),
      startLocalTime: draft.startTime,
      endLocalTime: draft.endTime,
      timezone: draft.timezone.trim() || detectedTimezone(),
      effectiveFrom: draft.effectiveFrom,
      effectiveUntil: draft.effectiveUntil.trim() || null,
      note: draft.note,
    };
  }

  async function save() {
    if (!careRecipientId || readOnly || busy) return;

    setBusy("save");
    setMessage("");
    try {
      const input = validateDraft();

      if (editingId) {
        await updateCareCoverageRequirement(
          careRecipientId,
          editingId,
          input,
        );
        setMessage("Recurring care coverage requirement updated.");
      } else {
        await createCareCoverageRequirement(careRecipientId, input);
        setMessage("Recurring care coverage requirement saved.");
      }

      setFormOpen(false);
      setEditingId(null);
      setDraft(blankDraft());
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save that recurring care requirement.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: CareCoverageRequirement) {
    if (!careRecipientId || readOnly || busy) return;

    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      setMessage(
        "Tap remove again to confirm. Existing scheduled shifts will not be deleted.",
      );
      return;
    }

    setBusy("delete:" + item.id);
    setMessage("");
    try {
      await deleteCareCoverageRequirement(careRecipientId, item.id);
      setPendingDeleteId(null);
      if (editingId === item.id) {
        setEditingId(null);
        setFormOpen(false);
        setDraft(blankDraft());
      }
      await refresh();
      setMessage(
        "Recurring care requirement removed. Existing scheduled shifts were kept.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not remove that recurring care requirement.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="RECURRING CARE COVERAGE"
          title="Choose a care profile first."
          body="Required care windows belong to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="RECURRING CARE COVERAGE"
        title="Define when caregiver coverage is actually required."
        body="Save repeatable care windows once. Smart Coverage Planner compares these requirements against scheduled shifts and only surfaces the genuinely uncovered portions."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Icon name="time-outline" color="#E5C8ED" size={28} />
        <Text style={[S.h2, { color: C.white }]}>
          Care demand is separate from caregiver availability.
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          A required-care window says when this care profile needs coverage.
          Caregiver availability says who may be able to provide it. EnVizion
          only matches the two after the schedule is considered.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can review recurring care requirements, but only Owners and
            Caregivers can change them.
          </Txt>
        </Card>
      )}

      <View style={{ gap: 9 }}>
        {!readOnly && (
          <Button
            title={formOpen ? "Close requirement form" : "Add recurring care requirement"}
            icon="add-circle-outline"
            onPress={() => {
              if (formOpen) {
                setFormOpen(false);
                setEditingId(null);
                setDraft(blankDraft());
              } else {
                openNew();
              }
            }}
          />
        )}
        <Button
          title="Open Smart Coverage Planner"
          secondary
          icon="sparkles-outline"
          onPress={() => n.navigate("SmartCoveragePlanner")}
        />
      </View>

      {formOpen && !readOnly && (
        <Card>
          <Text style={S.eyebrow}>
            {editingId ? "EDIT RECURRING WINDOW" : "NEW RECURRING WINDOW"}
          </Text>
          <Text style={S.h2}>When is caregiver coverage required?</Text>

          <Field
            label="Requirement name"
            value={draft.label}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                label: value.slice(0, 160),
              }))
            }
          />

          <Text style={S.h3}>Repeats on</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {weekdays.map((item) => {
              const selected = draft.daysOfWeek.includes(item.day);
              return (
                <Pressable
                  key={item.day}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      daysOfWeek: selected
                        ? current.daysOfWeek.filter(
                            (day) => day !== item.day,
                          )
                        : [...current.daysOfWeek, item.day].sort(
                            (a, b) => a - b,
                          ),
                    }))
                  }
                  style={[
                    S.pill,
                    {
                      minWidth: 52,
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: selected ? C.purple : C.lavender,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.h3,
                      {
                        fontSize: 11,
                        color: selected ? C.white : C.deep,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Start time (HH:MM)"
                value={draft.startTime}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    startTime: value,
                  }))
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="End time (HH:MM)"
                value={draft.endTime}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    endTime: value,
                  }))
                }
              />
            </View>
          </View>

          {/^\d{2}:\d{2}$/.test(draft.startTime) &&
            /^\d{2}:\d{2}$/.test(draft.endTime) &&
            draft.endTime < draft.startTime && (
              <Txt style={S.small}>
                Overnight care window · the end time is on the following day.
              </Txt>
            )}

          <Field
            label="Time zone (IANA)"
            value={draft.timezone}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                timezone: value.slice(0, 100),
              }))
            }
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Effective from (YYYY-MM-DD)"
                value={draft.effectiveFrom}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    effectiveFrom: value,
                  }))
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Ends on · optional"
                value={draft.effectiveUntil}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    effectiveUntil: value,
                  }))
                }
              />
            </View>
          </View>

          <Field
            label="Care coverage note"
            value={draft.note}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                note: value.slice(0, 1000),
              }))
            }
            multiline
          />

          <Button
            title={
              busy === "save"
                ? "Saving requirement…"
                : editingId
                  ? "Update recurring requirement"
                  : "Save recurring requirement"
            }
            disabled={busy === "save" || !draft.daysOfWeek.length}
            icon="checkmark-circle-outline"
            onPress={() => void save()}
          />
        </Card>
      )}

      <Section title="Recurring care requirements" />

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading required care windows…</Txt>
        </Card>
      ) : ordered.length ? (
        ordered.map((item) => {
          const overnight = item.endLocalTime < item.startLocalTime;
          return (
            <Card key={item.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h2}>{item.label}</Text>
                  <Txt style={S.small}>
                    {daysLabel(item.daysOfWeek)} · {item.startLocalTime} →{" "}
                    {item.endLocalTime}
                    {overnight ? " next day" : ""}
                  </Txt>
                </View>
                <View style={[S.pill, { backgroundColor: C.lavender }]}>
                  <Text style={[S.small, { color: C.deep }]}>
                    Required care
                  </Text>
                </View>
              </View>

              <Txt style={S.small}>Time zone · {item.timezone}</Txt>
              <Txt style={S.small}>
                Effective {item.effectiveFrom}
                {item.effectiveUntil
                  ? " → " + item.effectiveUntil
                  : " · ongoing"}
              </Txt>
              {Boolean(item.note) && <Txt>{item.note}</Txt>}

              {!readOnly && (
                <View style={{ gap: 8 }}>
                  <Button
                    title="Edit requirement"
                    secondary
                    icon="create-outline"
                    disabled={Boolean(busy)}
                    onPress={() => openEdit(item)}
                  />
                  <Button
                    title={
                      pendingDeleteId === item.id
                        ? busy === "delete:" + item.id
                          ? "Removing…"
                          : "Confirm remove"
                        : "Remove requirement"
                    }
                    secondary
                    disabled={Boolean(busy)}
                    onPress={() => void remove(item)}
                  />
                </View>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Icon name="time-outline" />
          <Text style={S.h3}>No recurring care requirements yet.</Text>
          <Txt>
            Add only the times this care profile actually needs caregiver
            coverage. EnVizion will not assume the rest of the day requires
            care.
          </Txt>
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Planning information, not a clinical prescription.</Text>
        <Txt>
          These windows describe the family’s recorded coverage plan. They do
          not determine the level of care a person medically requires and do
          not replace instructions from the healthcare team.
        </Txt>
      </Card>
    </Page>
  );
}
