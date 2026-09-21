import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { transitionSteps } from "../content";
import {
  appointmentPreparation,
  buildCareTimeline,
  buildDailyActivity,
  medicationStats,
  numericSeries,
  type NumericPoint,
} from "../insights";
import { useCare } from "../store";
import {
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}

function ProgressBar({
  value,
  total,
}: {
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value }}
      style={{ height: 7, borderRadius: 7, backgroundColor: "#E9E0ED" }}
    >
      <View
        style={{
          height: 7,
          borderRadius: 7,
          width: `${percentage}%`,
          backgroundColor: C.purple,
        }}
      />
    </View>
  );
}

function Stat({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 92, gap: 4 }}>
      <Text style={[S.title, { fontSize: 27, color: C.deep }]}>{value}</Text>
      <Text style={S.small}>{label}</Text>
    </View>
  );
}

function LineChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  primary: NumericPoint[];
  secondary?: NumericPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const width = 320;
  const height = 145;
  const paddingX = 22;
  const paddingY = 20;
  const combined = [...primary, ...(secondary ?? [])];

  if (!combined.length) {
    return (
      <View
        style={{
          minHeight: 120,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Icon name="analytics-outline" color={C.muted} />
        <Txt style={{ textAlign: "center" }}>
          Record a few values to see a trend line here.
        </Txt>
      </View>
    );
  }

  const values = combined.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.08, 1);
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;

  const points = (series: NumericPoint[]) =>
    series
      .map((point, index) => {
        const x =
          series.length === 1
            ? width / 2
            : paddingX +
              (index / (series.length - 1)) * (width - paddingX * 2);
        const y =
          height -
          paddingY -
          ((point.value - min) / (max - min)) * (height - paddingY * 2);
        return { x, y };
      });

  const primaryPoints = points(primary);
  const secondaryPoints = points(secondary ?? []);

  const polyline = (items: { x: number; y: number }[]) =>
    items.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <View style={{ gap: 10 }}>
      <View
        accessible
        accessibilityLabel={`${primaryLabel} trend chart with ${primary.length} recorded values`}
        style={{
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "#F8F4F9",
        }}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <Line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={paddingY + (height - paddingY * 2) * ratio}
              y2={paddingY + (height - paddingY * 2) * ratio}
              stroke="#E3D8E7"
              strokeWidth="1"
            />
          ))}
          {primaryPoints.length > 1 && (
            <Polyline
              points={polyline(primaryPoints)}
              fill="none"
              stroke={C.purple}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {primaryPoints.map((point, index) => (
            <Circle
              key={`primary-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={C.purple}
            />
          ))}
          {secondaryPoints.length > 1 && (
            <Polyline
              points={polyline(secondaryPoints)}
              fill="none"
              stroke={C.green}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {secondaryPoints.map((point, index) => (
            <Circle
              key={`secondary-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={C.green}
            />
          ))}
        </Svg>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple }}
          />
          <Text style={S.small}>
            {primaryLabel}
            {primary.length
              ? ` · latest ${primary[primary.length - 1].value}`
              : ""}
          </Text>
        </View>
        {secondaryLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.green }}
            />
            <Text style={S.small}>
              {secondaryLabel}
              {secondary?.length
                ? ` · latest ${secondary[secondary.length - 1].value}`
                : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ActivityBars({
  activity,
}: {
  activity: ReturnType<typeof buildDailyActivity>;
}) {
  const max = Math.max(1, ...activity.map((day) => day.total));

  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-end" }}>
      {activity.map((day) => (
        <View key={day.dateKey} style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <View
            accessibilityLabel={`${day.label}: ${day.observations} observations and ${day.medicationRecords} medication records`}
            style={{
              width: "100%",
              maxWidth: 34,
              height: 96,
              borderRadius: 12,
              backgroundColor: "#EFE8F2",
              justifyContent: "flex-end",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: `${(day.medicationRecords / max) * 100}%`,
                minHeight: day.medicationRecords ? 5 : 0,
                backgroundColor: C.green,
              }}
            />
            <View
              style={{
                height: `${(day.observations / max) * 100}%`,
                minHeight: day.observations ? 5 : 0,
                backgroundColor: C.purple,
              }}
            />
          </View>
          <Text style={[S.small, { fontSize: 10 }]}>{day.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function CareInsightsScreen() {
  const n = useNav();
  const { state } = useCare();

  const dailyActivity = useMemo(
    () => buildDailyActivity(state.entries, state.medicationRecords, 7),
    [state.entries, state.medicationRecords],
  );
  const systolic = useMemo(
    () => numericSeries(state.entries, "Vitals", "systolic"),
    [state.entries],
  );
  const diastolic = useMemo(
    () => numericSeries(state.entries, "Vitals", "diastolic"),
    [state.entries],
  );
  const glucose = useMemo(
    () => numericSeries(state.entries, "Blood sugar", "glucose"),
    [state.entries],
  );
  const medications = useMemo(
    () => medicationStats(state.medicationRecords),
    [state.medicationRecords],
  );
  const appointment = useMemo(
    () => appointmentPreparation(state.appointment, state.questions),
    [state.appointment, state.questions],
  );
  const timeline = useMemo(
    () => buildCareTimeline(state.entries, state.medicationRecords, 12),
    [state.entries, state.medicationRecords],
  );

  const activeDays = dailyActivity.filter((day) => day.total > 0).length;
  const sevenDayRecords = dailyActivity.reduce(
    (sum, day) => sum + day.total,
    0,
  );

  return (
    <Page>
      <Heading
        eyebrow="CARE TIMELINE & INSIGHTS"
        title="See the care record take shape."
        body="Visual summaries of what your care team has recorded. These charts organize information; they do not diagnose, score risk, or interpret whether a value is medically normal."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {activeDays} active days in the last 7 · {sevenDayRecords} recorded
          care events
        </Txt>
      </Card>

      <Section title="Last 7 days" />
      <Card>
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          <Stat value={state.entries.length} label="observations in record" />
          <Stat value={state.medications.length} label="medications listed" />
          <Stat
            value={medications.recordedCount}
            label="dose entries currently recorded"
          />
        </View>
        <ActivityBars activity={dailyActivity} />
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <View
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple }}
            />
            <Text style={S.small}>Care observations</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <View
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.green }}
            />
            <Text style={S.small}>Medication records</Text>
          </View>
        </View>
      </Card>

      <Section title="Recorded vital trends" />
      <Card>
        <Text style={S.h3}>Blood pressure entries</Text>
        <Txt style={S.small}>
          Shows the last {Math.max(systolic.length, diastolic.length)} recorded
          values only. EnVizion does not apply clinical thresholds here.
        </Txt>
        <LineChart
          primary={systolic}
          secondary={diastolic}
          primaryLabel="Systolic"
          secondaryLabel="Diastolic"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Open vital records →
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={S.h3}>Blood glucose entries</Text>
        <Txt style={S.small}>
          Recorded values are displayed without target ranges or treatment
          recommendations.
        </Txt>
        <LineChart primary={glucose} primaryLabel="Blood glucose" />
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Tracker", { kind: "Blood sugar" })}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Open blood sugar records →
          </Text>
        </Pressable>
      </Card>

      <Section title="Medication record" />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <Stat value={state.medications.length} label="active list entries" />
          <Stat value={medications.recordedCount} label="dose records" />
          <Stat value={medications.correctedCount} label="corrected entries" />
        </View>
        <Txt style={S.small}>
          These counts describe caregiver-entered records. They are not an
          adherence percentage and do not confirm that medication was taken as
          prescribed.
        </Txt>
        {medications.latestRecordedAt && (
          <Txt>
            Latest dose record: {formatDate(medications.latestRecordedAt)}
          </Txt>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Medications")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Review medication history →
          </Text>
        </Pressable>
      </Card>

      <Section title="Preparation progress" />
      <Card>
        <View style={S.between}>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Next appointment</Text>
            <Txt>{state.appointment.title}</Txt>
          </View>
          <Text style={[S.h3, { color: C.purple }]}>
            {appointment.ready}/{appointment.total}
          </Text>
        </View>
        <ProgressBar value={appointment.ready} total={appointment.total} />
        <Txt style={S.small}>
          Counts whether date, time, location, questions and preparation notes
          have been entered.
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Appointments")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Prepare for the visit →
          </Text>
        </Pressable>
      </Card>

      <Card>
        <View style={S.between}>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Hospital-to-home checklist</Text>
            <Txt>Transition preparation</Txt>
          </View>
          <Text style={[S.h3, { color: C.purple }]}>
            {state.transition.length}/{transitionSteps.length}
          </Text>
        </View>
        <ProgressBar
          value={state.transition.length}
          total={transitionSteps.length}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Transition")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Open transition checklist →
          </Text>
        </Pressable>
      </Card>

      <Section title="Recent care timeline" />
      {!timeline.length ? (
        <Card>
          <Icon name="time-outline" />
          <Text style={S.h3}>The timeline starts with your first record.</Text>
          <Txt>
            Observations and medication history will appear here in time order.
          </Txt>
        </Card>
      ) : (
        timeline.map((item) => (
          <Card key={item.id}>
            <View style={{ flexDirection: "row", gap: 13 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  backgroundColor: item.corrected ? C.redBg : C.lavender,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    item.kind === "medication"
                      ? "medical-outline"
                      : "pulse-outline"
                  }
                  color={item.corrected ? C.rose : C.purple}
                  size={20}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>{item.title}</Text>
                <Txt>{item.subtitle}</Txt>
                <Text style={S.small}>{formatDate(item.recordedAt)}</Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>How to use these insights</Text>
        <Txt>
          Use the graphs and timeline to notice what has been recorded and to
          prepare questions for the healthcare team. EnVizion Life does not
          automatically identify deterioration, diagnose a condition, or tell
          you to change treatment.
        </Txt>
      </Card>
    </Page>
  );
}
