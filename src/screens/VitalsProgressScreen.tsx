import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { loadVitalsHistory } from "../backend";
import type { Entry } from "../domain";
import { useCare } from "../store";
import { useNav } from "./MainScreens";
import { Button, C, Card, Icon, Page, S, Txt } from "../ui";
import { themeBackground, themeBorder, themeForeground } from "../themeColors";
import {
  type TemperatureUnit, customRangeBounds, dateRangeBounds,
  loadTemperaturePreference, saveTemperaturePreference,
  temperatureForDisplay, vitalsEntries,
} from "../vitals";

type Filter = "7" | "30" | "90" | "custom";
type Metric = "bp" | "pulse" | "temperature";
const PAGE_SIZE = 40;

function MeasureChart({
  entries, metric, temperatureUnit,
}: { entries: Entry[]; metric: Metric; temperatureUnit: TemperatureUnit }) {
  const selected = [...entries].reverse().flatMap((entry) => {
    const value = (key: string) => {
      const raw = entry.values[key];
      return raw && /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
    };
    if (metric === "bp") {
      const sys = value("systolic"), dia = value("diastolic");
      return sys !== null && dia !== null ? [{ entry, a: sys, b: dia }] : [];
    }
    if (metric === "pulse") {
      const pulse = value("pulse");
      return pulse === null ? [] : [{ entry, a: pulse, b: null }];
    }
    // Historical measurements without an explicit unit cannot be converted safely.
    const raw = value("temperature");
    const recordedUnit = entry.values.temperature_unit;
    if (raw === null || (recordedUnit !== "F" && recordedUnit !== "C")) return [];
    const fahrenheit = recordedUnit === "F" ? raw : (raw * 9 / 5 + 32);
    return [{ entry, a: temperatureUnit === "F" ? fahrenheit : (fahrenheit - 32) * 5 / 9, b: null }];
  });
  const colors = metric === "bp" ? ["#77389D", "#DE699E"] : metric === "pulse" ? ["#7A42B6"] : ["#4384BA"];
  const values = selected.flatMap((item) => item.b === null ? [item.a] : [item.a, item.b]);
  const min = Math.min(...values), max = Math.max(...values);
  const margin = Math.max(2, (max - min) * .17);
  const low = min - margin, high = max + margin;
  const xPosition = (index: number) => 24 + index * 290 / Math.max(1, selected.length - 1);
  const yPosition = (value: number) => 138 - (value - low) * 110 / (high - low);
  const pathFor = (which: "a" | "b") => selected.map((point, index) => {
    const val = point[which];
    return val === null ? "" : `${index === 0 ? "M" : "L"}${xPosition(index).toFixed(2)} ${yPosition(val).toFixed(2)}`;
  }).join(" ");
  const title = metric === "bp" ? "Blood pressure" : metric === "pulse" ? "Pulse" : "Temperature";
  return (
    <Card style={{ borderRadius: 24, gap: 12, backgroundColor: themeBackground("#FFFCFF"), borderColor: themeBorder("#ECE0F3") }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[S.h3, { color: themeForeground("#19143C") }]}>{title}</Text>
        <Text style={[S.small, { color: themeForeground("#80728C") }]}>
          {metric === "bp" ? "mmHg" : metric === "pulse" ? "bpm" : `°${temperatureUnit}`}
        </Text>
      </View>
      {selected.length === 0 ? (
        <Text style={[S.small, { lineHeight: 20, color: themeForeground("#796E88") }]}>
          {metric === "temperature" && entries.some(e => e.values.temperature && !e.values.temperature_unit)
            ? "Temperature history has unverified legacy units. Those readings are not plotted until their units are confirmed."
            : "No recorded measurements for this period."}
        </Text>
      ) : (
        <>
          <Svg width="100%" height={180} viewBox="0 0 338 180" accessibilityElementsHidden>
            {[35, 87, 139].map(y => <Line key={y} x1="20" x2="322" y1={y} y2={y} stroke={themeBorder("#EFE7F3")} strokeDasharray="4,4" />)}
            <Path d={pathFor("a")} stroke={colors[0]} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {metric === "bp" && <Path d={pathFor("b")} stroke={colors[1]} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {selected.map((item, i) => <React.Fragment key={item.entry.id}>
              <Circle cx={xPosition(i)} cy={yPosition(item.a)} r="3.5" fill={colors[0]} />
              {item.b !== null && <Circle cx={xPosition(i)} cy={yPosition(item.b)} r="3.5" fill={colors[1]} />}
            </React.Fragment>)}
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 5 }}>
            <Text style={[S.small, { fontSize: 11 }]}>{new Date(selected[0].entry.recordedAt).toLocaleDateString()}</Text>
            <Text style={[S.small, { fontSize: 11 }]}>{selected.length} {selected.length === 1 ? "reading" : "readings"}</Text>
            <Text style={[S.small, { fontSize: 11 }]}>{new Date(selected[selected.length - 1].entry.recordedAt).toLocaleDateString()}</Text>
          </View>
          {metric === "bp" && <Text style={[S.small, { color: themeForeground("#806790") }]}>● Systolic (purple)   ● Diastolic (pink)</Text>}
        </>
      )}
    </Card>
  );
}

export function VitalsProgressScreen() {
  const { state } = useCare();
  const n = useNav();
  const [unit, setUnit] = useState<TemperatureUnit>("F");
  const [filter, setFilter] = useState<Filter>("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshId, setRefreshId] = useState(0);
  const [metric, setMetric] = useState<Metric>("bp");
  const [customError, setCustomError] = useState("");
  useEffect(() => {
    void loadTemperaturePreference().then(setUnit);
  }, []);
  const bounds = filter === "custom" ? customRangeBounds(startDate, endDate) : dateRangeBounds(Number(filter));
  useFocusEffect(useCallback(() => {
    let active = true;
    setRows([]);
    setHasMore(false);
    if (filter === "custom" && !bounds) {
      setLoading(false);
      setCustomError("Enter valid dates (YYYY-MM-DD) with the start on or before the end.");
      return () => { active = false; };
    }
    setCustomError("");
    setError("");
    setLoading(true);
    void loadVitalsHistory({
      careRecipientId: state.careRecipientId ?? "",
      start: bounds?.start, end: bounds?.end,
      pageSize: PAGE_SIZE,
    }).then(result => {
      if (!active) return;
      setRows(vitalsEntries(result.entries)); setHasMore(result.hasMore);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load Vitals history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId, filter, filter === "custom" ? startDate : "", filter === "custom" ? endDate : "", refreshId]));

  async function loadMore() {
    if (moreLoading || loading || !hasMore || !state.careRecipientId || !bounds) return;
    setMoreLoading(true);
    try {
      const result = await loadVitalsHistory({
        careRecipientId: state.careRecipientId, start: bounds.start, end: bounds.end,
        offset: rows.length, pageSize: PAGE_SIZE,
      });
      setRows(old => vitalsEntries([...old, ...result.entries].filter(
        (entry, i, all) => all.findIndex(other => other.id === entry.id) === i,
      )));
      setHasMore(result.hasMore);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load older readings."); }
    finally { setMoreLoading(false); }
  }

  return (
    <Page>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to vitals" onPress={() => n.goBack()}
        style={{ flexDirection: "row", alignItems: "center", minHeight: 42, gap: 10 }}>
        <Icon name="arrow-back" size={23} color={themeForeground("#773495")} />
        <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 15, color: themeForeground("#773495") }}>Vitals</Text>
      </Pressable>
      <View style={{ gap: 7, paddingVertical: 8 }}>
        <Text style={[S.eyebrow, { color: themeForeground("#7A4199"), letterSpacing: 2 }]}>YOUR CARE JOURNEY</Text>
        <Text accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold", fontSize: 30, color: themeForeground("#17143C") }}>Vitals progress</Text>
        <Txt>Recorded measurements for {state.careRecipientName || "your selected care profile"}. These charts show real observations, not medical diagnoses.</Txt>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["7","30","90","custom"] as Filter[]).map(f => <Pressable key={f} accessibilityRole="button"
          accessibilityState={{ selected: filter === f }} onPress={() => setFilter(f)}
          style={{ borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: themeBackground(filter === f ? "#763895" : "#F2EBF6"), borderColor: themeBorder("#E7D7ED"), borderWidth: 1 }}>
          <Text style={{ color: filter === f ? "#FFFFFF" : themeForeground("#693482"), fontFamily: "DMSans_600SemiBold", fontSize: 12 }}>{f === "custom" ? "Custom" : `${f} days`}</Text>
        </Pressable>)}
      </View>
      {filter === "custom" && <View style={{ flexDirection: "row", gap: 10 }}>
        {[{label:"Start date",value:startDate,change:setStartDate},{label:"End date",value:endDate,change:setEndDate}].map(field => (
          <View key={field.label} style={{ flex: 1, gap: 6 }}>
            <Text style={[S.small,{ color: themeForeground("#7A6391") }]}>{field.label}</Text>
            <TextInput value={field.value} onChangeText={field.change} placeholder="YYYY-MM-DD" accessibilityLabel={field.label} autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: themeBorder("#D8C8E8"), borderRadius: 16, minHeight: 45,
                backgroundColor: themeBackground("#FFFFFF"), paddingHorizontal: 10, color: themeForeground("#241E3C") }} />
          </View>
        ))}
      </View>}
      {Boolean(customError) && <Text accessibilityRole="alert" style={{ color: C.rose }}>{customError}</Text>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <Text style={[S.h3, { color: themeForeground("#1C173D") }]}>History</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh vitals progress" onPress={() => setRefreshId(x => x + 1)} style={{ padding: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="refresh" size={17} color={themeForeground("#773895")} />
          <Text style={{ color: themeForeground("#773895") }}>Refresh</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={C.purple} /> : Boolean(error) ? (
        <Card><Text accessibilityRole="alert" style={{ color: C.rose }}>{error}</Text><Button title="Retry" onPress={() => setRefreshId(x => x + 1)} /></Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["bp","Blood pressure"],["pulse","Pulse"],["temperature","Temperature"]] as [Metric,string][]).map(([key,label]) =>
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: metric === key }} onPress={() => setMetric(key)}
                style={{ flex: 1, borderRadius: 16, backgroundColor: themeBackground(metric === key ? "#EEE1F9" : "#F9F5FB"), padding: 11, alignItems: "center" }}>
                <Text numberOfLines={2} style={{ fontFamily: "DMSans_600SemiBold", fontSize: 11.2, textAlign: "center", color: themeForeground("#71348E") }}>{label}</Text>
              </Pressable>)}
          </View>
          <MeasureChart entries={rows} metric={metric} temperatureUnit={unit} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[S.small, { flex: 1 }]}>Temperature display</Text>
            {(["C","F"] as TemperatureUnit[]).map(u =>
              <Pressable key={u} accessibilityRole="button" accessibilityLabel={`Display Celsius °${u === "C" ? "C" : "Fahrenheit"}`}
                accessibilityState={{ selected: unit === u }} onPress={() => { setUnit(u); void saveTemperaturePreference(u).catch(() => {}); }}
                style={{ borderRadius: 14, paddingHorizontal: 17, paddingVertical: 9, backgroundColor: themeBackground(unit === u ? "#743895" : "#F1EAF9") }}>
                <Text style={{ color: unit === u ? "#FFFFFF" : themeForeground("#743895") }}>°{u}</Text>
              </Pressable>)}
          </View>
          <Text style={[S.small, { color: themeForeground("#7E738A"), lineHeight: 18 }]}>Each chart point is one observation, including multiple readings on the same day. Older temperatures without a recorded unit are excluded from converted charts.</Text>
          {!rows.length ? <Card style={{ borderRadius: 23, gap: 8 }}><Icon name="clipboard-outline" size={27} color={C.purple} /><Text style={S.h3}>No observations in this period</Text><Txt>Try a longer date range or record a new observation.</Txt></Card> : rows.map(entry =>
            <Card key={entry.id} style={{ borderRadius: 20, gap: 9 }}>
              <Text style={[S.small, { color: themeForeground("#776887") }]}>{new Date(entry.recordedAt).toLocaleString()}</Text>
              <Text style={[S.h3, { fontSize: 15 }]}>{entry.values.systolic || "—"}/{entry.values.diastolic || "—"} mmHg  ·  {entry.values.pulse || "—"} bpm</Text>
              {entry.values.temperature && <Text style={[S.small, { color: themeForeground("#615277") }]}>{temperatureForDisplay(entry.values, unit)}</Text>}
              {entry.values.notes && <Txt>{entry.values.notes}</Txt>}
            </Card>
          )}
          {hasMore && <Button title={moreLoading ? "Loading more…" : "Load older observations"} disabled={moreLoading} onPress={() => void loadMore()} />}
        </>
      )}
    </Page>
  );
}
