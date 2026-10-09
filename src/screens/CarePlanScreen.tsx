import { themeForeground } from "../themeColors";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import {
  archiveCarePlanItem,
  createCarePlanItem,
  loadCarePlan,
  setCarePlanCompletion,
  updateCarePlanItem,
  type CarePlanCategory,
  type CarePlanCompletion,
  type CarePlanItem,
  type CarePlanPriority,
} from "../carePlan";
import {
  carePlanCompletionForItemToday,
  carePlanItemIsForToday,
  carePlanLocalDateKey,
  carePlanTodaySummary,
  carePlanWeekdayLabels,
} from "../carePlanHelpers";
import { notificationTimezone } from "../notificationPreferences";
import { supabase } from "../supabase";
import { useCare } from "../store";
import { Button, C, Card, Field, Icon, Page, S, Txt } from "../ui";
import { useNav } from "./MainScreens";

const INK = "#11113D";
const MUTED = "#74718A";
const PURPLE = "#74328F";
const DEEP_PURPLE = "#542267";
const LAVENDER = "#F3ECF9";
const LINE = "#EAE2EE";

const categories: Array<{
  value: CarePlanCategory;
  label: string;
  icon: string;
}> = [
  { value: "medication", label: "Medication", icon: "medical-outline" },
  { value: "meal", label: "Meals", icon: "restaurant-outline" },
  { value: "mobility", label: "Mobility", icon: "walk-outline" },
  { value: "hygiene", label: "Hygiene", icon: "water-outline" },
  { value: "monitoring", label: "Monitoring", icon: "pulse-outline" },
  { value: "appointment", label: "Appointment", icon: "calendar-outline" },
  { value: "comfort", label: "Comfort", icon: "heart-outline" },
  { value: "other", label: "Other", icon: "list-outline" },
];

function categoryMeta(category: CarePlanCategory) {
  return categories.find((item) => item.value === category) ?? categories[7];
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function Entrance({
  children,
  delay = 0,
  reducedMotion,
}: {
  children: React.ReactNode;
  delay?: number;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: 390,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [delay, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ChecklistGraphic() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 260 215"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="planBoard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F9F2FF" />
          <Stop offset="0.48" stopColor="#C995F2" />
          <Stop offset="1" stopColor="#7B3AAF" />
        </LinearGradient>
        <LinearGradient id="planPaper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#F3E8FC" />
        </LinearGradient>
        <LinearGradient id="planGlass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.08} />
        </LinearGradient>
        <LinearGradient id="planClip" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E3C5FA" />
          <Stop offset="1" stopColor="#6D2AA2" />
        </LinearGradient>
      </Defs>

      <Circle cx="143" cy="104" r="92" fill="#F6EEFC" />
      <Circle cx="210" cy="58" r="44" fill="#E8D5F8" opacity={0.7} />
      <Ellipse cx="139" cy="193" rx="74" ry="12" fill="#6F2D9C" opacity={0.13} />

      <G transform="translate(49 16) rotate(5 83 91)">
        <Rect
          x="4"
          y="8"
          width="162"
          height="177"
          rx="28"
          fill="#6D2D9B"
          opacity={0.15}
        />
        <Rect
          x="0"
          y="0"
          width="162"
          height="177"
          rx="28"
          fill="url(#planBoard)"
          stroke="#D9BAF3"
          strokeWidth="2"
        />
        <Rect
          x="17"
          y="26"
          width="128"
          height="136"
          rx="21"
          fill="url(#planPaper)"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        <Path
          d="M18 30C54 11 104 12 145 35V72C101 45 54 48 18 64Z"
          fill="url(#planGlass)"
          opacity={0.58}
        />

        {[58, 91, 124].map((y, index) => (
          <G key={y}>
            <Rect
              x="34"
              y={y}
              width="21"
              height="21"
              rx="7"
              fill={index === 2 ? "#F0E7F7" : "#8A48BC"}
              stroke={index === 2 ? "#C7AED9" : "#8A48BC"}
              strokeWidth="1.5"
            />
            {index !== 2 && (
              <Path
                d={`M${39} ${y + 10}l4 4 8-9`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <Rect
              x="66"
              y={y + 2}
              width={index === 1 ? 54 : 61}
              height="6"
              rx="3"
              fill="#76508F"
              opacity={0.72}
            />
            <Rect
              x="66"
              y={y + 13}
              width={index === 0 ? 45 : 37}
              height="5"
              rx="2.5"
              fill="#C9B3D8"
            />
          </G>
        ))}

        <G transform="translate(48 -9)">
          <Rect
            x="0"
            y="0"
            width="67"
            height="31"
            rx="15.5"
            fill="url(#planClip)"
            stroke="#EEDFFF"
            strokeWidth="2"
          />
          <Rect x="20" y="7" width="27" height="7" rx="3.5" fill="#FFFFFF" opacity={0.58} />
        </G>
      </G>
    </Svg>
  );
}

function FloatingChecklist({ reducedMotion }: { reducedMotion: boolean }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [float, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: 214,
        height: 184,
        transform: [
          {
            translateY: float.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -8],
            }),
          },
          {
            rotate: float.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "1deg"],
            }),
          },
        ],
      }}
    >
      <ChecklistGraphic />
    </Animated.View>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.58 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Icon name="chevron-back-outline" size={28} color={themeForeground(INK)} />
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: "Lora_500Medium",
          fontSize: 24,
          lineHeight: 31,
          letterSpacing: -0.5,
          color: themeForeground(INK),
        }}
      >
        Daily care plan
      </Text>
      <View style={{ width: 46, height: 46 }} />
    </View>
  );
}

function SectionHeading({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          fontFamily: "Lora_500Medium",
          fontSize: 25,
          lineHeight: 32,
          letterSpacing: -0.5,
          color: themeForeground(INK),
        }}
      >
        {title}
      </Text>
      {meta ? (
        <Text
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 12,
            color: themeForeground(PURPLE),
            paddingBottom: 4,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function Metric({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 74, gap: 4 }}>
      <Text
        style={{
          fontFamily: "Lora_600SemiBold",
          fontSize: 31,
          lineHeight: 37,
          color: "#FFFFFF",
          letterSpacing: -0.7,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_500Medium",
          fontSize: 11,
          lineHeight: 16,
          color: "rgba(255,255,255,0.78)",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Shortcut({
  icon,
  title,
  onPress,
}: {
  icon: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 142,
        minHeight: 74,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: LINE,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        shadowColor: "#3B2149",
        shadowOpacity: 0.04,
        shadowRadius: 13,
        shadowOffset: { width: 0, height: 6 },
        elevation: 1,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          width: 39,
          height: 39,
          borderRadius: 15,
          backgroundColor: LAVENDER,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} color={themeForeground(PURPLE)} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 14,
            color: themeForeground(INK),
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 11,
            color: themeForeground(MUTED),
          }}
        >
          Open
        </Text>
      </View>
      <Icon name="chevron-forward-outline" size={17} color="#A899B3" />
    </Pressable>
  );
}

export function CarePlanScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";
  const reducedMotion = useReducedMotionPreference();

  const [items, setItems] = useState<CarePlanItem[]>([]);
  const [completions, setCompletions] = useState<CarePlanCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CarePlanCategory>("other");
  const [details, setDetails] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [timezone, setTimezone] = useState(() => notificationTimezone());
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [priority, setPriority] = useState<CarePlanPriority>("routine");

  const resetDraft = useCallback(() => {
    setTitle("");
    setCategory("other");
    setDetails("");
    setLocalTime("");
    setTimezone(notificationTimezone());
    setDays([1, 2, 3, 4, 5, 6, 7]);
    setPriority("routine");
    setEditingItemId(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setItems([]);
      setCompletions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadCarePlan(careRecipientId);
      setItems(result.items);
      setCompletions(result.completions);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the daily care plan.",
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
      .channel(`care-plan:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_plan_items",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_plan_completions",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const today = useMemo(
    () => items.filter((item) => carePlanItemIsForToday(item)),
    [items],
  );
  const summary = useMemo(
    () => carePlanTodaySummary(items, completions),
    [completions, items],
  );

  function openCreate() {
    if (readOnly) return;
    resetDraft();
    setAdding(true);
    setMessage("");
  }

  function startEdit(item: CarePlanItem) {
    if (readOnly) return;
    setTitle(item.title);
    setCategory(item.category);
    setDetails(item.details);
    setLocalTime(item.localTime);
    setTimezone(item.timezone);
    setDays([...item.daysOfWeek]);
    setPriority(item.priority);
    setEditingItemId(item.id);
    setAdding(true);
    setMessage("");
  }

  function closeEditor() {
    setAdding(false);
    resetDraft();
  }

  async function saveRoutine() {
    if (!careRecipientId || readOnly) return;
    const busyKey = editingItemId ? `edit-${editingItemId}` : "new";
    setBusyId(busyKey);
    setMessage("");

    try {
      if (editingItemId) {
        await updateCarePlanItem({
          careRecipientId,
          itemId: editingItemId,
          title,
          category,
          details,
          localTime,
          timezone,
          daysOfWeek: days,
          priority,
        });
      } else {
        await createCarePlanItem({
          careRecipientId,
          title,
          category,
          details,
          localTime,
          timezone,
          daysOfWeek: days,
          priority,
        });
      }

      const wasEditing = Boolean(editingItemId);
      closeEditor();
      await refresh();
      setMessage(
        wasEditing
          ? "Care routine updated."
          : "Care routine added to the shared plan.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this care routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCompletion(item: CarePlanItem) {
    if (!careRecipientId || readOnly) return;
    const completion = carePlanCompletionForItemToday(item, completions);
    setBusyId(item.id);
    setMessage("");

    try {
      await setCarePlanCompletion({
        careRecipientId,
        itemId: item.id,
        completedOn: carePlanLocalDateKey(new Date(), item.timezone),
        completed: !completion,
      });
      await refresh();
      setMessage(
        completion
          ? item.title + " returned to today’s plan."
          : item.title + " marked complete for today.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this care routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function archive(item: CarePlanItem) {
    if (!careRecipientId || readOnly) return;
    setBusyId("archive-" + item.id);
    setMessage("");

    try {
      await archiveCarePlanItem(careRecipientId, item.id);
      if (editingItemId === item.id) closeEditor();
      await refresh();
      setMessage(item.title + " archived from the active care plan.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not archive this routine.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <TopBar onBack={() => n.goBack()} />
        <Card
          style={{
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            paddingVertical: 30,
          }}
        >
          <Icon name="people-outline" size={30} color={themeForeground(PURPLE)} />
          <Text
            style={{
              fontFamily: "Lora_500Medium",
              fontSize: 23,
              color: themeForeground(INK),
              textAlign: "center",
            }}
          >
            Choose a care profile first.
          </Text>
          <Txt style={{ textAlign: "center" }}>
            Daily routines belong to one shared care profile.
          </Txt>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TopBar onBack={() => n.goBack()} />

      <Entrance reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 286,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            paddingTop: 4,
          }}
        >
          <FloatingChecklist reducedMotion={reducedMotion} />
          <Text
            style={{
              fontFamily: "Lora_600SemiBold",
              fontSize: 34,
              lineHeight: 41,
              letterSpacing: -0.9,
              color: themeForeground(INK),
              textAlign: "center",
              marginTop: -10,
            }}
          >
            A little structure. A smoother day.
          </Text>
          <Text
            style={{
              marginTop: 8,
              maxWidth: 315,
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              lineHeight: 21,
              color: themeForeground(MUTED),
              textAlign: "center",
            }}
          >
            One shared plan for everyday care.
          </Text>
        </View>
      </Entrance>

      <Entrance delay={70} reducedMotion={reducedMotion}>
        <View
          style={{
            borderRadius: 29,
            overflow: "hidden",
            backgroundColor: DEEP_PURPLE,
            shadowColor: "#4C235E",
            shadowOpacity: 0.18,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 11 },
            elevation: 5,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -70,
              right: -45,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: "rgba(255,255,255,0.09)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -95,
              left: -48,
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: "rgba(222,190,249,0.11)",
            }}
          />
          <View style={{ padding: 22, gap: 20 }}>
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "rgba(255,255,255,0.72)",
                  textTransform: "uppercase",
                }}
              >
                Today’s plan
              </Text>
              <Text
                style={{
                  fontFamily: "Lora_500Medium",
                  fontSize: 23,
                  lineHeight: 30,
                  color: "#FFFFFF",
                }}
              >
                Everyday care, in one place.
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 16,
                justifyContent: "space-between",
              }}
            >
              <Metric value={summary.total} label="Planned" />
              <Metric value={summary.completed} label="Done" />
              <Metric value={summary.remaining} label="Remaining" />
            </View>
          </View>
        </View>
      </Entrance>

      <Entrance delay={120} reducedMotion={reducedMotion}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Shortcut
            icon="medical-outline"
            title="Medications"
            onPress={() => n.navigate("Medications")}
          />
          <Shortcut
            icon="calendar-outline"
            title="Appointment prep"
            onPress={() => n.navigate("Appointments")}
          />
        </View>
      </Entrance>

      {readOnly ? (
        <Card style={{ backgroundColor: "#FBF7FD", borderColor: "#E8DAEF" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="eye-outline" size={20} color={themeForeground(PURPLE)} />
            <Text style={[S.h3, { flex: 1 }]}>Read-only care plan</Text>
          </View>
          <Txt>
            You can review routines and completion status. Changes are limited
            by your care-profile permissions.
          </Txt>
        </Card>
      ) : null}

      {Boolean(message) ? (
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#E4D7EA",
            backgroundColor: "#FCF9FE",
            paddingHorizontal: 16,
            paddingVertical: 13,
          }}
        >
          <Text accessibilityRole="alert" style={[S.body, { color: themeForeground(INK) }]}>
            {message}
          </Text>
        </View>
      ) : null}

      <Entrance delay={165} reducedMotion={reducedMotion}>
        <View style={{ gap: 13 }}>
          <SectionHeading
            title="Today’s care"
            meta={`${today.length} ${today.length === 1 ? "routine" : "routines"}`}
          />

          {loading ? (
            <Card style={{ alignItems: "center", paddingVertical: 28 }}>
              <ActivityIndicator color={themeForeground(PURPLE)} />
              <Txt>Loading today’s care…</Txt>
            </Card>
          ) : !today.length ? (
            <View
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: LINE,
                backgroundColor: "#FFFFFF",
                padding: 22,
                alignItems: "center",
                gap: 9,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 17,
                  backgroundColor: LAVENDER,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="checkmark-done-outline" size={23} color={themeForeground(PURPLE)} />
              </View>
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 16,
                  color: themeForeground(INK),
                  textAlign: "center",
                }}
              >
                Nothing scheduled for today
              </Text>
              <Txt style={{ textAlign: "center" }}>
                Add a routine for everyday care or selected weekdays.
              </Txt>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {today.map((item) => {
                const completion = carePlanCompletionForItemToday(
                  item,
                  completions,
                );
                const meta = categoryMeta(item.category);
                return (
                  <View
                    key={item.id}
                    style={{
                      borderRadius: 23,
                      borderWidth: 1,
                      borderColor: completion
                        ? "#D8E8DF"
                        : item.priority === "important"
                          ? "#E8D3C2"
                          : LINE,
                      backgroundColor: completion ? "#F8FCFA" : "#FFFFFF",
                      padding: 17,
                      gap: 13,
                      shadowColor: "#3B2149",
                      shadowOpacity: 0.035,
                      shadowRadius: 13,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 43,
                          height: 43,
                          borderRadius: 16,
                          backgroundColor: completion ? "#E8F4ED" : LAVENDER,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={meta.icon}
                          size={20}
                          color={completion ? C.green : PURPLE}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text
                          style={{
                            fontFamily: "DMSans_600SemiBold",
                            fontSize: 16,
                            lineHeight: 21,
                            color: themeForeground(INK),
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "DMSans_400Regular",
                            fontSize: 12,
                            lineHeight: 18,
                            color: themeForeground(MUTED),
                          }}
                        >
                          {meta.label}
                          {item.localTime ? ` · ${item.localTime}` : " · Any time"}
                          {item.priority === "important" ? " · Important" : ""}
                        </Text>
                      </View>
                      <Icon
                        name={completion ? "checkmark-circle" : "ellipse-outline"}
                        size={27}
                        color={completion ? C.green : "#B9AFC0"}
                      />
                    </View>

                    {item.details ? (
                      <Text
                        style={{
                          fontFamily: "DMSans_400Regular",
                          fontSize: 13,
                          lineHeight: 20,
                          color: themeForeground(MUTED),
                        }}
                      >
                        {item.details}
                      </Text>
                    ) : null}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        completion
                          ? `Mark ${item.title} as not completed`
                          : `Mark ${item.title} complete`
                      }
                      disabled={readOnly || busyId !== null}
                      onPress={() => void toggleCompletion(item)}
                      style={({ pressed }) => ({
                        minHeight: 46,
                        borderRadius: 23,
                        backgroundColor: completion ? "#EEF7F2" : LAVENDER,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                        opacity:
                          readOnly || busyId !== null
                            ? 0.45
                            : pressed
                              ? 0.72
                              : 1,
                      })}
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator color={themeForeground(PURPLE)} />
                      ) : (
                        <>
                          <Icon
                            name={
                              completion
                                ? "arrow-undo-outline"
                                : "checkmark-outline"
                            }
                            size={18}
                            color={completion ? C.green : PURPLE}
                          />
                          <Text
                            style={{
                              fontFamily: "DMSans_600SemiBold",
                              fontSize: 13,
                              color: completion ? C.green : PURPLE,
                            }}
                          >
                            {completion ? "Mark not done" : "Mark done"}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {!readOnly ? (
            <Button
              title={adding && !editingItemId ? "Close new routine" : "Add care routine"}
              secondary={adding && !editingItemId}
              icon={adding && !editingItemId ? "close-outline" : "add-outline"}
              disabled={busyId !== null}
              onPress={() => {
                if (adding && !editingItemId) closeEditor();
                else openCreate();
              }}
            />
          ) : null}
        </View>
      </Entrance>

      {adding ? (
        <Entrance reducedMotion={reducedMotion}>
          <View
            style={{
              borderRadius: 27,
              borderWidth: 1,
              borderColor: "#E6D9EB",
              backgroundColor: "#FBF8FD",
              padding: 18,
              gap: 15,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.eyebrow}>
                  {editingItemId ? "Edit routine" : "New routine"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Lora_500Medium",
                    fontSize: 22,
                    color: themeForeground(INK),
                  }}
                >
                  {editingItemId ? "Update shared care" : "Add to the day"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close routine editor"
                onPress={closeEditor}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="close-outline" size={23} color={themeForeground(INK)} />
              </Pressable>
            </View>

            <Field label="Routine title" value={title} onChange={setTitle} />
            <Field
              label="Care instructions or notes"
              value={details}
              onChange={setDetails}
              multiline
            />
            <Field
              label="Time (HH:MM, optional)"
              value={localTime}
              onChange={(value) => setLocalTime(value.slice(0, 5))}
            />

            <View style={{ gap: 9 }}>
              <Text style={S.h3}>Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {categories.map((item) => {
                  const selected = category === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setCategory(item.value)}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? PURPLE : "#E2D8E6",
                        backgroundColor: selected ? PURPLE : "#FFFFFF",
                        paddingHorizontal: 13,
                        paddingVertical: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icon
                        name={item.icon}
                        size={15}
                        color={selected ? "#FFFFFF" : PURPLE}
                      />
                      <Text
                        style={{
                          fontFamily: "DMSans_500Medium",
                          fontSize: 12,
                          color: selected ? "#FFFFFF" : INK,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 9 }}>
              <Text style={S.h3}>Days</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {carePlanWeekdayLabels.map((day) => {
                  const selected = days.includes(day.iso);
                  return (
                    <Pressable
                      key={day.iso}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setDays((current) =>
                          selected
                            ? current.filter((value) => value !== day.iso)
                            : [...current, day.iso].sort((a, b) => a - b),
                        )
                      }
                      style={{
                        minWidth: 42,
                        height: 38,
                        borderRadius: 19,
                        borderWidth: 1,
                        borderColor: selected ? PURPLE : "#E2D8E6",
                        backgroundColor: selected ? PURPLE : "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 9,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "DMSans_600SemiBold",
                          fontSize: 11,
                          color: selected ? "#FFFFFF" : MUTED,
                        }}
                      >
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 9 }}>
              <Text style={S.h3}>Priority</Text>
              <View style={{ flexDirection: "row", gap: 9 }}>
                {(["routine", "important"] as CarePlanPriority[]).map((value) => {
                  const selected = priority === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setPriority(value)}
                      style={{
                        flex: 1,
                        minHeight: 46,
                        borderRadius: 23,
                        borderWidth: 1,
                        borderColor: selected ? PURPLE : "#E2D8E6",
                        backgroundColor: selected ? LAVENDER : "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "DMSans_600SemiBold",
                          fontSize: 13,
                          color: selected ? PURPLE : MUTED,
                        }}
                      >
                        {value === "routine" ? "Routine" : "Important"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              title={
                busyId?.startsWith("edit-")
                  ? "Saving changes…"
                  : busyId === "new"
                    ? "Adding routine…"
                    : editingItemId
                      ? "Save changes"
                      : "Add to care plan"
              }
              disabled={
                readOnly ||
                busyId !== null ||
                !title.trim() ||
                !days.length
              }
              onPress={() => void saveRoutine()}
            />
          </View>
        </Entrance>
      ) : null}

      <Entrance delay={210} reducedMotion={reducedMotion}>
        <View style={{ gap: 13 }}>
          <SectionHeading
            title="Active plan library"
            meta={`${items.length} active`}
          />

          {loading ? null : !items.length ? (
            <View
              style={{
                borderRadius: 23,
                borderWidth: 1,
                borderColor: LINE,
                backgroundColor: "#FFFFFF",
                padding: 20,
                gap: 6,
              }}
            >
              <Text style={S.h3}>No active routines yet</Text>
              <Txt>
                Add the recurring care your household wants visible in the shared plan.
              </Txt>
            </View>
          ) : (
            <View style={{ gap: 9 }}>
              {items.map((item) => {
                const meta = categoryMeta(item.category);
                return (
                  <View
                    key={item.id}
                    style={{
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: LINE,
                      backgroundColor: "#FFFFFF",
                      padding: 16,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 11,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 15,
                          backgroundColor: LAVENDER,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name={meta.icon} size={19} color={themeForeground(PURPLE)} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text
                          style={{
                            fontFamily: "DMSans_600SemiBold",
                            fontSize: 15,
                            lineHeight: 20,
                            color: themeForeground(INK),
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "DMSans_400Regular",
                            fontSize: 11,
                            lineHeight: 17,
                            color: themeForeground(MUTED),
                          }}
                        >
                          {meta.label} ·{" "}
                          {item.daysOfWeek
                            .map(
                              (iso) =>
                                carePlanWeekdayLabels.find(
                                  (day) => day.iso === iso,
                                )?.label ?? iso,
                            )
                            .join(", ")}
                          {item.localTime ? " · " + item.localTime : ""}
                        </Text>
                      </View>
                      <Icon name="repeat-outline" size={20} color="#AA9BB3" />
                    </View>

                    {!readOnly ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${item.title}`}
                          disabled={busyId !== null}
                          onPress={() => startEdit(item)}
                          style={({ pressed }) => ({
                            flex: 1,
                            minHeight: 42,
                            borderRadius: 21,
                            backgroundColor: LAVENDER,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 7,
                            opacity:
                              busyId !== null ? 0.45 : pressed ? 0.72 : 1,
                          })}
                        >
                          <Icon name="create-outline" size={17} color={themeForeground(PURPLE)} />
                          <Text
                            style={{
                              fontFamily: "DMSans_600SemiBold",
                              fontSize: 12,
                              color: themeForeground(PURPLE),
                            }}
                          >
                            Edit
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Archive ${item.title}`}
                          disabled={busyId !== null}
                          onPress={() => void archive(item)}
                          style={({ pressed }) => ({
                            flex: 1,
                            minHeight: 42,
                            borderRadius: 21,
                            borderWidth: 1,
                            borderColor: "#E4D9E8",
                            backgroundColor: "#FFFFFF",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 7,
                            opacity:
                              busyId !== null ? 0.45 : pressed ? 0.72 : 1,
                          })}
                        >
                          {busyId === "archive-" + item.id ? (
                            <ActivityIndicator color={themeForeground(PURPLE)} />
                          ) : (
                            <>
                              <Icon
                                name="archive-outline"
                                size={17}
                                color={themeForeground(MUTED)}
                              />
                              <Text
                                style={{
                                  fontFamily: "DMSans_600SemiBold",
                                  fontSize: 12,
                                  color: themeForeground(MUTED),
                                }}
                              >
                                Archive
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Entrance>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#EEE7F1",
          paddingTop: 18,
          paddingBottom: 3,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Icon name="information-circle-outline" size={18} color="#9D8EA7" />
        <Text
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 11,
            lineHeight: 17,
            color: themeForeground("#817789"),
          }}
        >
          Follow the healthcare team’s instructions. This shared plan organizes
          everyday care; it does not replace clinical guidance.
        </Text>
      </View>
    </Page>
  );
}
