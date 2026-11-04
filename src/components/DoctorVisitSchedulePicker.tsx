import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { themeBackground, themeBorder, themeForeground } from "../themeColors";
import { Button, C, Card, Icon, S, Txt } from "../ui";
import {
  doctorVisitCalendarDays,
  doctorVisitDateLabel,
  doctorVisitTimeLabel,
  formatDoctorVisitDate,
  formatDoctorVisitTime,
  moveDoctorVisitMonth,
  parseDoctorVisitDate,
  parseDoctorVisitTime,
} from "../doctorVisitDateTimeHelpers";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

type Panel = "date" | "time" | null;

export function DoctorVisitSchedulePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled = false,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => parseDoctorVisitDate(date) ?? new Date(),
  );
  const initialTime = parseDoctorVisitTime(time);
  const [draftHour, setDraftHour] = useState(initialTime?.hour ?? 9);
  const [draftMinute, setDraftMinute] = useState(initialTime?.minute ?? 0);

  function toggleDate() {
    if (disabled) return;
    if (panel === "date") {
      setPanel(null);
      return;
    }
    const current = parseDoctorVisitDate(date) ?? new Date();
    setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1, 12));
    setPanel("date");
  }

  function toggleTime() {
    if (disabled) return;
    if (panel === "time") {
      setPanel(null);
      return;
    }
    const current = parseDoctorVisitTime(time);
    setDraftHour(current?.hour ?? 9);
    setDraftMinute(current?.minute ?? 0);
    setPanel("time");
  }

  const selectedDate = parseDoctorVisitDate(date);
  const today = new Date();
  const calendarDays = doctorVisitCalendarDays(calendarMonth);
  const calendarTitle = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const inputStyle = {
    minHeight: 72,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: themeBorder("#E4D7EC"),
    backgroundColor: themeBackground("#FFFFFF"),
    flexDirection: "row" as const,
    gap: 13,
    alignItems: "center" as const,
    paddingHorizontal: 16,
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text style={[S.h3, { fontSize: 13 }]}>Visit date</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Choose visit date, currently " + doctorVisitDateLabel(date)}
          accessibilityHint="Opens a calendar with previous and next month navigation."
          accessibilityState={{ expanded: panel === "date", disabled }}
          onPress={toggleDate}
          disabled={disabled}
          style={inputStyle}
        >
          <Icon name="calendar-outline" color={C.purple} size={23} />
          <View style={{ flex: 1 }}>
            <Text style={[S.body, { color: themeForeground("#21183A") }]}>
              {doctorVisitDateLabel(date)}
            </Text>
            {selectedDate && <Txt style={S.small}>{date}</Txt>}
          </View>
          <Icon name={panel === "date" ? "chevron-up-outline" : "chevron-down-outline"} color={C.purple} />
        </Pressable>
        {panel === "date" && (
          <Card style={{ gap: 12, backgroundColor: themeBackground("#FAF6FD") }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => setCalendarMonth(current => moveDoctorVisitMonth(current, -1))}
                style={{ padding: 10, borderRadius: 16, backgroundColor: themeBackground("#EFE5F7") }}
              >
                <Icon name="chevron-back" size={22} color={C.purple} />
              </Pressable>
              <Text style={S.h3}>{calendarTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => setCalendarMonth(current => moveDoctorVisitMonth(current, 1))}
                style={{ padding: 10, borderRadius: 16, backgroundColor: themeBackground("#EFE5F7") }}
              >
                <Icon name="chevron-forward" size={22} color={C.purple} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {weekdayNames.map(name => (
                <View key={name} style={{ width: "14.285%", alignItems: "center", paddingVertical: 6 }}>
                  <Text style={[S.small, { fontSize: 11 }]}>{name}</Text>
                </View>
              ))}
              {calendarDays.map((day, index) => {
                const value = day === null ? "" : formatDoctorVisitDate(
                  calendarMonth.getFullYear(), calendarMonth.getMonth(), day,
                );
                const selected = day !== null && value === date;
                const isToday = day !== null &&
                  calendarMonth.getFullYear() === today.getFullYear() &&
                  calendarMonth.getMonth() === today.getMonth() &&
                  day === today.getDate();
                return (
                  <View key={index} style={{ width: "14.285%", padding: 2 }}>
                    {day !== null ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={"Select " + new Date(
                          calendarMonth.getFullYear(), calendarMonth.getMonth(), day, 12,
                        ).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        accessibilityState={{ selected }}
                        onPress={() => { onDateChange(value); setPanel(null); }}
                        style={{
                          minHeight: 39, borderRadius: 13, alignItems: "center", justifyContent: "center",
                          borderWidth: isToday && !selected ? 1 : 0,
                          borderColor: themeBorder("#A879BE"),
                          backgroundColor: selected ? C.purple : themeBackground("#FFFFFF"),
                        }}
                      >
                        <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13,
                          color: selected ? "#FFFFFF" : themeForeground("#271A3B") }}>{day}</Text>
                      </Pressable>
                    ) : <View style={{ minHeight: 39 }} />}
                  </View>
                );
              })}
            </View>
            <Button
              secondary
              title="Jump to today"
              onPress={() => {
                const now = new Date();
                onDateChange(formatDoctorVisitDate(now.getFullYear(), now.getMonth(), now.getDate()));
                setPanel(null);
              }}
            />
          </Card>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[S.h3, { fontSize: 13 }]}>Visit time</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Choose visit time, currently " + doctorVisitTimeLabel(time)}
          accessibilityHint="Opens hour and minute selectors to choose an exact time."
          accessibilityState={{ expanded: panel === "time", disabled }}
          onPress={toggleTime}
          disabled={disabled}
          style={inputStyle}
        >
          <Icon name="time-outline" color={C.purple} size={23} />
          <View style={{ flex: 1 }}>
            <Text style={[S.body, { color: themeForeground("#21183A") }]}>
              {doctorVisitTimeLabel(time)}
            </Text>
            {parseDoctorVisitTime(time) && <Txt style={S.small}>{time} · 24-hour time</Txt>}
          </View>
          <Icon name={panel === "time" ? "chevron-up-outline" : "chevron-down-outline"} color={C.purple} />
        </Pressable>
        {panel === "time" && (
          <Card style={{ gap: 12, backgroundColor: themeBackground("#FAF6FD") }}>
            <Text style={S.h3}>Choose your appointment time</Text>
            <Txt style={S.small}>Select an hour and the exact minute. Your choice uses the device's local time.</Txt>
            <View style={{ padding: 13, backgroundColor: themeBackground("#EEE2F7"), borderRadius: 15, alignItems: "center" }}>
              <Text style={[S.h2, { color: themeForeground(C.purple) }]}>
                {doctorVisitTimeLabel(formatDoctorVisitTime(draftHour, draftMinute))}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[S.h3, { fontSize: 13 }]}>Hour (00–23)</Text>
                <ScrollView nestedScrollEnabled style={{ height: 226 }} contentContainerStyle={{ gap: 5 }}>
                  {hours.map(hour => {
                    const active = draftHour === hour;
                    return (
                      <Pressable
                        key={hour}
                        accessibilityRole="button"
                        accessibilityLabel={"Choose hour " + String(hour).padStart(2, "0")}
                        accessibilityState={{ selected: active }}
                        onPress={() => setDraftHour(hour)}
                        style={{
                          alignItems: "center", paddingVertical: 11, borderRadius: 12,
                          backgroundColor: active ? C.purple : themeBackground("#FFFFFF"),
                        }}
                      >
                        <Text style={{ color: active ? "#FFFFFF" : themeForeground("#21183A"),
                          fontFamily: "DMSans_600SemiBold" }}>
                          {String(hour).padStart(2, "0")} {hour < 12 ? "AM" : "PM"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[S.h3, { fontSize: 13 }]}>Minute (00–59)</Text>
                <ScrollView nestedScrollEnabled style={{ height: 226 }} contentContainerStyle={{ gap: 5 }}>
                  {minutes.map(minute => {
                    const active = draftMinute === minute;
                    return (
                      <Pressable
                        key={minute}
                        accessibilityRole="button"
                        accessibilityLabel={"Choose minute " + String(minute).padStart(2, "0")}
                        accessibilityState={{ selected: active }}
                        onPress={() => setDraftMinute(minute)}
                        style={{
                          alignItems: "center", paddingVertical: 11, borderRadius: 12,
                          backgroundColor: active ? C.purple : themeBackground("#FFFFFF"),
                        }}
                      >
                        <Text style={{ color: active ? "#FFFFFF" : themeForeground("#21183A"),
                          fontFamily: "DMSans_600SemiBold" }}>
                          {String(minute).padStart(2, "0")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <Button
              title="Use this time"
              onPress={() => {
                onTimeChange(formatDoctorVisitTime(draftHour, draftMinute));
                setPanel(null);
              }}
            />
            <Button title="Cancel" secondary onPress={() => setPanel(null)} />
          </Card>
        )}
      </View>
    </View>
  );
}
