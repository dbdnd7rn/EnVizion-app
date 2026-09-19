import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useNotifications, type NotificationRecord } from "../notifications";
import { Button, C, Card, Heading, Icon, Page, S, Txt } from "../ui";
import { useNav } from "./MainScreens";

function iconFor(item: NotificationRecord) {
  if (item.kind.includes("reply")) return "chatbubble-ellipses-outline";
  if (item.kind.includes("coaching")) return "people-outline";
  if (item.kind.includes("support")) return "heart-outline";
  return "notifications-outline";
}

export function NotificationsScreen() {
  const n = useNav();
  const {
    items,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [message, setMessage] = useState("");

  async function openNotification(item: NotificationRecord) {
    setMessage("");
    try {
      if (!item.readAt) await markRead(item.id);

      if (item.audience === "staff") {
        if (item.entityType === "support_request" && item.entityId) {
          n.navigate("StaffSupportThread", { requestId: item.entityId });
          return;
        }
        n.navigate("StaffWorkspace");
        return;
      }

      if (item.entityType === "support_request") {
        n.navigate("TeamConversation");
        return;
      }

      if (item.entityType === "coaching_request") {
        n.navigate("Coaching");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not open that notification.",
      );
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="STAY IN THE LOOP"
        title="Notifications"
        body={
          unreadCount
            ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} need your attention.`
            : "You’re all caught up."
        }
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Refresh"
            secondary
            icon="refresh-outline"
            onPress={() => void refresh()}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Mark all read"
            secondary
            disabled={!unreadCount}
            icon="checkmark-done-outline"
            onPress={async () => {
              setMessage("");
              try {
                await markAllRead();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not update your notifications.",
                );
              }
            }}
          />
        </View>
      </View>

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message}
          </Text>
        </Card>
      )}

      {loading && !items.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading notifications…</Txt>
        </Card>
      ) : !items.length ? (
        <Card>
          <Icon name="notifications-off-outline" size={30} />
          <Text style={S.h3}>No notifications yet.</Text>
          <Txt>
            Support replies, request updates, and new staff work will appear
            here automatically.
          </Txt>
        </Card>
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            onPress={() => void openNotification(item)}
            label={item.title}
            style={{
              borderColor: item.readAt ? C.line : "#D7C3E1",
              backgroundColor: item.readAt ? C.white : "#F6F0F8",
            }}
          >
            <View style={{ flexDirection: "row", gap: 13 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: C.lavender,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={iconFor(item)} size={21} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={S.between}>
                  <Text style={S.h3}>{item.title}</Text>
                  {!item.readAt && (
                    <View
                      accessibilityLabel="Unread"
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: C.rose,
                      }}
                    />
                  )}
                </View>
                <Txt style={{ color: C.ink }}>{item.body}</Txt>
                <Text style={S.small}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <Txt style={S.small}>
        Notifications are account-specific and update in real time while the
        app is open. They are not emergency monitoring.
      </Txt>
    </Page>
  );
}
