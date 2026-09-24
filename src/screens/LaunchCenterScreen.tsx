import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadLaunchAdminDashboard,
  saveLaunchWave,
  signLaunchWave,
  type LaunchAdminDashboard,
  type LaunchPlatform,
  type LaunchWave,
  type LaunchWaveStatus,
} from "../launchValidation";
import { gateHeadline } from "../launchValidationHelpers";
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

const statuses: LaunchWaveStatus[] = ["draft", "active", "cancelled"];

const platforms: Array<{ id: LaunchPlatform; label: string }> = [
  { id: "ios", label: "iOS" },
  { id: "android", label: "Android" },
  { id: "web", label: "Web" },
];

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 110 }}>
      <Text style={[S.title, { fontSize: 26, color: C.deep }]}>{value}</Text>
      <Txt style={S.small}>{label}</Txt>
    </View>
  );
}

function Choice({
  selected,
  label,
  onPress,
  disabled,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        S.pill,
        {
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: 14,
          opacity: disabled ? 0.55 : 1,
          backgroundColor: selected ? C.purple : C.lavender,
        },
      ]}
    >
      <Text style={[S.small, { color: selected ? C.white : C.deep }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LaunchCenterScreen() {
  const n = useNav();
  const [dashboard, setDashboard] = useState<LaunchAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [waveId, setWaveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cohort, setCohort] = useState("");
  const [status, setStatus] = useState<LaunchWaveStatus>("draft");
  const [requiredPlatforms, setRequiredPlatforms] = useState<LaunchPlatform[]>([
    "ios",
    "android",
    "web",
  ]);
  const [notes, setNotes] = useState("");
  const [signoffNote, setSignoffNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await loadLaunchAdminDashboard();
      setDashboard(data);
      setCohort((current) =>
        current &&
        data.foundation.cohorts.some((item) => item.cohort === current)
          ? current
          : data.foundation.cohorts[0]?.cohort ?? "",
      );
    } catch (error) {
      setDashboard(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Launch Center could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const gateMap = useMemo(
    () =>
      new Map(
        (dashboard?.gates ?? []).map((gate) => [gate.waveId, gate]),
      ),
    [dashboard],
  );

  const selectedFoundationCohort = useMemo(
    () =>
      dashboard?.foundation.cohorts.find((item) => item.cohort === cohort) ??
      null,
    [cohort, dashboard],
  );

  function clearForm() {
    setWaveId(null);
    setName("");
    setCohort(dashboard?.foundation.cohorts[0]?.cohort ?? "");
    setStatus("draft");
    setRequiredPlatforms(["ios", "android", "web"]);
    setNotes("");
  }

  function editWave(wave: LaunchWave) {
    setWaveId(wave.id);
    setName(wave.name);
    setCohort(wave.cohort);
    setStatus(wave.status);
    setRequiredPlatforms(wave.requiredPlatforms);
    setNotes(wave.notes);
    setMessage("Launch wave loaded into the editor.");
  }

  async function saveWave() {
    if (busy || !name.trim() || !cohort.trim()) return;
    setBusy("wave");
    setMessage("");
    try {
      await saveLaunchWave({
        waveId,
        name,
        cohort,
        status,
        requiredPlatforms,
        notes,
      });
      clearForm();
      await refresh();
      setMessage(waveId ? "Launch wave updated." : "Launch wave created.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Launch wave could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function signoff(
    targetWaveId: string,
    signoffStatus: "approved" | "held",
  ) {
    if (busy) return;
    setBusy("signoff-" + targetWaveId);
    setMessage("");
    try {
      await signLaunchWave({
        waveId: targetWaveId,
        status: signoffStatus,
        notes: signoffNote,
      });
      setSignoffNote("");
      await refresh();
      setMessage(
        signoffStatus === "approved"
          ? "Launch sign-off approved and the wave was completed."
          : "Launch placed on hold with a timestamped readiness snapshot.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Launch sign-off could not be recorded.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading && !dashboard) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading Launch Center…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="ADMIN · LAUNCH CENTER"
        title="Turn pilot evidence into a controlled launch decision."
        body="Create real pilot waves, review Owner/Caregiver/Viewer acceptance, device coverage and recovery drills, then record an auditable hold or approval."
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {dashboard && (
        <>
          <Section title="Pilot foundation" />
          <Card
            style={{
              backgroundColor: dashboard.foundation.foundationReady
                ? "#E8F1ED"
                : "#FFF9F2",
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.eyebrow}>REAL PILOT SETUP</Text>
                <Text style={S.h2}>
                  {dashboard.foundation.foundationReady
                    ? "A real cohort is ready for launch validation"
                    : "Pilot foundation still needs setup"}
                </Text>
              </View>
              <Icon
                name={
                  dashboard.foundation.foundationReady
                    ? "checkmark-circle-outline"
                    : "construct-outline"
                }
                color={
                  dashboard.foundation.foundationReady ? C.green : C.purple
                }
                size={30}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <Metric
                value={dashboard.foundation.publishedRequiredDocuments}
                label="published required documents"
              />
              <Metric
                value={dashboard.foundation.cohorts.length}
                label="real pilot cohorts"
              />
              <Metric
                value={dashboard.foundation.cohorts.reduce(
                  (sum, item) => sum + item.activeParticipants,
                  0,
                )}
                label="active pilot participants"
              />
              <Metric
                value={dashboard.foundation.cohorts.reduce(
                  (sum, item) => sum + item.consentCurrent,
                  0,
                )}
                label="consent current"
              />
            </View>

            <Card style={{ backgroundColor: C.paper }}>
              <Text style={S.h3}>Required participation documents</Text>
              {(
                [
                  ["privacy_notice", "Privacy notice"],
                  ["pilot_consent", "Pilot consent"],
                  ["terms_of_use", "Terms of use"],
                ] as const
              ).map(([id, label]) => {
                const published =
                  dashboard.foundation.publishedDocumentTypes.includes(id);
                return (
                  <View key={id} style={[S.row, { alignItems: "center" }]}>
                    <Icon
                      name={
                        published
                          ? "checkmark-circle-outline"
                          : "ellipse-outline"
                      }
                      color={published ? C.green : C.muted}
                      size={20}
                    />
                    <Txt style={S.small}>
                      {label} · {published ? "published" : "missing"}
                    </Txt>
                  </View>
                );
              })}
            </Card>

            {!dashboard.foundation.cohorts.length ? (
              <Card style={{ backgroundColor: C.paper }}>
                <Text style={S.h3}>No real pilot cohort exists yet.</Text>
                <Txt style={S.small}>
                  Invite a real participant in Pilot Administration and assign
                  that person to a cohort. Launch waves cannot be created from
                  arbitrary cohort names.
                </Txt>
              </Card>
            ) : (
              dashboard.foundation.cohorts.map((item) => (
                <Card key={item.cohort} style={{ backgroundColor: C.paper }}>
                  <View style={S.between}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.h3}>{item.cohort}</Text>
                      <Txt style={S.small}>
                        {item.activeParticipants} active · {item.invitedParticipants} invited ·{" "}
                        {item.consentCurrent} consent current
                      </Txt>
                      <Txt style={S.small}>
                        Role coverage: Owner {item.roleCoverage.owner} ·
                        Caregiver {item.roleCoverage.caregiver} · Viewer{" "}
                        {item.roleCoverage.viewer}
                      </Txt>
                    </View>
                    <View
                      style={[
                        S.pill,
                        {
                          backgroundColor: item.activationReady
                            ? "#E8F1ED"
                            : "#FFF1E5",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          S.small,
                          {
                            color: item.activationReady ? C.green : C.rose,
                          },
                        ]}
                      >
                        {item.activationReady ? "Can activate" : "Setup needed"}
                      </Text>
                    </View>
                  </View>
                  {item.activationBlockers.map((blocker) => (
                    <Txt key={blocker} style={S.small}>
                      • {blocker}
                    </Txt>
                  ))}
                </Card>
              ))
            )}

            <Button
              title="Open Pilot Administration"
              secondary
              icon="people-outline"
              onPress={() => n.navigate("PilotAdmin")}
            />
          </Card>

          <Card style={{ backgroundColor: C.lavender }}>
          <Text style={S.eyebrow}>CURRENT OPERATIONS</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <Metric
              value={dashboard.operations.openDiagnostics}
              label="open diagnostics"
            />
            <Metric
              value={dashboard.operations.failedPacketExports24h}
              label="failed packets · 24h"
            />
            <Metric
              value={dashboard.operations.staleSupportRequests}
              label="support >24h"
            />
            <Metric
              value={dashboard.operations.pushDeliveryErrors24h}
              label="push errors · 24h"
            />
          </View>
        </Card>
        </>
      )}

      <Section title={waveId ? "Edit launch wave" : "Create launch wave"} />
      <Card>
        <Field label="Wave name" value={name} onChange={setName} />
        <Text style={S.h3}>Real pilot cohort</Text>
        {!dashboard?.foundation.cohorts.length ? (
          <Txt style={S.small}>
            Create a real cohort from Pilot Administration first.
          </Txt>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {dashboard.foundation.cohorts.map((item) => (
              <Choice
                key={item.cohort}
                selected={cohort === item.cohort}
                label={item.cohort}
                onPress={() => setCohort(item.cohort)}
              />
            ))}
          </View>
        )}

        <Text style={S.h3}>Wave status</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {statuses.map((value) => (
            <Choice
              key={value}
              selected={status === value}
              label={value.replaceAll("_", " ")}
              disabled={
                value === "active" &&
                (!selectedFoundationCohort ||
                  !selectedFoundationCohort.activationReady)
              }
              onPress={() => setStatus(value)}
            />
          ))}
        </View>

        <Text style={S.h3}>Required device platforms</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {platforms.map((platform) => (
            <Choice
              key={platform.id}
              selected={requiredPlatforms.includes(platform.id)}
              label={platform.label}
              onPress={() =>
                setRequiredPlatforms((current) =>
                  current.includes(platform.id)
                    ? current.filter((item) => item !== platform.id)
                    : [...current, platform.id],
                )
              }
            />
          ))}
        </View>

        <Field
          label="Pilot instructions / notes (optional)"
          value={notes}
          onChange={setNotes}
          multiline
        />

        <Button
          title={busy === "wave" ? "Saving…" : waveId ? "Save wave changes" : "Create wave"}
          icon="flag-outline"
          disabled={
            busy !== null ||
            !name.trim() ||
            !cohort.trim() ||
            !requiredPlatforms.length ||
            (status === "active" &&
              !selectedFoundationCohort?.activationReady)
          }
          onPress={() => void saveWave()}
        />
        {waveId && (
          <Button
            title="Cancel editing"
            secondary
            disabled={busy !== null}
            onPress={clearForm}
          />
        )}

        <Txt style={S.small}>
          No participant or care record is generated here. A wave can target
          only a cohort that already exists in real pilot enrollment data.
          Active status is blocked until required documents are published and
          active participants are current on consent.
        </Txt>
      </Card>

      <Section
        title="Launch waves"
        action="Refresh"
        onPress={() => void refresh()}
      />

      {!dashboard?.waves.length ? (
        <Card>
          <Icon name="flag-outline" size={28} />
          <Text style={S.h3}>No launch waves yet.</Text>
          <Txt>Create the first wave above when the pilot is ready.</Txt>
        </Card>
      ) : (
        dashboard.waves.map((wave) => {
          const gate = gateMap.get(wave.id);
          const locked = gate?.signoff?.status === "approved";

          return (
            <Card key={wave.id}>
              <View style={S.between}>
                <View style={{ flex: 1 }}>
                  <Text style={S.eyebrow}>
                    {wave.cohort.toUpperCase()} · {wave.status.toUpperCase()}
                  </Text>
                  <Text style={S.h2}>{wave.name}</Text>
                  <Txt style={S.small}>
                    Required platforms: {wave.requiredPlatforms.join(", ")}
                  </Txt>
                </View>
                {gate && (
                  <View
                    style={[
                      S.pill,
                      {
                        backgroundColor: gate.ready
                          ? "#E8F1ED"
                          : "#FFF1E5",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.small,
                        { color: gate.ready ? C.green : C.rose },
                      ]}
                    >
                      {gate.ready ? "Ready" : "Blocked"}
                    </Text>
                  </View>
                )}
              </View>

              {gate && (
                <>
                  <Txt>{gateHeadline(gate.ready, gate.blockers)}</Txt>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <Metric
                      value={gate.participants.active}
                      label="active pilot users"
                    />
                    <Metric
                      value={gate.participants.consentCurrent}
                      label="consent current"
                    />
                    <Metric
                      value={gate.acceptance.passedRuns}
                      label="passed journeys"
                    />
                    <Metric
                      value={gate.drills.totalRuns}
                      label="recovery drills"
                    />
                  </View>

                  <Card style={{ backgroundColor: C.paper }}>
                    <Text style={S.h3}>Role acceptance</Text>
                    <Txt style={S.small}>
                      Owner {gate.acceptance.rolePasses.owner ?? 0} · Caregiver{" "}
                      {gate.acceptance.rolePasses.caregiver ?? 0} · Viewer{" "}
                      {gate.acceptance.rolePasses.viewer ?? 0}
                    </Txt>
                    <Text style={S.h3}>Device coverage</Text>
                    <Txt style={S.small}>
                      iOS {gate.acceptance.platformPasses.ios ?? 0} · Android{" "}
                      {gate.acceptance.platformPasses.android ?? 0} · Web{" "}
                      {gate.acceptance.platformPasses.web ?? 0}
                    </Txt>
                    <Text style={S.h3}>Recovery coverage</Text>
                    <Txt style={S.small}>
                      Network {gate.drills.passes.network_reconnect ?? 0} ·
                      Session {gate.drills.passes.session_revocation ?? 0} ·
                      Packet {gate.drills.passes.packet_recovery ?? 0} ·
                      Notification{" "}
                      {gate.drills.passes.notification_recovery ?? 0}
                    </Txt>
                  </Card>

                  {gate.blockers.length > 0 && (
                    <Card style={{ backgroundColor: "#FFF9F2" }}>
                      <Text style={S.h3}>Launch blockers</Text>
                      {gate.blockers.map((blocker) => (
                        <Txt key={blocker} style={S.small}>
                          • {blocker}
                        </Txt>
                      ))}
                    </Card>
                  )}

                  {gate.signoff && (
                    <Card
                      style={{
                        backgroundColor:
                          gate.signoff.status === "approved"
                            ? "#E8F1ED"
                            : "#FFF9F2",
                      }}
                    >
                      <Text style={S.h3}>
                        Sign-off {gate.signoff.status}
                      </Text>
                      <Txt style={S.small}>
                        {new Date(gate.signoff.signedAt).toLocaleString()}
                      </Txt>
                      {Boolean(gate.signoff.notes) && (
                        <Txt>{gate.signoff.notes}</Txt>
                      )}
                    </Card>
                  )}
                </>
              )}

              <Button
                title={locked ? "Approved wave is locked" : "Edit wave"}
                secondary
                icon={locked ? "lock-closed-outline" : "create-outline"}
                disabled={busy !== null || locked}
                onPress={() => editWave(wave)}
              />

              {!locked && gate && (
                <>
                  <Field
                    label="Sign-off / hold note (optional)"
                    value={signoffNote}
                    onChange={setSignoffNote}
                    multiline
                  />
                  <Button
                    title="Record launch hold"
                    secondary
                    icon="pause-circle-outline"
                    disabled={busy !== null}
                    onPress={() => void signoff(wave.id, "held")}
                  />
                  <Button
                    title={
                      gate.ready
                        ? "Approve launch sign-off"
                        : "Resolve blockers before approval"
                    }
                    icon="checkmark-done-outline"
                    disabled={busy !== null || !gate.ready}
                    onPress={() => void signoff(wave.id, "approved")}
                  />
                </>
              )}
            </Card>
          );
        })
      )}

      <Txt style={S.small}>
        Approval is blocked server-side until required pilot roles, configured
        platforms, all recovery drills, participant consent and production
        operations satisfy the launch gate. The sign-off is an operational
        release decision, not a clinical or regulatory certification.
      </Txt>
    </Page>
  );
}
