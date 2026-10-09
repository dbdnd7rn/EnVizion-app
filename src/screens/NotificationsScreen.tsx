import { themeBackground, themeForeground, themeBorder, themeShadow, themedStyles } from "../themeColors";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useNotifications, type NotificationRecord } from "../notifications";
import {
  filterNotifications,
  notificationDestination,
  unreadSummary,
  type NotificationFilter,
} from "../notificationPresentation";
import { NotificationGlassBell } from "../components/NotificationGlassBell";
import { C, Icon } from "../ui";
import { setActiveCareRecipient } from "../careTeam";
import { useCare } from "../store";
import { useNav } from "./MainScreens";

const glassShadow =
  Platform.OS === "web"
    ? ({
        backdropFilter: "blur(20px)",
        boxShadow: "0 18px 46px rgba(78, 45, 104, 0.10)",
      } as any)
    : undefined;

function iconFor(item: NotificationRecord) {
  if (item.kind.includes("reply")) return "chatbubble-ellipses-outline";
  if (item.kind.includes("coaching")) return "people-outline";
  if (item.kind.includes("support")) return "heart-outline";
  if (item.kind.includes("coordination")) return "warning-outline";
  if (item.kind.includes("weekly_coverage")) return "checkmark-done-outline";
  if (item.kind.includes("coverage_forecast")) return "telescope-outline";
  if (item.kind.includes("coverage_request")) return "megaphone-outline";
  if (item.kind.includes("task") || item.kind.includes("shift")) {
    return "checkbox-outline";
  }
  if (item.kind.includes("reminder")) return "alarm-outline";
  if (item.kind.includes("family_update")) return "chatbubbles-outline";
  if (item.kind.includes("document")) return "folder-open-outline";
  if (item.kind.includes("invite") || item.kind.includes("team")) {
    return "person-add-outline";
  }
  return "notifications-outline";
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReducedMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function BellHero({ reducedMotion }: { reducedMotion: boolean }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      y.stopAnimation();
      y.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: -7,
          duration: 1650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [reducedMotion, y]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bellWrap, { transform: [{ translateY: y }] }]}
    >
      <NotificationGlassBell size={176} />
    </Animated.View>
  );
}

function NotificationCard({
  item,
  index,
  reducedMotion,
  onPress,
}: {
  item: NotificationRecord;
  index: number;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const destination = notificationDestination(item);
  const actionable = Boolean(destination || !item.readAt);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(12);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: Math.min(index * 45, 225),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: Math.min(index * 45, 225),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [index, item.id, opacity, reducedMotion, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        accessibilityRole={actionable ? "button" : undefined}
        accessibilityLabel={`${item.title}. ${item.body}. ${item.readAt ? "Read" : "Unread"}`}
        accessibilityHint={
          destination
            ? "Opens the related item"
            : !item.readAt
              ? "Marks this notification as read"
              : undefined
        }
        disabled={!actionable}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          !item.readAt && styles.cardUnread,
          glassShadow,
          pressed && actionable && styles.pressed,
        ]}
      >
        <View style={styles.cardIcon}>
          <Icon name={iconFor(item)} size={26} color={themeForeground("#7431A8")} />
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMessage} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleString([], {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {!item.readAt && (
          <View accessibilityLabel="Unread" style={styles.unreadDot} />
        )}

        {destination && (
          <View style={styles.chevron}>
            <Icon name="chevron-forward" size={24} color={themeForeground("#8A879D")} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function BackgroundGlow() {
  return (
    <>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.ringTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
    </>
  );
}

export function NotificationsScreen() {
  const n = useNav();
  const { refresh: refreshCare } = useCare();
  const {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [message, setMessage] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const listOpacity = useRef(new Animated.Value(1)).current;
  const listTranslate = useRef(new Animated.Value(0)).current;

  const visibleItems = useMemo(
    () => filterNotifications(items, filter),
    [filter, items],
  );

  function changeFilter(next: NotificationFilter) {
    if (next === filter) return;

    if (reducedMotion) {
      setFilter(next);
      return;
    }

    Animated.parallel([
      Animated.timing(listOpacity, {
        toValue: 0.35,
        duration: 110,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(listTranslate, {
        toValue: 5,
        duration: 110,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(() => {
      setFilter(next);
      listTranslate.setValue(-5);
      Animated.parallel([
        Animated.timing(listOpacity, {
          toValue: 1,
          duration: 190,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(listTranslate, {
          toValue: 0,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    });
  }

  async function openNotification(item: NotificationRecord) {
    setMessage("");
    const destination = notificationDestination(item);

    try {
      if (!item.readAt) await markRead(item.id);
      if (!destination) return;

      if (destination.activateCareRecipientId) {
        await setActiveCareRecipient(destination.activateCareRecipientId);
        await refreshCare();
      }

      if (destination.params) {
        (n.navigate as any)(destination.route, destination.params);
      } else {
        (n.navigate as any)(destination.route);
      }
    } catch (openError) {
      setMessage(
        openError instanceof Error
          ? openError.message
          : "We could not open that notification.",
      );
    }
  }

  async function handleRefresh() {
    setMessage("");
    try {
      await refresh();
    } catch (refreshError) {
      setMessage(
        refreshError instanceof Error
          ? refreshError.message
          : "We could not refresh your notifications.",
      );
    }
  }

  async function handleMarkAllRead() {
    if (!unreadCount) return;

    setMarkingAll(true);
    setMessage("");
    try {
      await markAllRead();
    } catch (markError) {
      setMessage(
        markError instanceof Error
          ? markError.message
          : "We could not update your notifications.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  const activeError = message || error;

  return (
    <View style={styles.root}>
      <BackgroundGlow />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => {
                if (n.canGoBack()) n.goBack();
                else n.popToTop();
              }}
              style={({ pressed }) => [
                styles.circleButton,
                glassShadow,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="chevron-back" size={30} color={C.ink} />
            </Pressable>

            <Text accessibilityRole="header" style={styles.headerTitle}>
              Notifications
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notification preferences"
              onPress={() => n.navigate("NotificationSettings")}
              style={({ pressed }) => [
                styles.circleButton,
                glassShadow,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="settings-outline" size={28} color={themeForeground("#58227C")} />
            </Pressable>
          </View>

          <View style={[styles.hero, compact && styles.heroCompact]}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>STAY IN THE LOOP</Text>
              <Text
                style={[styles.heroTitle, compact && styles.heroTitleCompact]}
              >
                Notifications
              </Text>
              <Text style={styles.heroSubtitle}>
                {unreadSummary(unreadCount)}
              </Text>
            </View>
            <BellHero reducedMotion={reducedMotion} />
          </View>

          <View style={styles.controlsRow}>
            <View style={[styles.segmented, glassShadow]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === "all" }}
                accessibilityLabel="Show all notifications"
                onPress={() => changeFilter("all")}
                style={({ pressed }) => [
                  styles.segment,
                  filter === "all" && styles.segmentSelected,
                  pressed && styles.segmentPressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filter === "all" && styles.segmentTextSelected,
                  ]}
                >
                  All
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === "unread" }}
                accessibilityLabel={`Show unread notifications, ${unreadCount} unread`}
                onPress={() => changeFilter("unread")}
                style={({ pressed }) => [
                  styles.segment,
                  filter === "unread" && styles.segmentSelected,
                  pressed && styles.segmentPressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filter === "unread" && styles.segmentTextSelected,
                  ]}
                >
                  Unread
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                loading ? "Refreshing notifications" : "Refresh notifications"
              }
              accessibilityState={{ busy: loading }}
              disabled={loading}
              onPress={() => void handleRefresh()}
              style={({ pressed }) => [
                styles.refreshButton,
                glassShadow,
                pressed && !loading && styles.pressed,
                loading && styles.disabledButton,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={themeForeground("#6C2A98")} size="small" />
              ) : (
                <Icon name="refresh-outline" size={29} color={themeForeground("#6C2A98")} />
              )}
            </Pressable>
          </View>

          <View style={styles.markRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications read"
              accessibilityState={{
                disabled: !unreadCount || markingAll,
                busy: markingAll,
              }}
              disabled={!unreadCount || markingAll}
              onPress={() => void handleMarkAllRead()}
              style={({ pressed }) => [
                styles.markButton,
                glassShadow,
                (!unreadCount || markingAll) && styles.disabledMark,
                pressed && unreadCount > 0 && !markingAll && styles.pressed,
              ]}
            >
              {markingAll ? (
                <ActivityIndicator color={themeForeground("#6C2A98")} size="small" />
              ) : (
                <Icon name="checkmark-done-outline" size={21} color={themeForeground("#6C2A98")} />
              )}
              <Text style={styles.markButtonText}>Mark all read</Text>
            </Pressable>
          </View>

          {Boolean(activeError) && (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Icon name="alert-circle-outline" size={21} color={C.rose} />
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {filter === "unread" ? "Unread" : "Latest"}
          </Text>

          <Animated.View
            style={[
              styles.list,
              {
                opacity: listOpacity,
                transform: [{ translateY: listTranslate }],
              },
            ]}
          >
            {loading && !items.length ? (
              <View style={[styles.stateCard, glassShadow]}>
                <ActivityIndicator color={themeForeground("#6C2A98")} />
                <Text style={styles.stateTitle}>Loading notifications…</Text>
              </View>
            ) : !items.length ? (
              <View style={[styles.stateCard, glassShadow]}>
                <View style={styles.stateIcon}>
                  <Icon name="notifications-outline" size={28} color={themeForeground("#7431A8")} />
                </View>
                <Text style={styles.stateTitle}>No notifications yet</Text>
                <Text style={styles.stateText}>
                  Account updates will appear here automatically.
                </Text>
              </View>
            ) : !visibleItems.length ? (
              <View style={[styles.stateCard, glassShadow]}>
                <View style={styles.stateIcon}>
                  <Icon name="checkmark-done-outline" size={28} color={themeForeground("#7431A8")} />
                </View>
                <Text style={styles.stateTitle}>All caught up</Text>
                <Text style={styles.stateText}>No unread notifications.</Text>
              </View>
            ) : (
              visibleItems.map((item, index) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  index={index}
                  reducedMotion={reducedMotion}
                  onPress={() => void openNotification(item)}
                />
              ))
            )}
          </Animated.View>

          <View style={styles.footer}>
            <Icon name="shield-outline" size={25} color={themeForeground("#8A879D")} />
            <Text style={styles.footerText}>
              Account updates only. Not emergency monitoring.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: themeBackground("#FCFAFF"),
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 44,
  },
  inner: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  headerTitle: {
    position: "absolute",
    left: 72,
    right: 72,
    textAlign: "center",
    color: themeForeground("#11143A"),
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  circleButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.68)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: themeShadow("#613486"),
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  hero: {
    minHeight: 218,
    justifyContent: "center",
    marginBottom: 15,
  },
  heroCompact: {
    minHeight: 204,
  },
  heroCopy: {
    width: "67%",
    zIndex: 2,
    gap: 7,
  },
  eyebrow: {
    color: themeForeground("#6C2794"),
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    letterSpacing: 3.6,
  },
  heroTitle: {
    color: themeForeground("#10133B"),
    fontFamily: "DMSans_700Bold",
    fontSize: 39,
    lineHeight: 45,
    letterSpacing: -1.5,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  heroSubtitle: {
    color: themeForeground("#58566F"),
    fontFamily: "DMSans_400Regular",
    fontSize: 19,
    lineHeight: 27,
  },
  bellWrap: {
    position: "absolute",
    right: -14,
    top: 17,
    width: 178,
    height: 178,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  segmented: {
    minHeight: 62,
    flex: 1,
    padding: 5,
    flexDirection: "row",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.62)",
    shadowColor: themeShadow("#6D3E8A"),
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 11,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    backgroundColor: themeBackground("#8739C0"),
    shadowColor: themeShadow("#7F39B6"),
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  segmentPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  segmentText: {
    color: themeForeground("#65268E"),
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
  },
  segmentTextSelected: {
    color: themeForeground("#FFFFFF"),
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeBackground("#C73969"),
  },
  badgeText: {
    color: themeForeground("#FFFFFF"),
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
  },
  refreshButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.68)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: themeShadow("#613486"),
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.72,
  },
  markRow: {
    alignItems: "flex-end",
    marginBottom: 18,
  },
  markButton: {
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(248,237,255,0.74)",
  },
  markButtonText: {
    color: themeForeground("#6C2A98"),
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
  },
  disabledMark: {
    opacity: 0.43,
  },
  errorCard: {
    marginBottom: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: themeBorder("#F2D6E0"),
    backgroundColor: "rgba(255,244,248,0.88)",
  },
  errorText: {
    flex: 1,
    color: themeForeground("#933D59"),
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    marginLeft: 4,
    marginBottom: 14,
    color: themeForeground("#66647A"),
    fontFamily: "DMSans_600SemiBold",
    fontSize: 17,
  },
  list: {
    gap: 14,
  },
  card: {
    minHeight: 126,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    backgroundColor: "rgba(255,255,255,0.70)",
    paddingHorizontal: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: themeShadow("#583779"),
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardUnread: {
    backgroundColor: "rgba(251,245,255,0.80)",
    borderColor: "rgba(255,255,255,0.98)",
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,232,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
  },
  cardBody: {
    flex: 1,
    gap: 5,
    paddingRight: 24,
  },
  cardTitle: {
    color: themeForeground("#11143A"),
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    lineHeight: 22,
  },
  cardMessage: {
    color: themeForeground("#343455"),
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    color: themeForeground("#7A7890"),
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  unreadDot: {
    position: "absolute",
    top: 22,
    right: 19,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: themeBackground("#C84A6A"),
  },
  chevron: {
    position: "absolute",
    right: 16,
    bottom: 21,
  },
  stateCard: {
    minHeight: 150,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    backgroundColor: "rgba(255,255,255,0.70)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    shadowColor: themeShadow("#583779"),
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  stateIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(245,232,255,0.90)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  stateTitle: {
    color: themeForeground("#11143A"),
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
  },
  stateText: {
    color: themeForeground("#77758B"),
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  footer: {
    marginTop: 28,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  footerText: {
    color: themeForeground("#858298"),
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  glowTop: {
    position: "absolute",
    top: -170,
    right: -180,
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: "rgba(231, 213, 255, 0.30)",
  },
  ringTop: {
    position: "absolute",
    top: 118,
    right: -120,
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 1,
    borderColor: "rgba(220, 198, 248, 0.35)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -260,
    left: -255,
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(226, 211, 255, 0.30)",
  },
}));
