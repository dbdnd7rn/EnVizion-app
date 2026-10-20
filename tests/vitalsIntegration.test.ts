import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canonicalVitals, customRangeBounds, dateRangeBounds, displayedTemperature,
  fromFahrenheit, localDayBounds, temperatureForDisplay, toFahrenheit,
  validateVitals, vitalsEntries,
} from "../src/vitalsHelpers.ts";

const original = readFileSync(new URL("../src/screens/CareScreens.tsx", import.meta.url), "utf8");

test("Celsius and Fahrenheit conversions are exact at reference points", () => {
  assert.equal(toFahrenheit(0,"C"),32);
  assert.equal(toFahrenheit(37,"C"),98.6);
  assert.equal(fromFahrenheit(98.6,"C").toFixed(1),"37.0");
  assert.equal(displayedTemperature(98.6,"C"),"37");
});

test("round-trip from a canonical temperature avoids toggling drift", () => {
  const precise = toFahrenheit(38.24,"C");
  for(let i=0;i<100;i++){
    const c = displayedTemperature(precise,"C");
    const f = displayedTemperature(precise,"F");
    assert.equal(c,"38.2");
    assert.equal(f,"100.8");
  }
});

test("stored temperature uses canonical Fahrenheit with an explicit unit", () => {
  const values = canonicalVitals({systolic:"120",diastolic:"80",temperature:"37",notes:"normal"}, "C");
  assert.equal(values.temperature,"98.6");
  assert.equal(values.temperature_unit,"F");
  assert.equal(values.systolic,"120");
  assert.equal(values.notes,"normal");
  assert.equal(temperatureForDisplay(values,"C"),"37 °C");
  assert.equal(temperatureForDisplay(values,"F"),"98.6 °F");
});

test("unlabeled historical readings are never silently converted", () => {
  assert.equal(temperatureForDisplay({temperature:"90.8"},"C"),"90.8 (unit not recorded)");
  assert.equal(temperatureForDisplay({temperature:"90.8"},"F"),"90.8 (unit not recorded)");
  assert.equal(temperatureForDisplay({temperature:"36.5",temperature_unit:"C"},"F"),"97.7 °F");
});

test("validates blood pressure relationships and malformed or impossible measurements", () => {
  assert.equal(validateVitals({systolic:"120",diastolic:"80",temperature:"37",pulse:"75"},"C"),null);
  assert.match(validateVitals({systolic:"80",diastolic:"120"},"F")!,/higher/);
  assert.match(validateVitals({systolic:"NaN",diastolic:"80"},"F")!,/valid/);
  assert.match(validateVitals({systolic:"120",diastolic:"80",temperature:"999"},"F")!,/valid/);
  assert.match(validateVitals({systolic:"120.5",diastolic:"80"},"F")!,/whole number/);
  assert.match(validateVitals({systolic:"120",diastolic:"80",pulse:"0"},"F")!,/valid/);
});

test("local today and date filters use calendar boundaries", () => {
  const bounds = localDayBounds(new Date(2026,9,20,15,30));
  assert.equal(new Date(bounds.start).getHours(),0);
  assert.equal(new Date(bounds.end).getDate(),21);
  assert.equal(dateRangeBounds(7,new Date(2026,9,20,10)).start,
    new Date(2026,9,14).toISOString());
  assert.ok(customRangeBounds("2026-10-01","2026-10-20"));
  assert.equal(customRangeBounds("2026-02-30","2026-10-20"),null);
  assert.equal(customRangeBounds("2026-10-20","2026-10-01"),null);
});

test("same-day readings preserve order and no IDs are duplicated on save", () => {
  const entries = [
    {id:"a",kind:"Vitals" as const,recordedAt:"2026-10-20T09:00:00Z",values:{}},
    {id:"b",kind:"Vitals" as const,recordedAt:"2026-10-20T10:00:00Z",values:{}},
  ];
  assert.deepEqual(vitalsEntries(entries).map(x=>x.id),["b","a"]);
  assert.match(original,/savingLock\.current/);
  assert.match(original,/navigate\("VitalsProgress"\)/);
  assert.match(original,/temperatureForDisplay/);
  assert.match(original,/recentFilter === "today"/);
});

test("history queries apply care recipient filter and RLS rather than fake data", () => {
  const backend = readFileSync(new URL("../src/backend.ts", import.meta.url), "utf8");
  assert.match(backend,/loadVitalsHistory/);
  assert.match(backend,/\.eq\("care_recipient_id", input\.careRecipientId\)/);
  assert.match(backend,/\.range\(offset, offset \+ pageSize\)/);
  assert.match(backend,/\.order\("observed_at", \{ ascending: false \}\)/);
  const progress = readFileSync(new URL("../src/screens/VitalsProgressScreen.tsx", import.meta.url), "utf8");
  assert.match(progress,/useFocusEffect/);
  assert.match(progress,/loadVitalsHistory\(/);
  assert.match(progress,/customRangeBounds/);
  assert.match(progress,/hasMore/);
});
