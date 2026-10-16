import { themeForeground } from "../themeColors";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import { useAppearance } from "../appearance";
import { supabase } from "../supabase";
import { ClinicalGlassArtwork } from "../components/ClinicalGlassArtwork";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import {
  approveClinicalContent,
  loadClinicalContentItem,
  loadClinicalContentVersions,
  loadManagedClinicalContent,
  publishClinicalContent,
  returnClinicalContentToDraft,
  saveClinicalContent,
  submitClinicalContentForReview,
  type ClinicalContentRecord,
  type ClinicalContentVersion,
  type ClinicalSection,
  type ClinicalStatus,
} from "../clinicalContent";
import type { StaffRole } from "../staff";
import {
  Button,
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
} from "../ui";
import { useNav } from "./MainScreens";

function statusLabel(status: ClinicalStatus) {
  return {
    draft: "Draft",
    clinical_review: "Clinical review",
    approved: "Approved",
    published: "Published",
  }[status];
}

function StatusPill({ status }: { status: ClinicalStatus }) {
  const published = status === "published";
  const approved = status === "approved";
  return (
    <View
      style={[
        S.pill,
        {
          backgroundColor: published || approved ? "#E8F1ED" : C.lavender,
          alignSelf: "flex-start",
        },
      ]}
    >
      <Text
        style={[
          S.small,
          {
            fontFamily: "DMSans_600SemiBold",
            color: published || approved ? C.green : C.deep,
          },
        ]}
      >
        {statusLabel(status)}
      </Text>
    </View>
  );
}


type ContentFilter = "all" | ClinicalStatus;

function statusStyle(status: ClinicalStatus, dark: boolean) {
  switch (status) {
    case "published":
      return {
        background: dark ? "#204B3F" : "#E4F6ED",
        color: dark ? "#9BE5C3" : "#207957",
        icon: "checkmark-circle-outline",
      };
    case "approved":
      return {
        background: dark ? "#22413D" : "#E7F4F1",
        color: dark ? "#A3E4CE" : "#237866",
        icon: "shield-checkmark-outline",
      };
    case "clinical_review":
      return {
        background: dark ? "#51402E" : "#FFF3E3",
        color: dark ? "#F8CA8E" : "#99651D",
        icon: "time-outline",
      };
    default:
      return {
        background: dark ? "#463452" : "#F3EAF9",
        color: dark ? "#DFC0F8" : "#72318E",
        icon: "document-text-outline",
      };
  }
}

function GlassStage({
  name, value, icon, selected, dark, onPress,
}: {
  name: string;
  value: number;
  icon: string;
  selected: boolean;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name + ": " + value + " records"}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48.4%",
        minHeight: 115,
        padding: 14,
        gap: 10,
        borderRadius: 21,
        borderWidth: selected ? 1.7 : 1,
        borderColor: selected ? (dark ? "#C79DE6" : "#B96BDD") : (dark ? "#554467" : "#F1E5F6"),
        backgroundColor: dark ? "#302640" : "#FFFFFFD9",
        opacity: pressed ? 0.8 : 1,
        shadowColor: dark ? "#000000" : "#9866AE",
        shadowOpacity: dark ? 0 : 0.055,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 3 },
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{
          width: 31, height: 31, borderRadius: 11,
          alignItems: "center", justifyContent: "center",
          backgroundColor: dark ? "#59416D" : "#F5E9FB",
        }}>
          <Icon name={icon} size={18} color={dark ? "#DCC0F6" : "#8636B4"} />
        </View>
        {selected && <Icon name="checkmark-circle" size={16} color={dark ? "#DCC0F6" : "#8139A5"} />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 5 }}>
        <Text style={{
          fontFamily: "DMSans_700Bold", fontSize: 30, lineHeight: 34,
          color: dark ? "#F8F1FF" : "#17133D",
        }}>{value}</Text>
        <Text style={{
          flexShrink: 1, fontFamily: "DMSans_600SemiBold", fontSize: 11.5,
          color: dark ? "#D2C1DF" : "#756985",
        }}>{name}</Text>
      </View>
    </Pressable>
  );
}

function GlassContentCard({
  item, dark, onPress,
}: {
  item: ClinicalContentRecord;
  dark: boolean;
  onPress: () => void;
}) {
  const status = statusStyle(item.status, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Open " + item.title + ", " + statusLabel(item.status)}
      accessibilityHint={"Review clinical education and version history"}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: dark ? "#4D405D" : "#EDE4F2",
        backgroundColor: dark ? "#292139" : "#FFFFFFEF",
        borderRadius: 24,
        padding: 17,
        gap: 13,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.989 : 1 }],
        shadowColor: dark ? "#000000" : "#77528F",
        shadowOpacity: dark ? 0 : 0.065,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 47, height: 47, borderRadius: 16,
          backgroundColor: dark ? "#4A335F" : "#F4E8FA",
          justifyContent: "center", alignItems: "center",
        }}>
          <Icon name={item.icon || "book-outline"} size={24} color={dark ? "#D8B9F5" : "#8235A6"} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text numberOfLines={1} style={{
            fontFamily: "DMSans_700Bold", fontSize: 10.5,
            letterSpacing: 1.6, textTransform: "uppercase",
            color: dark ? "#CDA8EA" : "#82429E",
          }}>{item.category}</Text>
          <Text style={{
            fontFamily: "DMSans_700Bold", fontSize: 16.5, lineHeight: 23,
            color: dark ? "#F7F0FF" : "#18133E",
          }}>{item.title}</Text>
        </View>
        <Icon name="chevron-forward" size={19} color={dark ? "#C2A8D8" : "#A38BB4"} />
      </View>
      {Boolean(item.description) && (
        <Text numberOfLines={2} style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 13.2, lineHeight: 20, color: dark ? "#C8B9DA" : "#777087",
        }}>{item.description}</Text>
      )}
      <View style={{
        height: 1, backgroundColor: dark ? "#433650" : "#F1EBF3",
      }} />
      <View style={{
        flexDirection: "row", flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between", gap: 9,
      }}>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: status.background, paddingHorizontal: 10,
          paddingVertical: 7, borderRadius: 999,
        }}>
          <Icon name={status.icon} size={14} color={status.color} />
          <Text style={{
            fontFamily: "DMSans_600SemiBold", fontSize: 11.5,
            color: status.color,
          }}>{statusLabel(item.status)}</Text>
        </View>
        <Text style={{
          fontFamily: "DMSans_400Regular", fontSize: 11,
          color: dark ? "#BCAAca" : "#858097",
        }}>
          v{item.version} · Updated {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}

export function StaffClinicalContentScreen() {
  const n = useNav();
  const { dark } = useAppearance();
  const [items, setItems] = useState<ClinicalContentRecord[]>([]);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setMessage("");
    try {
      const result = await loadManagedClinicalContent();
      setRole(result.role);
      setItems(result.items);
      setUpdatedAt(new Date());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not load clinical content.",
      );
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  // Reload on every return from the versioned editor (including after publishing).
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  // RLS still controls which database changes reach this role.
  // If realtime is unavailable, the timestamp and manual refresh remain honest.
  useFocusEffect(useCallback(() => {
    if (!role) return;
    let active = true;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = () => {
      if (queued) clearTimeout(queued);
      queued = setTimeout(() => {
        if (active) void refresh();
      }, 500);
    };
    const channel = supabase.channel("staff-clinical-content-updates")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "clinical_content",
      }, queueRefresh)
      .subscribe((status) => {
        if (active) setConnected(status === "SUBSCRIBED");
      });
    return () => {
      active = false;
      if (queued) clearTimeout(queued);
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [role, refresh]));

  const counts = {
    draft: items.filter((item) => item.status === "draft").length,
    clinical_review: items.filter((item) => item.status === "clinical_review").length,
    approved: items.filter((item) => item.status === "approved").length,
    published: items.filter((item) => item.status === "published").length,
  };
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visible = items
    .filter((item) => filter === "all" || item.status === filter)
    .filter((item) =>
      !normalizedSearch ||
      [item.title, item.category, item.description].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      ),
    )
    .sort((a, b) =>
      (newestFirst ? -1 : 1) *
      (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    );
  const ink = dark ? "#F5F0FF" : "#17133D";
  const muted = dark ? "#C8B8D8" : "#777189";
  const panel = dark ? "#261E35" : "#FCF8FF";
  const stroke = dark ? "#524061" : "#EEE5F3";
  const stageFilters: { label: string; key: ContentFilter; value: number; icon: string }[] = [
    { label: "Drafts", key: "draft", value: counts.draft, icon: "document-text-outline" },
    { label: "In review", key: "clinical_review", value: counts.clinical_review, icon: "time-outline" },
    { label: "Approved", key: "approved", value: counts.approved, icon: "shield-checkmark-outline" },
    { label: "Published", key: "published", value: counts.published, icon: "checkmark-circle-outline" },
  ];

  return (
    <Page>
      <View style={{
        backgroundColor: dark ? "#241B34" : "#FFF9FF",
        borderRadius: 29, padding: 20, minHeight: 255,
        overflow: "hidden", position: "relative",
        borderWidth: 1, borderColor: stroke,
      }}>
        <View pointerEvents="none" style={{
          position: "absolute", width: 215, height: 215, borderRadius: 140,
          right: -73, top: -58, backgroundColor: dark ? "#523766" : "#E9D0F8",
          opacity: 0.44,
        }} />
        <View pointerEvents="none" style={{
          position: "absolute", right: -51, top: 37, opacity: 0.62,
        }}>
          <ClinicalGlassArtwork dark={dark} />
        </View>
        <View style={{ maxWidth: 297, gap: 12 }}>
          <Text style={{
            fontFamily: "DMSans_700Bold", fontSize: 10.4,
            letterSpacing: 2.2, color: dark ? "#D8B5EF" : "#8038A6",
          }}>CLINICAL CONTENT GOVERNANCE</Text>
          <Text accessibilityRole="header" style={{
            fontFamily: "DMSans_700Bold", fontSize: 31,
            lineHeight: 37, letterSpacing: -1.15, maxWidth: 275, color: ink,
          }}>Guidance you can trust.</Text>
          <Text style={{
            fontFamily: "DMSans_400Regular", fontSize: 13.4, lineHeight: 21,
            maxWidth: 257, color: muted,
          }}>
            Review, approve and publish educational content with confidence.
          </Text>
        </View>
        <View style={{
          marginTop: 23, alignSelf: "flex-start",
          flexDirection: "row", alignItems: "center", gap: 7,
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          backgroundColor: dark ? "#433252" : "#F0E4F8",
        }}>
          <Icon name="shield-checkmark-outline" size={15} color={dark ? "#D9B9F6" : "#80369F"} />
          <Text style={{
            fontFamily: "DMSans_600SemiBold", color: dark ? "#E7D0FB" : "#703188",
            fontSize: 11.5,
          }}>{role ? role.charAt(0).toUpperCase() + role.slice(1) + " workspace" : "Staff workspace"}</Text>
        </View>
      </View>

      <View style={{
        backgroundColor: panel, borderWidth: 1, borderColor: stroke,
        borderRadius: 28, padding: 15, gap: 15,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ gap: 3 }}>
            <Text accessibilityRole="header" style={{
              fontFamily: "DMSans_700Bold", fontSize: 21, color: ink,
            }}>Content overview</Text>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: 12, color: muted,
            }}>{items.length} governed {items.length === 1 ? "guide" : "guides"} in your library</Text>
          </View>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
            backgroundColor: connected ? (dark ? "#204337" : "#EAF7EF") : (dark ? "#40324B" : "#F1EAF7"),
          }}>
            <Text style={{
              fontSize: 10.8, fontFamily: "DMSans_600SemiBold",
              color: connected ? (dark ? "#9AE2BD" : "#19835E") : muted,
            }}>{connected ? "● Live" : "Manual refresh"}</Text>
          </View>
        </View>
        <View style={{
          flexDirection: "row", flexWrap: "wrap",
          justifyContent: "space-between", rowGap: 10,
        }}>
          {stageFilters.map((stage) => (
            <GlassStage
              key={stage.key}
              name={stage.label}
              value={stage.value}
              icon={stage.icon}
              selected={filter === stage.key}
              dark={dark}
              onPress={() => setFilter((current) => current === stage.key ? "all" : stage.key)}
            />
          ))}
        </View>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 7,
          paddingHorizontal: 2,
        }}>
          <Icon name="git-branch-outline" size={16} color={dark ? "#D3B1EC" : "#8E4AA8"} />
          <Text style={{
            flex: 1, fontSize: 11.7, fontFamily: "DMSans_400Regular",
            lineHeight: 17, color: muted,
          }}>Draft → Clinical review → Approved → Published</Text>
        </View>
        {counts.clinical_review > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show content awaiting clinical review"
            onPress={() => setFilter("clinical_review")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 9,
              padding: 11, borderRadius: 16,
              backgroundColor: dark ? "#493A2D" : "#FFF2E3",
            }}
          >
            <Icon name="time-outline" size={20} color={dark ? "#F6CE9E" : "#A26B27"} />
            <Text style={{
              flex: 1, color: dark ? "#F6CE9E" : "#86551C",
              fontSize: 12.3, fontFamily: "DMSans_600SemiBold",
            }}>{counts.clinical_review} {counts.clinical_review === 1 ? "guide awaits" : "guides await"} clinical review</Text>
            <Icon name="arrow-forward" size={17} color={dark ? "#F6CE9E" : "#A26B27"} />
          </Pressable>
        )}
      </View>

      <View style={{ gap: 13 }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        }}>
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={{
              fontFamily: "DMSans_700Bold", fontSize: 23, color: ink,
            }}>Content library</Text>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: 11.8, color: muted,
            }}>{loading ? "Loading…" : visible.length + " of " + items.length + " guides"}{updatedAt ? " · Updated " + updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh clinical content"
            disabled={refreshing}
            onPress={() => void refresh(true)}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6,
              borderWidth: 1, borderColor: dark ? "#785293" : "#C08BD5",
              borderRadius: 999, minHeight: 38, paddingHorizontal: 12,
              opacity: refreshing || pressed ? 0.6 : 1,
            })}
          >
            {refreshing ? <ActivityIndicator size="small" color={C.purple} /> : <Icon name="refresh-outline" size={18} color={dark ? "#DCC2F6" : "#7C359B"} />}
            <Text style={{
              fontFamily: "DMSans_600SemiBold", fontSize: 12,
              color: dark ? "#DCC2F6" : "#7C359B",
            }}>Refresh</Text>
          </Pressable>
        </View>

        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          borderWidth: 1, borderColor: stroke, borderRadius: 17,
          backgroundColor: dark ? "#292137" : "#FFFFFF",
          paddingHorizontal: 13, minHeight: 50,
        }}>
          <Icon name="search-outline" color={dark ? "#B9A2CD" : "#947FA8"} size={19} />
          <TextInput
            accessibilityLabel="Search clinical content"
            placeholder="Search guides or categories"
            placeholderTextColor={dark ? "#9F91AB" : "#908498"}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
            style={{
              flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13.2,
              minHeight: 45, color: ink,
            }}
          />
          {Boolean(search) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
              hitSlop={10}
            >
              <Icon name="close-circle" size={19} color={muted} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 1 }}>
          {([
            { key: "all" as const, label: "All guides", count: items.length },
            { key: "draft" as const, label: "Drafts", count: counts.draft },
            { key: "clinical_review" as const, label: "In review", count: counts.clinical_review },
            { key: "approved" as const, label: "Approved", count: counts.approved },
            { key: "published" as const, label: "Published", count: counts.published },
          ]).map((chip) => (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === chip.key }}
              accessibilityLabel={chip.label + ": " + chip.count}
              onPress={() => setFilter(chip.key)}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 14, minHeight: 37,
                borderRadius: 999, borderWidth: 1,
                borderColor: filter === chip.key ? (dark ? "#B78BDA" : "#74319A") : stroke,
                backgroundColor: filter === chip.key ? (dark ? "#755097" : "#763596") : (dark ? "#332940" : "#FFFFFF"),
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Text style={{
                fontFamily: "DMSans_600SemiBold", fontSize: 11.7,
                color: filter === chip.key ? "#FFFFFF" : muted,
              }}>{chip.label} ({chip.count})</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={newestFirst ? "Sort by oldest update" : "Sort by newest update"}
          onPress={() => setNewestFirst((current) => !current)}
          style={{ flexDirection: "row", alignSelf: "flex-end", alignItems: "center", gap: 5, minHeight: 30 }}
        >
          <Icon name="swap-vertical-outline" size={16} color={muted} />
          <Text style={{ fontFamily: "DMSans_600SemiBold", color: muted, fontSize: 11.7 }}>
            {newestFirst ? "Recently updated" : "Oldest updated"}
          </Text>
        </Pressable>
      </View>

      {Boolean(message) && (
        <View style={{
          padding: 15, borderWidth: 1, borderRadius: 17,
          borderColor: dark ? "#8A5266" : "#ECC5D3",
          backgroundColor: dark ? "#402839" : "#FFF2F6", gap: 10,
        }}>
          <Text accessibilityRole="alert" style={{ fontFamily: "DMSans_600SemiBold", fontSize: 12.8, lineHeight: 19, color: dark ? "#FFC3D7" : "#983B5E" }}>{message}</Text>
          <Button title="Try again" secondary onPress={() => void refresh(true)} />
        </View>
      )}

      {loading ? (
        <View style={{
          minHeight: 140, alignItems: "center", justifyContent: "center",
          backgroundColor: panel, borderRadius: 23, gap: 12,
        }}>
          <ActivityIndicator color={C.purple} />
          <Text style={{ fontFamily: "DMSans_400Regular", color: muted }}>Loading governed content…</Text>
        </View>
      ) : visible.length ? (
        <View style={{ gap: 12 }}>
          {visible.map((item) => (
            <GlassContentCard
              key={item.uuid}
              item={item}
              dark={dark}
              onPress={() => n.navigate("ClinicalContentEditor", { contentId: item.uuid })}
            />
          ))}
        </View>
      ) : (
        <View style={{
          padding: 27, alignItems: "center", gap: 10,
          backgroundColor: panel, borderRadius: 23, borderWidth: 1, borderColor: stroke,
        }}>
          <View style={{
            width: 58, height: 58, borderRadius: 21,
            justifyContent: "center", alignItems: "center",
            backgroundColor: dark ? "#4B355B" : "#F0E5F7",
          }}>
            <Icon name={items.length ? "search-outline" : "library-outline"} size={29} color={dark ? "#E3BFF8" : "#7F3B9F"} />
          </View>
          <Text style={{
            fontFamily: "DMSans_700Bold", fontSize: 15.5, color: ink,
          }}>{items.length ? "No matching guides" : "No governed content yet"}</Text>
          <Text style={{
            fontFamily: "DMSans_400Regular", fontSize: 12.5, lineHeight: 20,
            color: muted, textAlign: "center",
          }}>{items.length ? "Try another search or clear the status filter." : "Clinical education records will appear here when available."}</Text>
          {Boolean(search || filter !== "all") && (
            <Button title="Show all guides" secondary onPress={() => { setSearch(""); setFilter("all"); }} />
          )}
        </View>
      )}

      <View style={{
        flexDirection: "row", gap: 10, alignItems: "flex-start",
        paddingHorizontal: 6, paddingVertical: 5,
      }}>
        <Icon name="shield-checkmark-outline" size={18} color={dark ? "#C6A4E4" : "#8850A1"} />
        <Text style={{
          flex: 1, fontFamily: "DMSans_400Regular", fontSize: 11.5,
          lineHeight: 18, color: muted,
        }}>
          Advocates can edit and submit drafts for clinical review. Only administrators can approve and publish guidance. Every change remains versioned.
        </Text>
      </View>
    </Page>
  );
}


/** One design across every governed guide; record content is never embedded in the UI. */
function EditorGlassPanel({
  children,
  dark,
  accent = false,
}: {
  children: React.ReactNode;
  dark: boolean;
  accent?: boolean;
}) {
  return (
    <View style={{
      padding: 17,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: dark ? "#514064" : "#EDE5F2",
      backgroundColor: dark ? (accent ? "#2E2240" : "#251F34") : (accent ? "#FBF6FF" : "#FFFFFFE8"),
      gap: 15,
      shadowColor: dark ? "#000000" : "#79568C",
      shadowOpacity: dark ? 0 : 0.055,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    }}>
      {children}
    </View>
  );
}

function EditorSectionHeader({
  title, summary, icon, dark, open, onPress, count,
}: {
  title: string;
  summary: string;
  icon: string;
  dark: boolean;
  open: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={open ? "Collapse section" : "Expand section"}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 11,
        minHeight: 51, opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{
        width: 42, height: 42, borderRadius: 15,
        alignItems: "center", justifyContent: "center",
        backgroundColor: dark ? "#49365F" : "#F1E6FA",
      }}>
        <Icon name={icon} size={21} color={dark ? "#D8B2F4" : "#8138A2"} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{
          fontFamily: "DMSans_700Bold", fontSize: 16, lineHeight: 21,
          color: dark ? "#F5F0FF" : "#17143D",
        }}>{title}</Text>
        <Text numberOfLines={2} style={{
          fontFamily: "DMSans_400Regular", fontSize: 12.2,
          lineHeight: 17, color: dark ? "#BCAAca" : "#7A718B",
        }}>{summary}</Text>
      </View>
      {count !== undefined && (
        <View style={{
          minWidth: 25, height: 25, borderRadius: 13,
          paddingHorizontal: 6, justifyContent: "center", alignItems: "center",
          backgroundColor: dark ? "#49375A" : "#F0E5F7",
        }}>
          <Text style={{
            fontSize: 11, fontFamily: "DMSans_700Bold",
            color: dark ? "#DEC4F5" : "#79369A",
          }}>{count}</Text>
        </View>
      )}
      <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={dark ? "#CAB3DE" : "#8A789E"} />
    </Pressable>
  );
}

function EditorGlassField({
  label, value, onChange, dark, multiline = false, editable,
  hint, inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  multiline?: boolean;
  editable: boolean;
  hint?: string;
  inputMode?: "url" | "text";
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{
        fontFamily: "DMSans_600SemiBold", fontSize: 12.7,
        color: dark ? "#F3E9FD" : "#282046",
      }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        editable={editable}
        onChangeText={onChange}
        multiline={multiline}
        autoCapitalize={inputMode === "url" ? "none" : "sentences"}
        autoCorrect={inputMode === "url" ? false : undefined}
        keyboardType={inputMode === "url" ? "url" : "default"}
        textAlignVertical={multiline ? "top" : "center"}
        placeholder={editable ? "Write here…" : undefined}
        placeholderTextColor={dark ? "#9D8BAF" : "#A397AE"}
        style={{
          borderWidth: 1,
          borderColor: dark ? "#5B4A6C" : "#E8DEED",
          backgroundColor: dark ? (editable ? "#30263F" : "#282132") : (editable ? "#FFFFFF" : "#F5F1F7"),
          color: dark ? "#F8F2FE" : "#19143D",
          borderRadius: 17,
          minHeight: multiline ? 112 : 52,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 14 : 12,
          fontSize: 13.6,
          lineHeight: multiline ? 21 : 20,
          fontFamily: "DMSans_400Regular",
        }}
      />
      {hint && (
        <Text style={{
          fontSize: 11.1, fontFamily: "DMSans_400Regular",
          lineHeight: 16, color: dark ? "#BAA9C9" : "#82778F",
        }}>{hint}</Text>
      )}
    </View>
  );
}

type EditorWorkflowAction = "publish" | "return_draft" | null;

function editableSnapshot(record: ClinicalContentRecord) {
  return JSON.stringify({
    title: record.title,
    category: record.category,
    description: record.description,
    readTime: record.readTime,
    url: record.url ?? "",
    reviewNotes: record.reviewNotes,
    sections: record.sections,
  });
}

export function ClinicalContentEditorScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStack, "ClinicalContentEditor">) {
  const { dark } = useAppearance();
  const [item, setItem] = useState<ClinicalContentRecord | null>(null);
  const [savedItem, setSavedItem] = useState<ClinicalContentRecord | null>(null);
  const [versions, setVersions] = useState<ClinicalContentVersion[]>([]);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true });
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [pendingWorkflow, setPendingWorkflow] = useState<EditorWorkflowAction>(null);
  const [allowLeave, setAllowLeave] = useState(false);
  const dirty = Boolean(item && savedItem && editableSnapshot(item) !== editableSnapshot(savedItem));

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [managed, current, history] = await Promise.all([
        loadManagedClinicalContent(),
        loadClinicalContentItem(route.params.contentId),
        loadClinicalContentVersions(route.params.contentId),
      ]);
      setRole(managed.role);
      setItem(current);
      setSavedItem(current);
      setVersions(history);
      setReviewOpen(current.status === "clinical_review");
      setExpandedSections({ 0: true });
      setPendingWorkflow(null);
      setPendingRemove(null);
      setAllowLeave(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load this content.",
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.contentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // React Navigation guards the native Back button and all stack navigation.
  usePreventRemove(dirty && !busy && !allowLeave, ({ data }) => {
    const leave = () => {
      setAllowLeave(true);
      // Allow React to commit the state before replaying the requested navigation.
      setTimeout(() => navigation.dispatch(data.action), 0);
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Discard your unsaved changes and leave this guide?")) leave();
    } else {
      Alert.alert(
        "Unsaved changes",
        "Your edits have not been saved. Discard them and leave this guide?",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard and leave", style: "destructive", onPress: leave },
        ],
      );
    }
  });

  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const ink = dark ? "#F7F0FF" : "#18143C";
  const muted = dark ? "#C5B6D4" : "#77718D";
  const canEdit = Boolean(item && item.status !== "published");
  const fieldEditable = canEdit && !busy;

  function setField<K extends keyof ClinicalContentRecord>(
    key: K, value: ClinicalContentRecord[K],
  ) {
    if (!fieldEditable) return;
    setItem((current) => current ? { ...current, [key]: value } : current);
  }

  function updateSection(index: number, patch: Partial<ClinicalSection>) {
    if (!fieldEditable) return;
    setItem((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section, i) =>
          i === index ? { ...section, ...patch } : section,
        ),
      };
    });
  }

  async function run(action: () => Promise<ClinicalContentRecord>, success: string) {
    if (busy) return;
    setBusy(true);
    setPendingWorkflow(null);
    setMessage("");
    try {
      const updated = await action();
      setItem(updated);
      setSavedItem(updated);
      setAllowLeave(false);
      setMessage(success);
      try {
        setVersions(await loadClinicalContentVersions(updated.uuid));
      } catch {
        setMessage(success + " Version history could not be refreshed.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The content update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <View style={{ minHeight: 280, gap: 12, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.purple} />
          <Text style={{ color: muted, fontFamily: "DMSans_400Regular" }}>
            Opening content review…
          </Text>
        </View>
      </Page>
    );
  }

  if (!item) {
    return (
      <Page>
        <Heading title="Content unavailable" body="This guide could not be opened." />
        {Boolean(message) && (
          <Text accessibilityRole="alert" style={{ color: C.rose }}>{message}</Text>
        )}
        <Button title="Try again" onPress={() => void refresh()} />
      </Page>
    );
  }

  const stageList: { label: string; key: ClinicalStatus }[] = [
    { label: "Draft", key: "draft" },
    { label: "Review", key: "clinical_review" },
    { label: "Approved", key: "approved" },
    { label: "Published", key: "published" },
  ];
  const stageIndex = Math.max(0, stageList.findIndex((stage) => stage.key === item.status));
  const haveUnsaved = dirty;
  const isValidForSave = item.title.trim().length > 0 && item.category.trim().length > 0;
  const statusDescription = item.status === "published"
    ? "This approved guide is visible in the caregiver library."
    : item.status === "approved"
      ? "This guide is approved and ready for an administrator to publish."
      : item.status === "clinical_review"
        ? "This guide is waiting for clinical review before publication."
        : "This guide is an unpublished draft. Save your edits before submitting it.";
  const workflowBlocked = busy || haveUnsaved;
  const workflowHelp = haveUnsaved
    ? "Save your changes before changing the review status."
    : item.status === "published"
      ? "Return to draft to make changes. This will remove the guide from the published library."
      : "Actions follow your account's clinical-content permissions.";

  return (
    <Page>
      <View style={{
        borderRadius: 28,
        backgroundColor: dark ? "#231B32" : "#FCF7FF",
        borderWidth: 1, borderColor: dark ? "#534168" : "#EEE5F4",
        padding: 19, gap: 13,
        position: "relative", overflow: "hidden",
      }}>
        <View pointerEvents="none" style={{
          position: "absolute", right: -57, top: -49, width: 180, height: 180,
          borderRadius: 90, backgroundColor: dark ? "#55366A" : "#EACDF7",
          opacity: 0.45,
        }} />
        <View pointerEvents="none" style={{
          position: "absolute", right: -58, top: 18, opacity: 0.39,
        }}>
          <ClinicalGlassArtwork dark={dark} />
        </View>
        <Text style={{
          fontFamily: "DMSans_700Bold", fontSize: 10.3,
          letterSpacing: 2, color: dark ? "#D8B6F1" : "#81389D",
        }}>CONTENT REVIEW</Text>
        <Text numberOfLines={1} style={{
          fontFamily: "DMSans_600SemiBold", fontSize: 11,
          letterSpacing: 1.2, textTransform: "uppercase",
          color: muted,
        }}>{item.category}</Text>
        <Text accessibilityRole="header" style={{
          fontFamily: "DMSans_700Bold", fontSize: 29,
          lineHeight: 36, letterSpacing: -0.8,
          color: ink, maxWidth: 310,
        }}>{item.title}</Text>
        <Text style={{
          fontFamily: "DMSans_400Regular", fontSize: 12.7,
          lineHeight: 19, color: muted, maxWidth: 310,
        }}>{statusDescription}</Text>
        <View style={{
          flexDirection: "row", alignItems: "center",
          justifyContent: "space-between", gap: 9,
          flexWrap: "wrap",
        }}>
          <StatusPill status={item.status} />
          <Text style={{
            fontFamily: "DMSans_600SemiBold", fontSize: 12,
            color: muted,
          }}>Version {item.version}{haveUnsaved ? " · Unsaved edits" : ""}</Text>
        </View>
      </View>

      <EditorGlassPanel dark={dark}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={{
            fontFamily: "DMSans_700Bold", fontSize: 16.5, color: ink,
          }}>Review progress</Text>
          <Icon name="shield-checkmark-outline" size={21} color={dark ? "#D2B2EE" : "#803CA4"} />
        </View>
        <View style={{ flexDirection: "row", gap: 5 }}>
          {stageList.map((stage, index) => (
            <View key={stage.key} style={{ flex: 1, gap: 7 }}>
              <View style={{
                height: 5, borderRadius: 4,
                backgroundColor: index <= stageIndex
                  ? (dark ? "#B68DD4" : "#853BAC")
                  : (dark ? "#51425F" : "#E7D9EE"),
              }} />
              <Text numberOfLines={1} style={{
                fontFamily: "DMSans_500Medium", fontSize: 10.2,
                textAlign: "center",
                color: index <= stageIndex ? ink : muted,
              }}>{stage.label}</Text>
            </View>
          ))}
        </View>
      </EditorGlassPanel>

      {item.status === "published" && (
        <View style={{
          borderRadius: 17, padding: 13, gap: 9,
          backgroundColor: dark ? "#224238" : "#EAF7EF",
          flexDirection: "row", alignItems: "center",
        }}>
          <Icon name="lock-closed-outline" size={21} color={dark ? "#A5DEBE" : "#277354"} />
          <Text style={{
            flex: 1, fontFamily: "DMSans_400Regular",
            fontSize: 12.2, lineHeight: 19,
            color: dark ? "#CBEAD8" : "#25684E",
          }}>Published content is read-only. Return it to draft before editing.</Text>
        </View>
      )}

      {haveUnsaved && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 9,
          backgroundColor: dark ? "#483923" : "#FFF4E7",
          borderWidth: 1, borderColor: dark ? "#665133" : "#F3DCBB",
          borderRadius: 17, padding: 13,
        }}>
          <Icon name="ellipse" size={11} color={dark ? "#F8CE9B" : "#C68A2B"} />
          <Text style={{
            flex: 1, fontFamily: "DMSans_600SemiBold", fontSize: 12,
            color: dark ? "#F7D7AC" : "#8B602D",
          }}>You have unsaved changes.</Text>
        </View>
      )}

      <EditorGlassPanel dark={dark}>
        <EditorSectionHeader
          title="Guide details"
          summary="Title, category, description and reading time"
          icon="document-text-outline"
          dark={dark}
          open={detailsOpen}
          onPress={() => setDetailsOpen((value) => !value)}
        />
        {detailsOpen && (
          <View style={{ gap: 16 }}>
            <EditorGlassField label="Title" value={item.title}
              onChange={(value) => setField("title", value)}
              dark={dark} editable={fieldEditable} />
            <EditorGlassField label="Category" value={item.category}
              onChange={(value) => setField("category", value)}
              dark={dark} editable={fieldEditable} />
            <EditorGlassField label="Short description" value={item.description}
              onChange={(value) => setField("description", value)}
              dark={dark} editable={fieldEditable} multiline />
            <EditorGlassField label="Read time" value={item.readTime}
              onChange={(value) => setField("readTime", value)}
              dark={dark} editable={fieldEditable} hint="For example, 3 min read" />
          </View>
        )}
      </EditorGlassPanel>

      <EditorGlassPanel dark={dark}>
        <EditorSectionHeader
          title="Sources & clinical notes"
          summary="References and notes for the review team"
          icon="library-outline"
          dark={dark}
          open={sourcesOpen}
          onPress={() => setSourcesOpen((value) => !value)}
        />
        {sourcesOpen && (
          <View style={{ gap: 16 }}>
            <EditorGlassField
              label="Trusted source URL"
              value={item.url ?? ""}
              onChange={(value) => setField("url", value)}
              dark={dark}
              inputMode="url"
              editable={fieldEditable}
              hint="Link to the source used to support this guidance." />
            <EditorGlassField
              label="Clinical review notes"
              value={item.reviewNotes}
              onChange={(value) => setField("reviewNotes", value)}
              dark={dark}
              multiline
              editable={fieldEditable}
              hint="Document clinically relevant revisions or reviewer feedback." />
          </View>
        )}
      </EditorGlassPanel>

      <View style={{ gap: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text accessibilityRole="header" style={{
              fontFamily: "DMSans_700Bold", fontSize: 22, color: ink,
            }}>Guide sections</Text>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: 12.5, color: muted,
            }}>{item.sections.length} {item.sections.length === 1 ? "section" : "sections"} · Expand to edit</Text>
          </View>
          <View style={{
            borderRadius: 15, padding: 11,
            backgroundColor: dark ? "#402C54" : "#F1E7F7",
          }}>
            <Icon name="list-outline" size={24} color={dark ? "#E0C0F7" : "#823BA1"} />
          </View>
        </View>

        {item.sections.map((section, index) => {
          const open = Boolean(expandedSections[index]);
          return (
            <EditorGlassPanel key={index} dark={dark}>
              <EditorSectionHeader
                title={section.title.trim() || "Untitled section " + (index + 1)}
                summary={open ? "Section " + (index + 1) + " · Edit heading and body" : (section.body.trim().slice(0, 88) || "Tap to add content")}
                icon="reader-outline"
                count={index + 1}
                dark={dark}
                open={open}
                onPress={() => setExpandedSections((current) => ({ ...current, [index]: !current[index] }))}
              />
              {open && (
                <View style={{ gap: 15 }}>
                  <EditorGlassField
                    label="Heading"
                    value={section.title}
                    onChange={(value) => updateSection(index, { title: value })}
                    dark={dark}
                    editable={fieldEditable} />
                  <EditorGlassField
                    label="Body"
                    value={section.body}
                    onChange={(value) => updateSection(index, { body: value })}
                    dark={dark}
                    multiline
                    editable={fieldEditable}
                    hint="This text is for caregiver education; retain clinically reviewed wording." />
                  {canEdit && item.sections.length > 1 && (
                    pendingRemove === index ? (
                      <View style={{
                        borderRadius: 17, padding: 13, gap: 11,
                        backgroundColor: dark ? "#402737" : "#FFF2F6",
                      }}>
                        <Text style={{
                          fontFamily: "DMSans_600SemiBold", fontSize: 12.5,
                          color: dark ? "#FFC6D8" : "#8F3456",
                        }}>Remove this section? The removal stays unsaved until you save the guide.</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Button title="Cancel" secondary disabled={busy}
                              onPress={() => setPendingRemove(null)} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Button title="Remove" disabled={busy}
                              onPress={() => {
                                setField("sections", item.sections.filter((_, i) => i !== index));
                                setPendingRemove(null);
                                setExpandedSections({ 0: true });
                              }} />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={"Remove section " + (index + 1)}
                        disabled={busy}
                        onPress={() => setPendingRemove(index)}
                        style={({ pressed }) => ({
                          flexDirection: "row", alignItems: "center", justifyContent: "center",
                          minHeight: 43, gap: 7, borderRadius: 15,
                          backgroundColor: dark ? "#493042" : "#FBEFF3",
                          opacity: pressed || busy ? 0.7 : 1,
                        })}
                      >
                        <Icon name="trash-outline" size={17} color={dark ? "#FFC2D3" : "#A34B67"} />
                        <Text style={{
                          fontFamily: "DMSans_600SemiBold", fontSize: 12.5,
                          color: dark ? "#FFC2D3" : "#A34B67",
                        }}>Remove section</Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </EditorGlassPanel>
          );
        })}

        {canEdit && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add guide section"
            disabled={busy}
            onPress={() => {
              const nextIndex = item.sections.length;
              setField("sections", [...item.sections, { title: "", body: "" }]);
              setExpandedSections((current) => ({ ...current, [nextIndex]: true }));
            }}
            style={({ pressed }) => ({
              minHeight: 51, borderWidth: 1.4, borderStyle: "dashed",
              borderColor: dark ? "#946CB0" : "#BD91D3",
              borderRadius: 19, backgroundColor: dark ? "#32243D" : "#F8F1FC",
              flexDirection: "row", justifyContent: "center", alignItems: "center",
              gap: 9, opacity: pressed || busy ? 0.7 : 1,
            })}
          >
            <Icon name="add-circle-outline" size={20} color={dark ? "#E4BDFC" : "#7C3B9C"} />
            <Text style={{
              color: dark ? "#E4BDFC" : "#7C3B9C",
              fontFamily: "DMSans_700Bold", fontSize: 13,
            }}>Add section</Text>
          </Pressable>
        )}
      </View>

      {canEdit && (
        <EditorGlassPanel dark={dark} accent>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="save-outline" size={22} color={dark ? "#E7C9FF" : "#7B38A0"} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{
                fontFamily: "DMSans_700Bold", fontSize: 16, color: ink,
              }}>Save your work</Text>
              <Text style={{
                fontFamily: "DMSans_400Regular", fontSize: 12, color: muted,
              }}>{haveUnsaved ? "Changes have not been saved yet." : "No unsaved edits."}</Text>
            </View>
          </View>
          <Button title={busy ? "Saving…" : "Save changes"} disabled={busy || !haveUnsaved || !isValidForSave}
            icon="save-outline"
            onPress={() => void run(() => saveClinicalContent(item), "A new content version was saved.")} />
          {!isValidForSave && (
            <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: C.rose }}>
              Title and category are required before saving.
            </Text>
          )}
        </EditorGlassPanel>
      )}

      <EditorGlassPanel dark={dark} accent>
        <EditorSectionHeader
          title="Review & publishing"
          summary="Manage approval and visibility for caregivers"
          icon="shield-checkmark-outline"
          dark={dark}
          open={reviewOpen}
          onPress={() => setReviewOpen((value) => !value)}
        />
        {reviewOpen && (
          <View style={{ gap: 11 }}>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: 12,
              lineHeight: 19, color: muted,
            }}>{workflowHelp}</Text>
            {item.status === "draft" && (
              <Button title="Submit for clinical review" disabled={workflowBlocked}
                icon="arrow-forward-circle-outline"
                onPress={() => void run(
                  () => submitClinicalContentForReview(item.uuid),
                  "Content submitted for clinical review.",
                )} />
            )}
            {item.status === "clinical_review" && role === "admin" && (
              <Button title="Approve clinical content" disabled={workflowBlocked}
                icon="shield-checkmark-outline"
                onPress={() => void run(
                  () => approveClinicalContent(item.uuid, item.reviewNotes),
                  "Clinical content approved.",
                )} />
            )}
            {item.status === "approved" && role === "admin" && (
              <Button title="Publish to caregiver library" disabled={workflowBlocked}
                icon="cloud-upload-outline"
                onPress={() => setPendingWorkflow("publish")} />
            )}
            {item.status !== "draft" && (
              <Button title="Return to draft" secondary disabled={workflowBlocked}
                icon="arrow-undo-outline"
                onPress={() => setPendingWorkflow("return_draft")} />
            )}
            {pendingWorkflow && (
              <View style={{
                backgroundColor: dark ? "#413044" : "#F9EBF5",
                borderWidth: 1, borderColor: dark ? "#765279" : "#E8CEE4",
                borderRadius: 17, padding: 13, gap: 12,
              }}>
                <Text style={{
                  fontFamily: "DMSans_600SemiBold", fontSize: 13,
                  lineHeight: 20, color: ink,
                }}>
                  {pendingWorkflow === "publish"
                    ? "Publish this approved version to the caregiver library?"
                    : "Return this guide to draft? Published content will no longer appear in the caregiver library."}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Cancel" secondary onPress={() => setPendingWorkflow(null)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Confirm" disabled={workflowBlocked}
                      onPress={() => void run(
                        () => pendingWorkflow === "publish"
                          ? publishClinicalContent(item.uuid)
                          : returnClinicalContentToDraft(item.uuid),
                        pendingWorkflow === "publish"
                          ? "Content published to caregivers."
                          : "Content returned to draft.",
                      )} />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </EditorGlassPanel>

      {Boolean(message) && (
        <View style={{
          padding: 13, borderRadius: 17,
          backgroundColor: dark ? "#3E2E49" : "#F3EAF8",
          borderColor: dark ? "#634A70" : "#E7D8F0",
          borderWidth: 1,
        }}>
          <Text accessibilityRole="alert" style={{
            fontFamily: "DMSans_500Medium",
            color: dark ? "#F1DDF9" : "#70348A",
            fontSize: 12.7, lineHeight: 20,
          }}>{message}</Text>
        </View>
      )}

      <EditorGlassPanel dark={dark}>
        <EditorSectionHeader
          title="Version history"
          summary="Previous revisions and status changes"
          icon="time-outline"
          dark={dark}
          count={versions.length}
          open={historyOpen}
          onPress={() => setHistoryOpen((value) => !value)}
        />
        {historyOpen && (
          <View style={{ gap: 9 }}>
            {versions.length ? versions.map((version) => (
              <View key={version.id} style={{
                borderRadius: 16, borderWidth: 1,
                borderColor: dark ? "#514260" : "#F0E9F3",
                backgroundColor: dark ? "#302740" : "#FAF7FC",
                padding: 12, gap: 6,
              }}>
                <View style={{
                  flexDirection: "row", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: 5,
                }}>
                  <Text style={{
                    fontFamily: "DMSans_700Bold", fontSize: 13.5, color: ink,
                  }}>Version {version.version}</Text>
                  <Text style={{
                    fontFamily: "DMSans_400Regular", fontSize: 11, color: muted,
                  }}>{new Date(version.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={{
                  fontFamily: "DMSans_500Medium", fontSize: 12, color: muted,
                }}>{version.action.replaceAll("_", " ")}</Text>
                {version.snapshot.status && (
                  <Text style={{
                    fontFamily: "DMSans_400Regular", fontSize: 11.7,
                    color: muted,
                  }}>Status: {statusLabel(version.snapshot.status)}</Text>
                )}
              </View>
            )) : (
              <Text style={{
                fontFamily: "DMSans_400Regular", fontSize: 12, color: muted,
              }}>No previous versions yet.</Text>
            )}
          </View>
        )}
      </EditorGlassPanel>

      <View style={{
        flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 4,
      }}>
        <Icon name="information-circle-outline" size={18} color={dark ? "#CAACE2" : "#8957A0"} />
        <Text style={{
          flex: 1, fontFamily: "DMSans_400Regular", fontSize: 11.5,
          lineHeight: 18, color: muted,
        }}>
          Only approved and published guidance is shown to caregivers. Content changes are versioned for traceability.
        </Text>
      </View>
    </Page>
  );
}
