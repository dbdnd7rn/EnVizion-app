import { themeForeground } from "../themeColors";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAppearance } from "../appearance";
import { supabase } from "../supabase";
import { ClinicalGlassArtwork } from "../components/ClinicalGlassArtwork";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
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
          <Text style={{ fontFamily: "DMSans_500Medium", color: muted, fontSize: 11.7 }}>
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

export function ClinicalContentEditorScreen({
  route,
}: NativeStackScreenProps<RootStack, "ClinicalContentEditor">) {
  const [item, setItem] = useState<ClinicalContentRecord | null>(null);
  const [versions, setVersions] = useState<ClinicalContentVersion[]>([]);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      setVersions(history);
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

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading content record…</Txt>
      </Page>
    );
  }

  if (!item) {
    return (
      <Page>
        <Heading title="Content unavailable" />
        {Boolean(message) && <Txt>{message}</Txt>}
        <Button title="Try again" onPress={() => void refresh()} />
      </Page>
    );
  }

  const editable = item.status !== "published";

  function setField<K extends keyof ClinicalContentRecord>(
    key: K,
    value: ClinicalContentRecord[K],
  ) {
    setItem((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateSection(index: number, patch: Partial<ClinicalSection>) {
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
    setBusy(true);
    setMessage("");
    try {
      const updated = await action();
      setItem(updated);
      setMessage(success);
      setVersions(await loadClinicalContentVersions(updated.uuid));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The content update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <View style={S.between}>
        <StatusPill status={item.status} />
        <Text style={S.small}>Version {item.version}</Text>
      </View>

      <Heading
        eyebrow={item.category}
        title={item.title}
        body="Clinical content changes are versioned so previous states remain traceable."
      />

      <Card>
        <Field
          label="Title"
          value={item.title}
          onChange={(value) => setField("title", value)}
        />
        <Field
          label="Category"
          value={item.category}
          onChange={(value) => setField("category", value)}
        />
        <Field
          label="Short description"
          value={item.description}
          onChange={(value) => setField("description", value)}
          multiline
        />
        <Field
          label="Read time"
          value={item.readTime}
          onChange={(value) => setField("readTime", value)}
        />
        <Field
          label="Trusted source URL"
          value={item.url ?? ""}
          onChange={(value) => setField("url", value)}
        />
        <Field
          label="Clinical review notes"
          value={item.reviewNotes}
          onChange={(value) => setField("reviewNotes", value)}
          multiline
        />
      </Card>

      <Section title="Guide sections" />
      {item.sections.map((section, index) => (
        <Card key={`${index}-${section.title}`}>
          <Text style={S.eyebrow}>SECTION {index + 1}</Text>
          <Field
            label="Heading"
            value={section.title}
            onChange={(value) => updateSection(index, { title: value })}
          />
          <Field
            label="Body"
            value={section.body}
            onChange={(value) => updateSection(index, { body: value })}
            multiline
          />
          {editable && item.sections.length > 1 && (
            <Button
              title="Remove section"
              secondary
              disabled={busy}
              onPress={() =>
                setField(
                  "sections",
                  item.sections.filter((_, i) => i !== index),
                )
              }
            />
          )}
        </Card>
      ))}

      {editable && (
        <Button
          title="Add section"
          secondary
          icon="add-outline"
          disabled={busy}
          onPress={() =>
            setField("sections", [
              ...item.sections,
              { title: "", body: "" },
            ])
          }
        />
      )}

      {editable && (
        <Button
          title={busy ? "Saving…" : "Save changes"}
          disabled={busy}
          icon="save-outline"
          onPress={() =>
            void run(
              () => saveClinicalContent(item),
              "A new content version was saved.",
            )
          }
        />
      )}

      {item.status === "draft" && (
        <Button
          title="Submit for clinical review"
          disabled={busy}
          onPress={() =>
            void run(
              () => submitClinicalContentForReview(item.uuid),
              "Content submitted for clinical review.",
            )
          }
        />
      )}

      {item.status === "clinical_review" && role === "admin" && (
        <Button
          title="Approve clinical content"
          disabled={busy}
          icon="shield-checkmark-outline"
          onPress={() =>
            void run(
              () => approveClinicalContent(item.uuid, item.reviewNotes),
              "Clinical content approved.",
            )
          }
        />
      )}

      {item.status === "approved" && role === "admin" && (
        <Button
          title="Publish to caregiver library"
          disabled={busy}
          icon="cloud-upload-outline"
          onPress={() =>
            void run(
              () => publishClinicalContent(item.uuid),
              "Content published to caregivers.",
            )
          }
        />
      )}

      {item.status !== "draft" && (
        <Button
          title="Return to draft"
          secondary
          disabled={busy}
          onPress={() =>
            void run(
              () => returnClinicalContentToDraft(item.uuid),
              "Content returned to draft.",
            )
          }
        />
      )}

      {Boolean(message) && (
        <Card
          style={{
            backgroundColor: message.toLowerCase().includes("failed")
              ? C.redBg
              : C.white,
          }}
        >
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Version history" />
      {versions.map((version) => (
        <Card key={version.id}>
          <View style={S.between}>
            <Text style={S.h3}>Version {version.version}</Text>
            <Text style={S.small}>
              {new Date(version.createdAt).toLocaleString()}
            </Text>
          </View>
          <Text style={S.eyebrow}>
            {version.action.replaceAll("_", " ")}
          </Text>
          {version.snapshot.status && (
            <Txt>Status: {statusLabel(version.snapshot.status)}</Txt>
          )}
        </Card>
      ))}

      <Txt style={S.small}>
        Publishing makes this version visible in the caregiver resource library.
        Returning a published item to draft removes it from the published feed.
      </Txt>
    </Page>
  );
}
