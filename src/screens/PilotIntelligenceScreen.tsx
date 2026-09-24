import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  loadPilotIntelligence,
  pilotFunnelRate,
  pilotOutcomeReportHtml,
  type PilotIntelligence,
} from "../pilotIntelligence";
import { printHtmlResource } from "../printing";
import {
  Button,
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";

function Metric({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 110 }}>
      <Text style={[S.title, { fontSize: 28, color: C.deep }]}>{value}</Text>
      <Txt style={S.small}>{label}</Txt>
    </View>
  );
}

const funnelLabels: Array<[keyof PilotIntelligence["funnel"], string]> = [
  ["enrolled", "Enrolled"],
  ["accountConfirmed", "Account confirmed"],
  ["firstSignIn", "First sign-in"],
  ["documentsComplete", "Documents complete"],
  ["roleReady", "Care role ready"],
  ["activeLaunchReady", "Launch ready"],
  ["passedValidation", "Passed validation"],
  ["completed", "Completed"],
];

export function PilotIntelligenceScreen() {
  const [data, setData] = useState<PilotIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setData(await loadPilotIntelligence());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pilot intelligence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function exportReport() {
    if (!data) return;
    try {
      await printHtmlResource(
        "EnVizion Life Pilot Outcome Report",
        pilotOutcomeReportHtml(data),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The pilot report could not be opened.",
      );
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="PILOT METRICS & LAUNCH INTELLIGENCE"
        title="One evidence view for the whole pilot."
        body="Track the onboarding funnel, real device validation, feedback, launch waves and pilot outcomes without exposing clinical record contents."
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {loading && !data ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Building pilot intelligence…</Txt>
        </Card>
      ) : data ? (
        <>
          <Section
            title="Pilot funnel"
            action="Refresh"
            onPress={() => void refresh()}
          />
          {funnelLabels.map(([key, label]) => {
            const value = data.funnel[key];
            const rate = pilotFunnelRate(value, data.funnel.enrolled);
            return (
              <Card key={key}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>{label}</Text>
                    <Txt style={S.small}>
                      {value} participant{value === 1 ? "" : "s"} · {rate}% of
                      enrolled
                    </Txt>
                  </View>
                  <Text style={[S.title, { fontSize: 27, color: C.purple }]}>
                    {rate}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: C.lavender,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 8,
                      width: `${Math.min(100, rate)}%` as `${number}%`,
                      maxWidth: "100%",
                      backgroundColor: C.purple,
                    }}
                  />
                </View>
              </Card>
            );
          })}

          <Section title="Pilot outcomes" />
          <Card style={{ backgroundColor: C.lavender }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <Metric value={data.outcomes.completed} label="completed" />
              <Metric value={data.outcomes.withdrawn} label="withdrawn" />
              <Metric value={data.outcomes.active} label="active" />
              <Metric value={data.outcomes.paused} label="paused" />
            </View>
          </Card>

          <Section title="Device & platform validation matrix" />
          {!data.deviceMatrix.length ? (
            <Card>
              <Txt>
                No real device acceptance runs exist yet. This section will
                populate from actual Owner/Caregiver/Viewer validation.
              </Txt>
            </Card>
          ) : (
            data.deviceMatrix.map((item) => (
              <Card key={item.platform + "-" + item.deviceClass}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>
                      {item.platform.toUpperCase()} · {item.deviceClass}
                    </Text>
                    <Txt style={S.small}>
                      {item.total} runs · {item.passed} passed · {item.failed} failed ·{" "}
                      {item.blocked} blocked · {item.inProgress} in progress
                    </Txt>
                  </View>
                  <Text style={[S.title, { fontSize: 26 }]}>
                    {item.passRate}%
                  </Text>
                </View>
              </Card>
            ))
          )}

          <Section title="Feedback trends" />
          {!data.feedbackTrends.length ? (
            <Card>
              <Txt>No pilot feedback has been submitted yet.</Txt>
            </Card>
          ) : (
            data.feedbackTrends.map((item) => (
              <Card key={item.category}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>{item.category}</Text>
                    <Txt style={S.small}>
                      {item.open} open · {item.closed} closed · {item.last30Days} in
                      the last 30 days
                    </Txt>
                  </View>
                  <Text style={[S.title, { fontSize: 26 }]}>
                    {item.total}
                  </Text>
                </View>
              </Card>
            ))
          )}

          <Section title="Launch-wave comparison" />
          {!data.waveComparisons.length ? (
            <Card>
              <Txt>No launch waves exist yet.</Txt>
            </Card>
          ) : (
            data.waveComparisons.map((wave) => (
              <Card key={wave.id}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>{wave.name}</Text>
                    <Txt style={S.small}>
                      {wave.cohort} · {wave.status.replaceAll("_", " ")}
                    </Txt>
                  </View>
                  <Text style={[S.title, { fontSize: 25 }]}>
                    {wave.runPassRate}%
                  </Text>
                </View>
                <Txt style={S.small}>
                  {wave.testerCount} testers · {wave.runs} acceptance runs ·{" "}
                  {wave.passedRuns} passed · {wave.failedRuns} failed ·{" "}
                  {wave.blockedRuns} blocked
                </Txt>
                <Txt style={S.small}>
                  Roles: {wave.rolesCovered.join(", ") || "none"} · Platforms:{" "}
                  {wave.platformsCovered.join(", ") || "none"}
                </Txt>
                <Txt style={S.small}>
                  Recovery drills: {wave.passedDrills}/{wave.drills} passed ·
                  Sign-off: {wave.signoffStatus ?? "not recorded"}
                </Txt>
              </Card>
            ))
          )}

          <Section title="Clinical content readiness" />
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <Metric value={data.contentReadiness.published} label="published" />
              <Metric value={data.contentReadiness.draft} label="draft" />
              <Metric value={data.contentReadiness.retired} label="retired" />
              <Metric value={data.contentReadiness.total} label="total" />
            </View>
          </Card>

          <Section title="Unresolved launch dependencies" />
          {!data.launchGaps.length ? (
            <Card style={{ backgroundColor: "#E8F1ED" }}>
              <Icon name="checkmark-circle-outline" color={C.green} size={28} />
              <Text style={S.h3}>
                No system-reported pilot launch gaps remain.
              </Text>
            </Card>
          ) : (
            <Card style={{ backgroundColor: "#FFF9F2" }}>
              {data.launchGaps.map((gap) => (
                <Txt key={gap}>• {gap}</Txt>
              ))}
            </Card>
          )}

          <Card style={{ backgroundColor: C.deep }}>
            <Text style={[S.h2, { color: C.white }]}>
              Final pilot outcome report
            </Text>
            <Txt style={{ color: "#E3D5E9" }}>
              Generate a printable/PDF operational report from the same live
              evidence shown above. No medication names, observations, family
              messages or document contents are included.
            </Txt>
            <Button
              title="Generate pilot outcome report"
              icon="document-text-outline"
              onPress={() => void exportReport()}
            />
          </Card>

          <Txt style={S.small}>
            Generated from live pilot operations at{" "}
            {new Date(data.generatedAt).toLocaleString()}. Metrics are
            operational evidence, not a clinical or regulatory certification.
          </Txt>
        </>
      ) : null}
    </Page>
  );
}
