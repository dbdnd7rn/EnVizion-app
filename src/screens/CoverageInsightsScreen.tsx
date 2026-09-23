import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import {
  loadCoverageOperationalInsights,
  type CoverageOperationalInsights,
} from "../careCoverageInsights";
import {
  coverageHourLabel,
  coverageMinutesLabel,
  coveragePercentWidth,
  coverageWeekdayLabel,
} from "../careCoverageInsightsHelpers";
import { useCare } from "../store";
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

type Props = NativeStackScreenProps<RootStack, "CoverageInsights">;

export function CoverageInsightsScreen({ navigation }: Props) {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const owner = state.accessRole === "owner";

  const [periodDays, setPeriodDays] = useState(90);
  const [insights, setInsights] = useState<CoverageOperationalInsights | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId || !owner) {
      setInsights(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      setInsights(
        await loadCoverageOperationalInsights(careRecipientId, periodDays),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load caregiver coverage insights.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, owner, periodDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="COVERAGE INSIGHTS"
          title="Choose a care profile first."
          body="Coverage insights belong to one shared care profile."
        />
      </Page>
    );
  }

  if (!owner) {
    return (
      <Page>
        <Heading
          eyebrow="COVERAGE INSIGHTS"
          title="Operational coverage insights are owner-only."
          body="Caregivers can manage their own availability and coverage responses without seeing another caregiver's response history."
        />
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="lock-closed-outline" color={C.purple} />
          <Text style={S.h3}>Protected coordination data</Text>
          <Txt>
            These metrics summarize care-team response activity and are only
            available to the care profile Owner.
          </Txt>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CAREGIVER COVERAGE INSIGHTS"
        title="See where coverage succeeds and where the schedule repeatedly needs help."
        body="These are objective operational counts from real coverage activity. EnVizion does not rank, grade, or label caregivers."
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        {[30, 90, 180].map((days) => (
          <View key={days} style={{ flex: 1 }}>
            <Button
              title={days + " days"}
              secondary={periodDays !== days}
              onPress={() => setPeriodDays(days)}
            />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Weekly coverage"
            secondary
            icon="calendar-outline"
            onPress={() => navigation.navigate("WeeklyCoveragePlan")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Open Coverage"
            secondary
            icon="megaphone-outline"
            onPress={() => navigation.navigate("CareCoverageRequests")}
          />
        </View>
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
          <Txt>Calculating live coverage activity…</Txt>
        </Card>
      ) : insights ? (
        <>
          <Section title="Coverage operations" />
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Card style={{ flex: 1, minWidth: 130 }}>
              <Text style={S.eyebrow}>COVERAGE EVENTS</Text>
              <Text style={S.h2}>{insights.summary.coverageEvents}</Text>
              <Txt style={S.small}>Requests opened</Txt>
            </Card>
            <Card style={{ flex: 1, minWidth: 130 }}>
              <Text style={S.eyebrow}>FILLED</Text>
              <Text style={S.h2}>{insights.summary.filledEvents}</Text>
              <Txt style={S.small}>Coverage secured</Txt>
            </Card>
            <Card style={{ flex: 1, minWidth: 130 }}>
              <Text style={S.eyebrow}>AVG. TIME TO FILL</Text>
              <Text style={S.h2}>
                {coverageMinutesLabel(insights.summary.avgFillMinutes)}
              </Text>
              <Txt style={S.small}>From request to claim</Txt>
            </Card>
            <Card style={{ flex: 1, minWidth: 130 }}>
              <Text style={S.eyebrow}>ENDED UNFILLED</Text>
              <Text style={S.h2}>
                {insights.summary.unresolvedEndedEvents}
              </Text>
              <Txt style={S.small}>Needs process review</Txt>
            </Card>
          </View>

          <Section title="Caregiver response activity" />
          <Card style={{ backgroundColor: C.lavender }}>
            <View style={S.row}>
              <Icon name="information-circle-outline" color={C.purple} />
              <Txt style={{ flex: 1 }}>
                Response rate means responses to backup coverage notifications
                in completed or ended requests. It is not a performance score.
              </Txt>
            </View>
          </Card>

          {!insights.caregivers.length ? (
            <Card>
              <Text style={S.h3}>No completed caregiver response history yet.</Text>
              <Txt>
                Activity will appear after backup coverage requests are
                completed or their care windows end.
              </Txt>
            </Card>
          ) : (
            insights.caregivers.map((item) => {
              const width = coveragePercentWidth(item.responseRatePct);

              return (
                <Card key={item.userId}>
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h2}>{item.displayName}</Text>
                      <Txt style={S.small}>
                        {item.notifiedRequests} notified ·{" "}
                        {item.respondedRequests} responded
                      </Txt>
                    </View>
                    <View style={[S.pill, { backgroundColor: C.lavender }]}>
                      <Txt style={S.small}>
                        {item.responseRatePct == null
                          ? "No rate yet"
                          : item.responseRatePct.toFixed(1) + "% response"}
                      </Txt>
                    </View>
                  </View>

                  <View
                    accessibilityLabel={
                      item.responseRatePct == null
                        ? "No response rate available"
                        : "Response rate " +
                          item.responseRatePct.toFixed(1) +
                          " percent"
                    }
                    style={{
                      height: 8,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: C.line,
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: width + "%",
                        backgroundColor: C.purple,
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    <View style={[S.pill, { backgroundColor: "#EAF4EF" }]}>
                      <Txt style={S.small}>
                        {item.acceptedRequests} accepted
                      </Txt>
                    </View>
                    <View style={[S.pill, { backgroundColor: "#F1EDEF" }]}>
                      <Txt style={S.small}>
                        {item.declinedRequests} declined
                      </Txt>
                    </View>
                    <View style={[S.pill, { backgroundColor: C.lavender }]}>
                      <Txt style={S.small}>
                        {item.savedRequests} backup saves
                      </Txt>
                    </View>
                  </View>

                  <Txt style={S.small}>
                    Average response time ·{" "}
                    {coverageMinutesLabel(item.avgResponseMinutes)}
                  </Txt>
                </Card>
              );
            })
          )}

          <Section title="Recurring uncovered time patterns" />
          {!insights.gapPatterns.length ? (
            <Card>
              <Text style={S.h3}>No repeated weekly gap pattern yet.</Text>
              <Txt>
                This section grows from real weekly slots that entered Open
                Coverage during the selected period.
              </Txt>
            </Card>
          ) : (
            insights.gapPatterns.map((pattern, index) => (
              <Card
                key={
                  pattern.weekdayIso +
                  ":" +
                  pattern.localHour +
                  ":" +
                  index
                }
              >
                <View style={S.between}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.h3}>
                      {coverageWeekdayLabel(pattern.weekdayIso)} ·{" "}
                      {coverageHourLabel(pattern.localHour)}
                    </Text>
                    <Txt style={S.small}>
                      {pattern.gapCount} Open Coverage{" "}
                      {pattern.gapCount === 1 ? "event" : "events"} ·{" "}
                      {coverageMinutesLabel(pattern.totalGapMinutes)} total
                    </Txt>
                  </View>
                  <Icon name="time-outline" color={C.purple} />
                </View>
              </Card>
            ))
          )}

          <Txt style={S.small}>
            Updated from live care-team data ·{" "}
            {new Date(insights.generatedAt).toLocaleString()}
          </Txt>
        </>
      ) : null}
    </Page>
  );
}
