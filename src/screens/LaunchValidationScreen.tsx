import Constants from "expo-constants";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  loadLaunchValidationWorkspace,
  recordLaunchRecoveryDrill,
  saveLaunchAcceptance,
  startLaunchAcceptance,
  type LaunchAcceptanceRun,
  type LaunchDeviceClass,
  type LaunchPlatform,
  type LaunchRecoveryDrill,
  type LaunchRunStatus,
  type LaunchValidationWorkspace,
  type RecoveryDrillStatus,
} from "../launchValidation";
import {
  acceptanceStepsForRole,
  deviceChecksForPlatform,
  recoveryDrills,
  runCanPass,
  validationProgress,
  type ValidationStep,
} from "../launchValidationHelpers";
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

function currentPlatform(): LaunchPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

function currentDeviceClass(): LaunchDeviceClass {
  const width = Dimensions.get("window").width;
  if (Platform.OS === "web") {
    if (width <= 600) return "phone";
    if (width <= 1024) return "tablet";
    return "desktop";
  }
  return width <= 700 ? "phone" : "tablet";
}

function CheckRow({
  step,
  checked,
  disabled,
  onToggle,
}: {
  step: ValidationStep;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={step.title}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        {
          minHeight: 58,
          borderWidth: 1,
          borderColor: checked ? C.purple : C.line,
          backgroundColor: checked ? C.lavender : C.white,
          borderRadius: 16,
          padding: 12,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Icon
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          color={checked ? C.purple : C.muted}
          size={22}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{step.title}</Text>
          <Txt style={S.small}>{step.detail}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

function ResultPill({ status }: { status: string }) {
  const good = status === "passed";
  const bad = status === "failed" || status === "blocked";
  return (
    <View
      style={[
        S.pill,
        {
          backgroundColor: good ? "#E8F1ED" : bad ? "#FFF1E5" : C.lavender,
        },
      ]}
    >
      <Text
        style={[
          S.small,
          { color: good ? C.green : bad ? C.rose : C.deep },
        ]}
      >
        {status.replaceAll("_", " ")}
      </Text>
    </View>
  );
}

export function LaunchValidationScreen() {
  const n = useNav();
  const {
    state,
    syncStatus,
    lastSyncedAt,
  } = useCare();

  const [workspace, setWorkspace] =
    useState<LaunchValidationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedWaveId, setSelectedWaveId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [activeRunId, setActiveRunId] = useState("");
  const [steps, setSteps] = useState<Record<string, boolean>>({});
  const [deviceChecks, setDeviceChecks] =
    useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [drillNote, setDrillNote] = useState("");

  const platform = currentPlatform();
  const deviceClass = currentDeviceClass();
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await loadLaunchValidationWorkspace();
      setWorkspace(data);
      setSelectedWaveId((current) =>
        current && data.waves.some((wave) => wave.id === current)
          ? current
          : data.waves[0]?.id ?? "",
      );
      setSelectedProfileId((current) => {
        if (
          current &&
          data.profiles.some((profile) => profile.careRecipientId === current)
        ) {
          return current;
        }
        if (
          state.careRecipientId &&
          data.profiles.some(
            (profile) => profile.careRecipientId === state.careRecipientId,
          )
        ) {
          return state.careRecipientId;
        }
        return data.profiles[0]?.careRecipientId ?? "";
      });
    } catch (error) {
      setWorkspace(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Launch validation could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [state.careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedWave = useMemo(
    () => workspace?.waves.find((wave) => wave.id === selectedWaveId) ?? null,
    [selectedWaveId, workspace],
  );

  const selectedProfile = useMemo(
    () =>
      workspace?.profiles.find(
        (profile) => profile.careRecipientId === selectedProfileId,
      ) ?? null,
    [selectedProfileId, workspace],
  );

  const latestRun = useMemo(() => {
    if (!workspace || !selectedWaveId || !selectedProfileId) return null;
    return (
      workspace.runs.find(
        (run) =>
          run.waveId === selectedWaveId &&
          run.careRecipientId === selectedProfileId,
      ) ?? null
    );
  }, [selectedProfileId, selectedWaveId, workspace]);

  const activeRun = useMemo(() => {
    if (!workspace) return null;
    if (activeRunId) {
      const explicit = workspace.runs.find((run) => run.id === activeRunId);
      if (explicit) return explicit;
    }
    return latestRun;
  }, [activeRunId, latestRun, workspace]);

  useEffect(() => {
    if (!activeRun) {
      setSteps({});
      setDeviceChecks({});
      setNotes("");
      return;
    }
    setActiveRunId(activeRun.id);
    setSteps(activeRun.steps);
    setDeviceChecks(activeRun.deviceChecks);
    setNotes(activeRun.notes);
  }, [activeRun?.id]);

  const roleSteps = selectedProfile
    ? acceptanceStepsForRole(selectedProfile.role)
    : [];
  const qaSteps = deviceChecksForPlatform(platform);
  const roleProgress = validationProgress(steps, roleSteps);
  const deviceProgress = validationProgress(deviceChecks, qaSteps);
  const canPass =
    selectedProfile &&
    runCanPass({
      role: selectedProfile.role,
      platform,
      steps,
      deviceChecks,
    });

  const recentDrillsByType = useMemo(() => {
    const result = new Map<string, LaunchRecoveryDrill>();
    for (const drill of workspace?.drills ?? []) {
      if (drill.waveId !== selectedWaveId || result.has(drill.drillType)) {
        continue;
      }
      result.set(drill.drillType, drill);
    }
    return result;
  }, [selectedWaveId, workspace]);

  async function startRun() {
    if (!selectedWaveId || !selectedProfileId || busy) return;
    setBusy("start");
    setMessage("");
    try {
      const run = await startLaunchAcceptance({
        waveId: selectedWaveId,
        careRecipientId: selectedProfileId,
        platform,
        deviceClass,
        appVersion,
      });
      await refresh();
      setActiveRunId(run.id);
      setSteps({});
      setDeviceChecks({});
      setNotes("");
      setMessage("New launch acceptance run started.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not start validation.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveRun(status: LaunchRunStatus) {
    if (!activeRun || busy) return;
    setBusy("save");
    setMessage("");
    try {
      const run = await saveLaunchAcceptance({
        runId: activeRun.id,
        steps,
        deviceChecks,
        status,
        notes,
      });
      await refresh();
      setActiveRunId(run.id);
      setMessage(
        status === "passed"
          ? "Acceptance journey passed and recorded."
          : status === "in_progress"
            ? "Validation progress saved."
            : "Acceptance journey recorded as " + status + ".",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save validation.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function recordDrill(
    drillType: LaunchRecoveryDrill["drillType"],
    status: RecoveryDrillStatus,
  ) {
    if (!selectedWaveId || busy) return;
    setBusy("drill-" + drillType);
    setMessage("");
    try {
      await recordLaunchRecoveryDrill({
        waveId: selectedWaveId,
        drillType,
        status,
        notes: drillNote,
        evidence: {
          platform,
          deviceClass,
          appVersion,
          syncStatus,
          lastSyncedAt,
        },
      });
      setDrillNote("");
      await refresh();
      setMessage(
        "Recovery drill recorded as " + status.replaceAll("_", " ") + ".",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not record drill.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading && !workspace) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading launch validation…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="PILOT LAUNCH VALIDATION"
        title="Test the real app with your real care-team role."
        body="Complete the journey on the device you are actually using. Results are timestamped pilot evidence; no demo or synthetic care record is created."
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {!workspace?.waves.length ? (
        <Card>
          <Icon name="flag-outline" size={28} />
          <Text style={S.h3}>No active launch wave is assigned.</Text>
          <Txt>
            Your pilot cohort does not currently have an active launch
            validation window.
          </Txt>
        </Card>
      ) : (
        <>
          <Section title="Launch wave" />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {workspace.waves.map((wave) => (
              <Pressable
                key={wave.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: wave.id === selectedWaveId }}
                onPress={() => {
                  setSelectedWaveId(wave.id);
                  setActiveRunId("");
                }}
                style={[
                  S.pill,
                  {
                    minHeight: 44,
                    justifyContent: "center",
                    backgroundColor:
                      wave.id === selectedWaveId ? C.purple : C.lavender,
                  },
                ]}
              >
                <Text
                  style={[
                    S.small,
                    {
                      color:
                        wave.id === selectedWaveId ? C.white : C.deep,
                    },
                  ]}
                >
                  {wave.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedWave && (
            <Card style={{ backgroundColor: C.lavender }}>
              <Text style={S.eyebrow}>
                {selectedWave.cohort.toUpperCase()} ·{" "}
                {selectedWave.requiredPlatforms.join(" / ").toUpperCase()}
              </Text>
              <Text style={S.h3}>{selectedWave.name}</Text>
              {Boolean(selectedWave.notes) && <Txt>{selectedWave.notes}</Txt>}
            </Card>
          )}

          <Section title="Care profile & real role" />
          {!workspace.profiles.length ? (
            <Card>
              <Txt>
                No active Owner, Caregiver or Viewer membership is available for
                this pilot account.
              </Txt>
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {workspace.profiles.map((profile) => (
                <Pressable
                  key={profile.careRecipientId}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: profile.careRecipientId === selectedProfileId,
                  }}
                  onPress={() => {
                    setSelectedProfileId(profile.careRecipientId);
                    setActiveRunId("");
                  }}
                >
                  <Card
                    style={{
                      borderColor:
                        profile.careRecipientId === selectedProfileId
                          ? C.purple
                          : C.line,
                      borderWidth: 1,
                    }}
                  >
                    <View style={S.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.h3}>{profile.displayName}</Text>
                        <Txt style={S.small}>
                          Server-verified role: {profile.role}
                        </Txt>
                      </View>
                      {profile.careRecipientId === selectedProfileId && (
                        <Icon name="checkmark-circle" color={C.purple} />
                      )}
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}

          {selectedProfile && (
            <>
              <Section title="Acceptance journey" />
              <Card>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.eyebrow}>
                      {selectedProfile.role.toUpperCase()} ·{" "}
                      {platform.toUpperCase()} · {deviceClass.toUpperCase()}
                    </Text>
                    <Text style={S.h3}>
                      {roleProgress.complete}/{roleProgress.total} role steps ·{" "}
                      {deviceProgress.complete}/{deviceProgress.total} device checks
                    </Text>
                  </View>
                  {activeRun && <ResultPill status={activeRun.status} />}
                </View>
                <Button
                  title={
                    activeRun?.status === "in_progress"
                      ? "Start a separate retest"
                      : "Start new validation run"
                  }
                  secondary
                  icon="play-outline"
                  disabled={busy !== null}
                  onPress={() => void startRun()}
                />
              </Card>

              {activeRun && (
                <>
                  <Section title="Role journey" />
                  {roleSteps.map((step) => (
                    <CheckRow
                      key={step.id}
                      step={step}
                      checked={steps[step.id] === true}
                      disabled={busy !== null || activeRun.status !== "in_progress"}
                      onToggle={() =>
                        setSteps((current) => ({
                          ...current,
                          [step.id]: current[step.id] !== true,
                        }))
                      }
                    />
                  ))}

                  <Section title={platform.toUpperCase() + " device QA"} />
                  {qaSteps.map((step) => (
                    <CheckRow
                      key={step.id}
                      step={step}
                      checked={deviceChecks[step.id] === true}
                      disabled={busy !== null || activeRun.status !== "in_progress"}
                      onToggle={() =>
                        setDeviceChecks((current) => ({
                          ...current,
                          [step.id]: current[step.id] !== true,
                        }))
                      }
                    />
                  ))}

                  <Field
                    label="Acceptance notes (optional)"
                    value={notes}
                    onChange={setNotes}
                    multiline
                  />

                  {activeRun.status === "in_progress" && (
                    <>
                      <Button
                        title={busy === "save" ? "Saving…" : "Save progress"}
                        secondary
                        disabled={busy !== null}
                        onPress={() => void saveRun("in_progress")}
                      />
                      <Button
                        title="Mark journey passed"
                        icon="checkmark-circle-outline"
                        disabled={busy !== null || !canPass}
                        onPress={() => void saveRun("passed")}
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Blocked"
                            secondary
                            disabled={busy !== null}
                            onPress={() => void saveRun("blocked")}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Failed"
                            secondary
                            disabled={busy !== null}
                            onPress={() => void saveRun("failed")}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <Section title="Failure & recovery drills" />
          <Card style={{ backgroundColor: "#FFF9F2" }}>
            <Text style={S.h3}>Use safe, reversible drills only.</Text>
            <Txt style={S.small}>
              Do not create fake medical events or intentionally corrupt care
              records. These drills verify recovery behavior around connectivity,
              sessions, exports and notifications.
            </Txt>
          </Card>

          <Field
            label="Drill evidence / note (optional; applies to next result)"
            value={drillNote}
            onChange={setDrillNote}
            multiline
          />

          {recoveryDrills.map((drill) => {
            const recent = recentDrillsByType.get(drill.id);
            return (
              <Card key={drill.id}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>{drill.title}</Text>
                    <Txt style={S.small}>{drill.detail}</Txt>
                  </View>
                  {recent && <ResultPill status={recent.status} />}
                </View>

                {drill.route && (
                  <Button
                    title="Open related workspace"
                    secondary
                    icon="open-outline"
                    disabled={busy !== null}
                    onPress={() => {
                      if (drill.route === "PrivacyData") {
                        n.navigate("PrivacyData");
                      } else if (drill.route === "CarePacket") {
                        n.navigate("CarePacket");
                      } else if (drill.route === "Notifications") {
                        n.navigate("Notifications");
                      }
                    }}
                  />
                )}

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {(
                    [
                      ["passed", "Passed"],
                      ["blocked", "Blocked"],
                      ["failed", "Failed"],
                    ] as const
                  ).map(([status, label]) => (
                    <View key={status} style={{ flex: 1, minWidth: 95 }}>
                      <Button
                        title={label}
                        secondary={status !== "passed"}
                        disabled={busy !== null}
                        onPress={() => void recordDrill(drill.id, status)}
                      />
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}

          <Button
            title="Refresh launch evidence"
            secondary
            icon="refresh-outline"
            disabled={loading || busy !== null}
            onPress={() => void refresh()}
          />
        </>
      )}

      <Txt style={S.small}>
        A passed pilot journey confirms the recorded checklist was completed by
        that tester on that device. It is not a clinical, regulatory or legal
        certification.
      </Txt>
    </Page>
  );
}
