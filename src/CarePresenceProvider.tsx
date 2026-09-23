import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./auth";
import {
  clearCareWorkspacePresence,
  loadCareWorkspacePresence,
  presenceIsLive,
  touchCareWorkspacePresence,
  type CarePresenceMode,
  type CareWorkspacePresence,
} from "./carePresence";
import { supabase } from "./supabase";
import { useCare } from "./store";

type PresenceActivity = {
  mode: CarePresenceMode;
  screenKey: string;
  sessionId: string | null;
};

type CarePresenceContextValue = {
  presence: CareWorkspacePresence[];
  livePresence: CareWorkspacePresence[];
  setActivity: (activity: Partial<PresenceActivity>) => void;
  refresh: () => Promise<void>;
};

const CarePresenceContext = createContext<CarePresenceContextValue | null>(null);

const defaultActivity: PresenceActivity = {
  mode: "workspace",
  screenKey: "care_workspace",
  sessionId: null,
};

export function CarePresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const [presence, setPresence] = useState<CareWorkspacePresence[]>([]);
  const [activity, setActivityState] =
    useState<PresenceActivity>(defaultActivity);
  const [clock, setClock] = useState(() => Date.now());
  const activityRef = useRef(activity);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setPresence([]);
      return;
    }

    try {
      setPresence(await loadCareWorkspacePresence(careRecipientId));
    } catch {
      // Presence is coordination convenience and must not block care workflows.
    }
  }, [careRecipientId]);

  const heartbeat = useCallback(async () => {
    if (!careRecipientId || !user?.id) return;

    try {
      await touchCareWorkspacePresence({
        careRecipientId,
        userId: user.id,
        ...activityRef.current,
      });
    } catch {
      // A missed heartbeat should age out naturally instead of blocking the app.
    }
  }, [careRecipientId, user?.id]);

  const setActivity = useCallback((next: Partial<PresenceActivity>) => {
    setActivityState((current) => ({
      ...current,
      ...next,
      sessionId:
        Object.prototype.hasOwnProperty.call(next, "sessionId")
          ? next.sessionId ?? null
          : current.sessionId,
    }));
  }, []);

  useEffect(() => {
    if (!careRecipientId || !user?.id) {
      setPresence([]);
      return;
    }

    let active = true;
    void heartbeat();
    void refresh();

    const heartbeatTimer = setInterval(() => {
      if (active) void heartbeat();
    }, 60_000);

    const clockTimer = setInterval(() => {
      if (active) setClock(Date.now());
    }, 30_000);

    const channel = supabase
      .channel(`care-presence:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_workspace_presence",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => {
          if (active) void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(heartbeatTimer);
      clearInterval(clockTimer);
      void supabase.removeChannel(channel);
      void clearCareWorkspacePresence(careRecipientId, user.id).catch(() => {
        // Stale rows age out and are cleaned server-side if disconnect cleanup fails.
      });
    };
  }, [careRecipientId, heartbeat, refresh, user?.id]);

  useEffect(() => {
    void heartbeat();
  }, [activity.mode, activity.screenKey, activity.sessionId, heartbeat]);

  const livePresence = useMemo(() => {
    const now = new Date(clock);
    return presence.filter((item) => presenceIsLive(item, now));
  }, [clock, presence]);

  const value = useMemo<CarePresenceContextValue>(
    () => ({
      presence,
      livePresence,
      setActivity,
      refresh,
    }),
    [livePresence, presence, refresh, setActivity],
  );

  return (
    <CarePresenceContext.Provider value={value}>
      {children}
    </CarePresenceContext.Provider>
  );
}

export function useCarePresence() {
  const value = useContext(CarePresenceContext);
  if (!value) {
    throw new Error("useCarePresence must be used inside CarePresenceProvider.");
  }
  return value;
}
