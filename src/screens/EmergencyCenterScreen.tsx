import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import {
  loadEmergencyCenterData,
  saveEmergencyProfile,
  type EmergencyCenterData,
} from "../emergencyCenter";
import {
  emergencyProfileCompleteness,
  emergencyReviewLabel,
} from "../emergencyCenterHelpers";
import { medicationReconciliationLabel } from "../medicationManagementHelpers";
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

const emptyData = (): EmergencyCenterData => ({
  profile: null,
  recipient: {
    displayName: "Care profile",
    emergencyContactName: "",
    emergencyContactPhone: "",
  },
  contacts: [],
  keyDocuments: [],
  medications: [],
  latestReconciliation: null,
  transitionPlan: null,
  transitionFollowUps: [],
});

async function callNumber(value: string) {
  const normalized = value.replace(/[^+0-9*#]/g, "");
  if (!normalized) throw new Error("No phone number is recorded.");
  await Linking.openURL("tel:" + normalized);
}

export function EmergencyCenterScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [data, setData] = useState<EmergencyCenterData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [localEmergencyNumber, setLocalEmergencyNumber] = useState("");
  const [preferredHospital, setPreferredHospital] = useState("");
  const [allergies, setAllergies] = useState("");
  const [importantConditions, setImportantConditions] = useState("");
  const [medicalDevices, setMedicalDevices] = useState("");
  const [advanceDirectiveLocation, setAdvanceDirectiveLocation] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");

  const applyProfile = useCallback((next: EmergencyCenterData) => {
    setData(next);
    const profile = next.profile;
    setLocalEmergencyNumber(profile?.localEmergencyNumber ?? "");
    setPreferredHospital(profile?.preferredHospital ?? "");
    setAllergies(profile?.allergies ?? "");
    setImportantConditions(profile?.importantConditions ?? "");
    setMedicalDevices(profile?.medicalDevices ?? "");
    setAdvanceDirectiveLocation(profile?.advanceDirectiveLocation ?? "");
    setEmergencyNotes(profile?.emergencyNotes ?? "");
  }, []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      applyProfile(emptyData());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      applyProfile(await loadEmergencyCenterData(careRecipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load emergency information.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyProfile, careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`emergency-center:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_emergency_profiles",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const completeness = useMemo(
    () => emergencyProfileCompleteness(data),
    [data],
  );

  async function save(markReviewed = false) {
    if (!careRecipientId || readOnly || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await saveEmergencyProfile({
        careRecipientId,
        id: data.profile?.id,
        localEmergencyNumber,
        preferredHospital,
        allergies,
        importantConditions,
        medicalDevices,
        advanceDirectiveLocation,
        emergencyNotes,
        markReviewed,
      });
      setEditing(false);
      await refresh();
      setMessage(
        markReviewed
          ? "Emergency information reviewed and timestamped."
          : "Emergency information saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save emergency information.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="EMERGENCY INFORMATION"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="EMERGENCY INFORMATION CENTER"
        title="Keep the information someone may need quickly in one place."
        body="This is a preparedness record for the care team. EnVizion does not monitor symptoms or contact emergency services automatically."
      />

      <Card style={{ backgroundColor: C.redBg, borderColor: "#EAC9C9" }}>
        <Icon name="alert-circle" color={C.rose} size={34} />
        <Text style={[S.h2, { color: "#963845" }]}>
          For a possible medical emergency, do not wait on the app.
        </Text>
        <Txt>
          Call the appropriate local emergency service and follow dispatcher
          instructions. The information below is caregiver-entered and should
          be checked against the healthcare team’s records.
        </Txt>
        {data.profile?.localEmergencyNumber ? (
          <Button
            title={"Call " + data.profile.localEmergencyNumber}
            icon="call-outline"
            onPress={async () => {
              try {
                await callNumber(data.profile!.localEmergencyNumber);
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Use your phone to call the local emergency number.",
                );
              }
            }}
          />
        ) : (
          <Txt style={S.small}>
            No local emergency number has been saved for this care profile yet.
          </Txt>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 125 }}>
          <Text style={S.eyebrow}>PREPAREDNESS</Text>
          <Text style={S.h2}>
            {completeness.completed}/{completeness.total}
          </Text>
          <Txt style={S.small}>core items recorded</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 170 }}>
          <Text style={S.eyebrow}>LAST REVIEW</Text>
          <Text style={[S.h3, { fontSize: 14 }]}>
            {emergencyReviewLabel(data.profile?.lastReviewedAt)}
          </Text>
        </Card>
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading emergency information…</Txt>
        </Card>
      ) : (
        <>
          <Section title="Quick contacts" />
          <Card>
            <Text style={S.h3}>
              {data.recipient.emergencyContactName ||
                "Primary emergency contact not recorded"}
            </Text>
            <Txt style={S.small}>
              {data.recipient.emergencyContactPhone || "No phone recorded"}
            </Txt>
            {Boolean(data.recipient.emergencyContactPhone) && (
              <Button
                title="Call primary emergency contact"
                secondary
                icon="call-outline"
                onPress={() =>
                  void callNumber(data.recipient.emergencyContactPhone).catch(
                    (error) =>
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Could not start the call.",
                      ),
                  )
                }
              />
            )}
            <Button
              title="Manage care contacts"
              secondary
              onPress={() => n.navigate("CareContacts")}
            />
          </Card>

          {data.contacts.slice(0, 5).map((contact) => (
            <Card key={contact.id}>
              <Text style={S.h3}>{contact.providerName}</Text>
              <Txt style={S.small}>
                {[contact.specialty, contact.organizationName, contact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
              <Button
                title="Call"
                secondary
                icon="call-outline"
                onPress={() =>
                  void callNumber(contact.phone).catch((error) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Could not start the call.",
                    ),
                  )
                }
              />
            </Card>
          ))}

          <Section title="Emergency profile" />
          {!editing ? (
            <Card style={{ backgroundColor: C.lavender }}>
              <Text style={S.h3}>
                Preferred hospital / facility
              </Text>
              <Txt>{data.profile?.preferredHospital || "Not recorded"}</Txt>

              <Text style={S.h3}>Known allergies</Text>
              <Txt>{data.profile?.allergies || "Not recorded"}</Txt>

              <Text style={S.h3}>Important conditions</Text>
              <Txt>{data.profile?.importantConditions || "Not recorded"}</Txt>

              <Text style={S.h3}>Medical devices / equipment</Text>
              <Txt>{data.profile?.medicalDevices || "Not recorded"}</Txt>

              <Text style={S.h3}>Advance directive / document location</Text>
              <Txt>
                {data.profile?.advanceDirectiveLocation || "Not recorded"}
              </Txt>

              <Text style={S.h3}>Emergency notes</Text>
              <Txt>{data.profile?.emergencyNotes || "Not recorded"}</Txt>

              {!readOnly && (
                <>
                  <Button
                    title="Edit emergency information"
                    secondary
                    icon="create-outline"
                    onPress={() => setEditing(true)}
                  />
                  <Button
                    title={busy ? "Saving review…" : "Confirm information reviewed"}
                    disabled={busy}
                    icon="checkmark-done-outline"
                    onPress={() => void save(true)}
                  />
                </>
              )}
            </Card>
          ) : (
            <Card>
              <Field
                label="Local emergency number"
                value={localEmergencyNumber}
                onChange={setLocalEmergencyNumber}
              />
              <Field
                label="Preferred hospital / facility"
                value={preferredHospital}
                onChange={setPreferredHospital}
              />
              <Field
                label="Known allergies"
                value={allergies}
                onChange={setAllergies}
                multiline
              />
              <Field
                label="Important conditions"
                value={importantConditions}
                onChange={setImportantConditions}
                multiline
              />
              <Field
                label="Medical devices / equipment"
                value={medicalDevices}
                onChange={setMedicalDevices}
                multiline
              />
              <Field
                label="Advance directive / document location"
                value={advanceDirectiveLocation}
                onChange={setAdvanceDirectiveLocation}
                multiline
              />
              <Field
                label="Emergency notes"
                value={emergencyNotes}
                onChange={setEmergencyNotes}
                multiline
              />
              <Button
                title={busy ? "Saving…" : "Save emergency information"}
                disabled={busy}
                onPress={() => void save(false)}
              />
              <Button
                title="Cancel"
                secondary
                disabled={busy}
                onPress={() => {
                  setEditing(false);
                  applyProfile(data);
                }}
              />
            </Card>
          )}

          <Section title="Medication & transition context" />
          <Card>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>Current medication list</Text>
                <Txt style={S.small}>
                  {data.medications.length} active medication
                  {data.medications.length === 1 ? "" : "s"} ·{" "}
                  {medicationReconciliationLabel(data.latestReconciliation)}
                </Txt>
              </View>
              <Icon name="medical-outline" />
            </View>
            {data.medications.slice(0, 6).map((medication) => (
              <Txt key={medication.id} style={S.small}>
                • {medication.name}
                {medication.dose ? " · " + medication.dose : ""}
                {medication.route ? " · " + medication.route : ""}
              </Txt>
            ))}
            <Button
              title="Open medication management"
              secondary
              onPress={() => n.navigate("Medications")}
            />
          </Card>

          {data.transitionPlan && (
            <Card style={{ backgroundColor: "#FFF9F2" }}>
              <Text style={S.h3}>Active hospital-to-home transition</Text>
              {Boolean(data.transitionPlan.warningSigns) && (
                <>
                  <Text style={[S.h3, { color: C.rose }]}>
                    Discharge-team warning signs
                  </Text>
                  <Txt>{data.transitionPlan.warningSigns}</Txt>
                </>
              )}
              {Boolean(data.transitionPlan.afterHoursContact) && (
                <Txt>
                  After-hours instructions:{" "}
                  {data.transitionPlan.afterHoursContact}
                </Txt>
              )}
              <Txt style={S.small}>
                {data.transitionFollowUps.length} open transition follow-up
                {data.transitionFollowUps.length === 1 ? "" : "s"}.
              </Txt>
              <Button
                title="Open hospital-to-home plan"
                secondary
                onPress={() => n.navigate("Transition")}
              />
            </Card>
          )}

          <Section title="Key documents" />
          <Card>
            <Txt>
              {data.keyDocuments.length
                ? `${data.keyDocuments.length} document${data.keyDocuments.length === 1 ? "" : "s"} marked as key for quick reference.`
                : "No Care Vault documents are marked as key yet."}
            </Txt>
            {data.keyDocuments.slice(0, 6).map((document) => (
              <Txt key={document.id} style={S.small}>
                • {document.displayName}
              </Txt>
            ))}
            <Button
              title="Open Care Document Vault"
              secondary
              icon="folder-open-outline"
              onPress={() => n.navigate("CareDocuments")}
            />
          </Card>

          <Button
            title="Create printable emergency packet"
            icon="document-text-outline"
            onPress={() => n.navigate("CarePacket")}
          />
        </>
      )}

      <Txt style={S.small}>
        Emergency information is a caregiver-entered preparedness aid. It is not
        verified clinical data, emergency monitoring, or a substitute for
        emergency services.
      </Txt>
    </Page>
  );
}
