import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Preference = {
  user_id: string;
  push_enabled: boolean;
  reminder_push: boolean;
  support_push: boolean;
  coaching_push: boolean;
  care_team_push: boolean;
  task_push: boolean;
  coordination_push: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
};

type PushDevice = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: "ios" | "android";
};

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function categoryEnabled(pref: Preference, kind: string) {
  if (kind === "care_reminder_due") return pref.reminder_push;
  if (kind.startsWith("care_task_") || kind.startsWith("care_shift_")) return pref.task_push;
  if (kind.startsWith("care_coordination_")) return pref.coordination_push;
  if (kind.includes("coaching")) return pref.coaching_push;
  if (kind.includes("support") || kind.includes("reply")) return pref.support_push;
  if (
    kind.includes("care_") ||
    kind.includes("invite") ||
    kind.includes("sharing")
  ) {
    return pref.care_team_push;
  }
  return true;
}

function hhmmToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function localMinutes(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    return 0;
  }
}

function withinQuietHours(pref: Preference) {
  if (!pref.quiet_hours_enabled) return false;

  const start = hhmmToMinutes(pref.quiet_start);
  const end = hhmmToMinutes(pref.quiet_end);
  if (start === null || end === null) return false;
  if (start === end) return true;

  const now = localMinutes(pref.timezone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function screenFor(notification: NotificationRow) {
  if (notification.entity_type === "care_reminder") return "CareCalendar";
  if (
    notification.entity_type === "care_task" ||
    notification.entity_type === "care_shift_handoff"
  ) return "CareShiftBoard";
  if (
    notification.entity_type === "care_shift" ||
    notification.entity_type === "care_shift_swap"
  ) return "CareSchedule";
  if (notification.entity_type === "support_request") return "TeamConversation";
  if (notification.entity_type === "coaching_request") return "Coaching";
  if (notification.entity_type === "care_recipient") return "CareTeam";
  if (notification.entity_type === "care_family_update") return "FamilyCommunication";
  if (notification.entity_type === "care_document") return "CareDocuments";
  if (
    notification.entity_type === "care_coordination_resolution" ||
    notification.entity_type === "care_coordination_digest"
  ) return "CareCoordinationInbox";
  if (notification.entity_type === "care_weekly_coverage_slot") {
    return "WeeklyCoveragePlan";
  }
  if (notification.entity_type === "care_coverage_forecast") {
    return "CoverageForecast";
  }
  return "Notifications";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const dispatchSecret =
    req.headers.get("x-envizion-cron-secret")?.trim() ?? "";
  if (!dispatchSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration unavailable" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: secretAccepted, error: secretError } = await admin.rpc(
      "verify_push_dispatch_secret",
      { candidate: dispatchSecret },
    );

    if (secretError || secretAccepted !== true) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: devices, error: deviceError } = await admin
      .from("push_devices")
      .select("id, user_id, expo_push_token, platform")
      .eq("enabled", true);

    if (deviceError) throw deviceError;
    if (!devices?.length) return json({ sent: 0, skipped: 0 });

    const userIds = [...new Set(devices.map((device) => device.user_id))];

    const { data: preferences, error: preferenceError } = await admin
      .from("notification_preferences")
      .select(
        "user_id, push_enabled, reminder_push, support_push, coaching_push, care_team_push, task_push, coordination_push, quiet_hours_enabled, quiet_start, quiet_end, timezone",
      )
      .in("user_id", userIds);

    if (preferenceError) throw preferenceError;

    const prefMap = new Map(
      (preferences ?? []).map((pref) => [pref.user_id, pref as Preference]),
    );

    const eligibleUsers = userIds.filter((userId) => {
      const pref = prefMap.get(userId);
      return Boolean(pref?.push_enabled && !withinQuietHours(pref));
    });

    if (!eligibleUsers.length) return json({ sent: 0, skipped: devices.length });

    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const { data: notifications, error: notificationError } = await admin
      .from("notifications")
      .select("id, user_id, kind, title, body, entity_type, entity_id, created_at")
      .in("user_id", eligibleUsers)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (notificationError) throw notificationError;
    if (!notifications?.length) return json({ sent: 0, skipped: 0 });

    const notificationIds = notifications.map((item) => item.id);
    const deviceIds = devices.map((device) => device.id);

    const { data: attempts, error: attemptError } = await admin
      .from("push_delivery_attempts")
      .select("notification_id, device_id")
      .in("notification_id", notificationIds)
      .in("device_id", deviceIds);

    if (attemptError) throw attemptError;

    const existing = new Set(
      (attempts ?? []).map(
        (attempt) => `${attempt.notification_id}:${attempt.device_id}`,
      ),
    );

    const devicesByUser = new Map<string, PushDevice[]>();
    for (const device of devices as PushDevice[]) {
      const list = devicesByUser.get(device.user_id) ?? [];
      list.push(device);
      devicesByUser.set(device.user_id, list);
    }

    const jobs: Array<{
      notification: NotificationRow;
      device: PushDevice;
      message: Record<string, unknown>;
    }> = [];

    for (const notification of notifications as NotificationRow[]) {
      const pref = prefMap.get(notification.user_id);
      if (!pref || !pref.push_enabled || withinQuietHours(pref)) continue;
      if (!categoryEnabled(pref, notification.kind)) continue;

      for (const device of devicesByUser.get(notification.user_id) ?? []) {
        if (existing.has(`${notification.id}:${device.id}`)) continue;

        jobs.push({
          notification,
          device,
          message: {
            to: device.expo_push_token,
            sound: "default",
            title: notification.title,
            body: notification.body,
            priority: "default",
            channelId: device.platform === "android" ? "care-updates" : undefined,
            data: {
              notificationId: notification.id,
              kind: notification.kind,
              entityType: notification.entity_type,
              entityId: notification.entity_id,
              screen: screenFor(notification),
            },
          },
        });
      }
    }

    let sent = 0;
    let errors = 0;

    for (let offset = 0; offset < jobs.length; offset += 100) {
      const batch = jobs.slice(offset, offset + 100);
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch.map((job) => job.message)),
      });

      if (!response.ok) {
        throw new Error(`Expo Push Service returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      const tickets = Array.isArray(payload?.data) ? payload.data : [];

      for (let index = 0; index < batch.length; index += 1) {
        const job = batch[index];
        const ticket = tickets[index] ?? {
          status: "error",
          message: "Missing Expo push ticket",
        };
        const ok = ticket.status === "ok";

        const { error: insertError } = await admin
          .from("push_delivery_attempts")
          .insert({
            notification_id: job.notification.id,
            device_id: job.device.id,
            user_id: job.notification.user_id,
            status: ok ? "sent" : "error",
            expo_ticket_id: ok ? ticket.id ?? null : null,
            response: ticket,
          });

        if (insertError && insertError.code !== "23505") throw insertError;

        if (ok) {
          sent += 1;
        } else {
          errors += 1;

          if (ticket?.details?.error === "DeviceNotRegistered") {
            await admin
              .from("push_devices")
              .update({ enabled: false })
              .eq("id", job.device.id);
          }
        }
      }
    }

    return json({ sent, errors, considered: jobs.length });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected push dispatch error",
      },
      500,
    );
  }
});
