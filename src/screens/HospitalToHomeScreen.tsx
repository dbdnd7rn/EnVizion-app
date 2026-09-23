import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { setTransitionItem } from "../backend";
import {
  completeCareTransitionPlan,
  createTransitionFollowUp,
  loadCareTransitionWorkspace,
  saveCareTransitionPlan,
  setTransitionFollowUpStatus,
  type CareTransitionFollowUp,
  type CareTransitionPlan,
} from "../careTransition";
import {
  transitionFollowUpCounts,
  transitionFollowUpTiming,
} from "../careTransitionHelpers";
import { transitionSteps } from "../content";
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

type PlanDraft = {
  hospitalName: string;
  dischargeDate: string;
  dischargeSummary: string;
  primaryDiagnosis: string;
  medicationChanges: string;
  followUpPlan: string;
  equipmentPlan: string;
  transportPlan: string;
  warningSigns: string;
  afterHoursContact: string;
};

const emptyPlan: PlanDraft = {
  hospitalName: "",
  dischargeDate: "",
  dischargeSummary: "",
  primaryDiagnosis: "",
  medicationChanges: "",
  followUpPlan: "",
  equipmentPlan: "",
  transportPlan: "",
  warningSigns: "",
  afterHoursContact: "",
};

export function HospitalToHomeScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [plan, setPlan] = useState<CareTransitionPlan | null>(null);
  const [followUps, setFollowUps] = useState<CareTransitionFollowUp[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan);
  const [editingPlan, setEditingPlan] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpProvider, setFollowUpProvider] = useState("");
  const [followUpDetails, setFollowUpDetails] = useState("");
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setPlan(null);
      setFollowUps([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadCareTransitionWorkspace(careRecipientId);
      setPlan(result.plan);
      setFollowUps(result.followUps);
      if (result.plan) {
        setDraft({
          hospitalName: result.plan.hospitalName,
          dischargeDate: result.plan.dischargeDate,
          dischargeSummary: result.plan.dischargeSummary,
          primaryDiagnosis: result.plan.primaryDiagnosis,
          medicationChanges: result.plan.medicationChanges,
          followUpPlan: result.plan.followUpPlan,
          equipmentPlan: result.plan.equipmentPlan,
          transportPlan: result.plan.transportPlan,
          warningSigns: result.plan.warningSigns,
          afterHoursContact: result.plan.afterHoursContact,
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the hospital-to-home plan.",
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
      .channel(`transition-plan:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_transition_plans",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_transition_followups",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const counts = useMemo(
    () => transitionFollowUpCounts(followUps),
    [followUps],
  );
  const checklistComplete = state.transition.length;
  const checklistProgress = transitionSteps.length
    ? checklistComplete / transitionSteps.length
    : 0;

  function beginPlanEdit() {
    if (!plan) setDraft(emptyPlan);
    setEditingPlan(true);
    setMessage("");
  }

  async function savePlan() {
    if (!careRecipientId || readOnly) return;
    setBusyId("plan");
    setMessage("");

    try {
      const saved = await saveCareTransitionPlan({
        careRecipientId,
        id: plan?.status === "active" ? plan.id : null,
        ...draft,
      });
      setPlan(saved);
      setEditingPlan(false);
      await refresh();
      setMessage("Hospital-to-home plan saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the transition plan.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function addFollowUp() {
    if (!careRecipientId || !plan || readOnly) return;
    setBusyId("follow-up");
    setMessage("");
    try {
      await createTransitionFollowUp({
        careRecipientId,
        planId: plan.id,
        title: followUpTitle,
        dueAt: followUpDueAt,
        provider: followUpProvider,
        details: followUpDetails,
      });
      setFollowUpTitle("");
      setFollowUpDueAt("");
      setFollowUpProvider("");
      setFollowUpDetails("");
      setAddingFollowUp(false);
      await refresh();
      setMessage("Follow-up added to the transition plan.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not add this follow-up.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="HOSPITAL TO HOME"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="HOSPITAL TO HOME"
        title="Turn discharge instructions into a shared transition plan."
        body="Keep the discharge summary, medication changes, equipment, transport, warning signs, contacts, and follow-ups together for the family care team."
      />

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>You can review this transition but cannot change it.</Txt>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>CHECKLIST</Text>
          <Text style={S.h2}>
            {checklistComplete}/{transitionSteps.length}
          </Text>
          <Txt style={S.small}>prepared</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>FOLLOW-UPS</Text>
          <Text style={S.h2}>{counts.open}</Text>
          <Txt style={S.small}>still open</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>PLAN</Text>
          <Text style={[S.h3, { fontSize: 14 }]}>
            {plan?.status === "active"
              ? "Active"
              : plan?.status === "completed"
                ? "Completed"
                : "Not started"}
          </Text>
        </Card>
      </View>

      <View style={{ height: 7, backgroundColor: "#DDCDE6", borderRadius: 999 }}>
        <View
          style={{
            height: 7,
            width: `${Math.round(checklistProgress * 100)}%`,
            backgroundColor: C.purple,
            borderRadius: 999,
          }}
        />
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
            title="Daily care plan"
            secondary
            icon="list-outline"
            onPress={() => n.navigate("CarePlan")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 145 }}>
          <Button
            title="Document vault"
            secondary
            icon="folder-open-outline"
            onPress={() => n.navigate("CareDocuments")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 145 }}>
          <Button
            title="Care contacts"
            secondary
            icon="call-outline"
            onPress={() => n.navigate("CareContacts")}
          />
        </View>
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>{message}</Text>
        </Card>
      )}

      <Section title="Discharge plan" />
      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading transition plan…</Txt>
        </Card>
      ) : !plan || editingPlan ? (
        <Card>
          <Field
            label="Hospital / facility"
            value={draft.hospitalName}
            onChange={(hospitalName) =>
              setDraft((current) => ({ ...current, hospitalName }))
            }
          />
          <Field
            label="Discharge date (YYYY-MM-DD)"
            value={draft.dischargeDate}
            onChange={(dischargeDate) =>
              setDraft((current) => ({ ...current, dischargeDate }))
            }
          />
          <Field
            label="Primary diagnosis / reason for stay"
            value={draft.primaryDiagnosis}
            onChange={(primaryDiagnosis) =>
              setDraft((current) => ({ ...current, primaryDiagnosis }))
            }
            multiline
          />
          <Field
            label="Discharge summary / key instructions"
            value={draft.dischargeSummary}
            onChange={(dischargeSummary) =>
              setDraft((current) => ({ ...current, dischargeSummary }))
            }
            multiline
          />
          <Field
            label="Medication changes"
            value={draft.medicationChanges}
            onChange={(medicationChanges) =>
              setDraft((current) => ({ ...current, medicationChanges }))
            }
            multiline
          />
          <Field
            label="Follow-up plan"
            value={draft.followUpPlan}
            onChange={(followUpPlan) =>
              setDraft((current) => ({ ...current, followUpPlan }))
            }
            multiline
          />
          <Field
            label="Equipment / supplies needed"
            value={draft.equipmentPlan}
            onChange={(equipmentPlan) =>
              setDraft((current) => ({ ...current, equipmentPlan }))
            }
            multiline
          />
          <Field
            label="Transport / getting home"
            value={draft.transportPlan}
            onChange={(transportPlan) =>
              setDraft((current) => ({ ...current, transportPlan }))
            }
            multiline
          />
          <Field
            label="Warning signs exactly as provided by the discharge team"
            value={draft.warningSigns}
            onChange={(warningSigns) =>
              setDraft((current) => ({ ...current, warningSigns }))
            }
            multiline
          />
          <Field
            label="After-hours contact / instructions"
            value={draft.afterHoursContact}
            onChange={(afterHoursContact) =>
              setDraft((current) => ({ ...current, afterHoursContact }))
            }
            multiline
          />

          <Button
            title={busyId === "plan" ? "Saving plan…" : "Save transition plan"}
            disabled={readOnly || busyId !== null}
            onPress={() => void savePlan()}
          />
          {plan && (
            <Button
              title="Cancel editing"
              secondary
              onPress={() => {
                setEditingPlan(false);
                void refresh();
              }}
            />
          )}
        </Card>
      ) : (
        <Card style={{ backgroundColor: C.lavender }}>
          <Text style={S.eyebrow}>ACTIVE TRANSITION</Text>
          <Text style={S.h2}>
            {plan.hospitalName || "Hospital-to-home plan"}
          </Text>
          <Txt style={S.small}>
            {plan.dischargeDate
              ? "Discharge date · " + plan.dischargeDate
              : "Discharge date not recorded"}
          </Txt>
          {Boolean(plan.primaryDiagnosis) && (
            <Txt>Reason for stay: {plan.primaryDiagnosis}</Txt>
          )}
          {Boolean(plan.dischargeSummary) && (
            <Txt>Key instructions: {plan.dischargeSummary}</Txt>
          )}
          {Boolean(plan.medicationChanges) && (
            <Txt>Medication changes: {plan.medicationChanges}</Txt>
          )}
          {Boolean(plan.equipmentPlan) && (
            <Txt>Equipment: {plan.equipmentPlan}</Txt>
          )}
          {Boolean(plan.transportPlan) && (
            <Txt>Transport: {plan.transportPlan}</Txt>
          )}
          {Boolean(plan.warningSigns) && (
            <Card style={{ backgroundColor: C.redBg }}>
              <Text style={[S.h3, { color: C.rose }]}>
                Discharge-team warning signs
              </Text>
              <Txt>{plan.warningSigns}</Txt>
              {Boolean(plan.afterHoursContact) && (
                <Txt>After-hours: {plan.afterHoursContact}</Txt>
              )}
            </Card>
          )}
          <Button
            title="Edit discharge plan"
            secondary
            disabled={readOnly || busyId !== null}
            onPress={beginPlanEdit}
          />
          <Button
            title="Mark transition complete"
            secondary
            disabled={readOnly || busyId !== null || counts.open > 0}
            onPress={async () => {
              setBusyId("complete-plan");
              try {
                await completeCareTransitionPlan(careRecipientId, plan.id);
                await refresh();
                setMessage("Hospital-to-home transition marked complete.");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not complete this transition.",
                );
              } finally {
                setBusyId(null);
              }
            }}
          />
          {counts.open > 0 && (
            <Txt style={S.small}>
              Complete or cancel the remaining follow-ups before closing the transition.
            </Txt>
          )}
        </Card>
      )}

      <Section title="Follow-ups after discharge" />
      {followUps.map((followUp) => {
        const timing = transitionFollowUpTiming(followUp);
        return (
          <Card
            key={followUp.id}
            style={{
              backgroundColor:
                followUp.status === "completed"
                  ? "#EAF4EF"
                  : timing === "overdue"
                    ? C.redBg
                    : C.white,
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{followUp.title}</Text>
                <Txt style={S.small}>
                  {followUp.dueAt
                    ? new Date(followUp.dueAt).toLocaleString()
                    : "No date recorded"}
                  {followUp.provider ? " · " + followUp.provider : ""}
                </Txt>
              </View>
              <Icon
                name={
                  followUp.status === "completed"
                    ? "checkmark-circle"
                    : timing === "overdue"
                      ? "warning-outline"
                      : "time-outline"
                }
                color={
                  followUp.status === "completed"
                    ? C.green
                    : timing === "overdue"
                      ? C.rose
                      : C.purple
                }
              />
            </View>
            {Boolean(followUp.details) && <Txt>{followUp.details}</Txt>}
            {followUp.status === "open" && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Complete"
                    disabled={readOnly || busyId !== null}
                    onPress={async () => {
                      setBusyId(followUp.id);
                      try {
                        await setTransitionFollowUpStatus({
                          careRecipientId,
                          followUpId: followUp.id,
                          status: "completed",
                        });
                        await refresh();
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancel"
                    secondary
                    disabled={readOnly || busyId !== null}
                    onPress={async () => {
                      setBusyId(followUp.id);
                      try {
                        await setTransitionFollowUpStatus({
                          careRecipientId,
                          followUpId: followUp.id,
                          status: "cancelled",
                        });
                        await refresh();
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}

      {plan?.status === "active" && (
        <>
          <Button
            title={addingFollowUp ? "Cancel new follow-up" : "Add follow-up"}
            secondary
            icon={addingFollowUp ? "close-outline" : "add-outline"}
            disabled={readOnly || busyId !== null}
            onPress={() => setAddingFollowUp((value) => !value)}
          />
          {addingFollowUp && (
            <Card>
              <Field
                label="Follow-up"
                value={followUpTitle}
                onChange={setFollowUpTitle}
              />
              <Field
                label="Date/time (for example 2026-09-30T10:00)"
                value={followUpDueAt}
                onChange={setFollowUpDueAt}
              />
              <Field
                label="Provider / organization"
                value={followUpProvider}
                onChange={setFollowUpProvider}
              />
              <Field
                label="What needs to happen?"
                value={followUpDetails}
                onChange={setFollowUpDetails}
                multiline
              />
              <Button
                title={
                  busyId === "follow-up" ? "Adding…" : "Add follow-up"
                }
                disabled={
                  readOnly || busyId !== null || !followUpTitle.trim()
                }
                onPress={() => void addFollowUp()}
              />
            </Card>
          )}
        </>
      )}

      <Section title="Discharge checklist" />
      {transitionSteps.map((step, index) => {
        const completed = state.transition.includes(index);
        return (
          <Pressable
            key={step}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: completed }}
            disabled={readOnly || busyId !== null}
            onPress={async () => {
              setBusyId("check-" + index);
              try {
                await setTransitionItem(index, !completed);
                dispatch({ type: "transition", index });
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not update the checklist.",
                );
              } finally {
                setBusyId(null);
              }
            }}
            style={[S.card, S.row, { padding: 17 }]}
          >
            <Icon
              name={completed ? "checkmark-circle" : "ellipse-outline"}
              color={completed ? C.green : C.muted}
            />
            <Text style={[S.body, { flex: 1, color: C.ink }]}>{step}</Text>
          </Pressable>
        );
      })}

      <Card style={{ backgroundColor: C.redBg }}>
        <Text style={[S.h3, { color: C.rose }]}>Urgent help comes first.</Text>
        <Txt>
          Use the warning signs and contact instructions given by the discharge team.
          For a possible emergency, use local emergency services rather than waiting on the app.
        </Txt>
        <Button
          title="Review emergency guidance"
          secondary
          onPress={() => n.navigate("Emergency")}
        />
      </Card>
    </Page>
  );
}
