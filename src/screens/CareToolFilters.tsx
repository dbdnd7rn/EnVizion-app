import React from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../ui";
import type { CareToolScope, CareToolSort } from "../careToolSearch";

const PURPLE = "#70338F";
const INK = "#17153D";

type Option = { value: CareToolScope; label: string; count: number };
type SortOption = { value: CareToolSort; label: string };

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingVertical: 9,
        paddingHorizontal: 13,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: selected ? "#70338F" : "#E6D9F0",
        backgroundColor: selected ? "#70338F" : "#FFFFFFE8",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {selected && <Icon name="checkmark" size={15} color="#FFFFFF" />}
      <Text
        style={{
          color: selected ? "#FFFFFF" : "#58346B",
          fontFamily: "DMSans_600SemiBold",
          fontSize: 12.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CareToolFilters({
  scope,
  sort,
  categoryOptions,
  pinnedCount,
  recentCount,
  onScopeChange,
  onSortChange,
  onReset,
  onClose,
}: {
  scope: CareToolScope;
  sort: CareToolSort;
  categoryOptions: { title: string; count: number }[];
  pinnedCount: number;
  recentCount: number;
  onScopeChange: (next: CareToolScope) => void;
  onSortChange: (next: CareToolSort) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const scopes: Option[] = [
    { value: "all", label: "All tools", count: 0 },
    { value: "pinned", label: "Pinned", count: pinnedCount },
    { value: "recent", label: "Recently used", count: recentCount },
  ];
  const sortOptions: SortOption[] = [
    { value: "relevance", label: "Best match" },
    { value: "alphabetical", label: "A–Z" },
    { value: "recent", label: "Most recent" },
  ];
  const active = scope !== "all" || sort !== "relevance";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#E4D6ED",
        borderRadius: 23,
        backgroundColor: "#F8F3FDEB",
        padding: 15,
        gap: 16,
        shadowColor: "#512D6A",
        shadowOpacity: 0.07,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 7 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View
          style={{
            width: 35,
            height: 35,
            borderRadius: 12,
            backgroundColor: "#EDE0F9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="options-outline" size={20} color={PURPLE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "DMSans_700Bold", color: INK, fontSize: 16 }}>
            Refine care tools
          </Text>
          <Text style={{ fontFamily: "DMSans_400Regular", color: "#7A728C", fontSize: 12 }}>
            Narrow down the tools you want to see.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close care tool filters"
          onPress={onClose}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="close-outline" size={23} color={PURPLE} />
        </Pressable>
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 12.5, color: INK }}>
          Show
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {scopes.map((option) => (
            <Choice
              key={option.value}
              label={option.value === "all" ? option.label : `${option.label} (${option.count})`}
              selected={scope === option.value}
              onPress={() => onScopeChange(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 12.5, color: INK }}>
          By category
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categoryOptions.map((category) => (
            <Choice
              key={category.title}
              label={`${category.title} (${category.count})`}
              selected={scope === `category:${category.title}`}
              onPress={() => onScopeChange(`category:${category.title}`)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 12.5, color: INK }}>
          Sort by
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sortOptions.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              onPress={() => onSortChange(option.value)}
            />
          ))}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: "#E5D8ED",
          paddingTop: 9,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset care tool filters"
          onPress={onReset}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 9,
            justifyContent: "center",
            opacity: active ? (pressed ? 0.6 : 1) : 0.45,
          })}
          disabled={!active}
        >
          <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13, color: PURPLE }}>
            Reset filters
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show matching care tools"
          onPress={onClose}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 19,
            borderRadius: 18,
            backgroundColor: PURPLE,
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontFamily: "DMSans_700Bold", color: "#FFFFFF", fontSize: 13 }}>
            Show tools
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
