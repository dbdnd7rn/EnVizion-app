import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "./supabase";
import { C, Icon, S } from "./ui";

export type NotificationRecord = {
  id: string;
  audience: "caregiver" | "staff";
  kind: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsContextValue = {
  items: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

function mapRow(row: any): NotificationRecord {
  return {
    id: row.id,
    audience: row.audience,
    kind: row.kind,
    title: row.title,
    body: row.body,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, audience, kind, title, body, entity_type, entity_id, read_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setItems((data ?? []).map(mapRow));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) {
        setLoading(false);
        return;
      }

      await refresh();

      if (!active) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const next = payload.new && Object.keys(payload.new).length
              ? mapRow(payload.new)
              : null;

            if (!next) return;

            setItems((current) => {
              const remaining = current.filter((item) => item.id !== next.id);
              return [next, ...remaining].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );
            });
          },
        )
        .subscribe();
    }

    void start();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id);

    if (error) throw error;

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt } : item,
      ),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .is("read_at", null);

    if (error) throw error;

    setItems((current) =>
      current.map((item) =>
        item.readAt ? item : { ...item, readAt },
      ),
    );
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount: items.filter((item) => !item.readAt).length,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, loading, markAllRead, markRead, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("Missing NotificationsProvider");
  }
  return context;
}

export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      onPress={onPress}
      style={{
        width: 43,
        height: 43,
        borderRadius: 22,
        backgroundColor: C.lavender,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="notifications-outline" size={21} />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 19,
            height: 19,
            paddingHorizontal: 5,
            borderRadius: 10,
            backgroundColor: C.rose,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: C.paper,
          }}
        >
          <Text
            style={[
              S.small,
              {
                color: C.white,
                fontSize: 10,
                lineHeight: 12,
                fontFamily: "DMSans_700Bold",
              },
            ]}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
