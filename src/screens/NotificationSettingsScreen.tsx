import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Switch, Text, View } from "react-native";
import {
  loadNotificationPreferences,
  notificationTimezone,
  saveNotificationPreferences,
  validQuietTime,
  type NotificationPreferences,
} from "../notificationPreferences";
import {
  disableNativePushDevices,
  openNotificationSystemSettings,
  registerNativePush,
} from "../nativePush";
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

function PreferenceSwitch({
  title,
  body,
  value,
  disabled,
  onChange,
}: {
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Card>
      <View style={S.between}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={S.h3}>{title}</Text>
          <Txt style={S.small}>{body}</Txt>
        </View>
        <Switch
          accessibilityLabel={title}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: C.purple }}
        />
      </View>
    </Card>
  );
}

export function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    loadNotificationPreferences()
      .then((value) => {
        if (active) setPrefs(value);
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "We could not load notification preferences.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function persist(
    next: NotificationPreferences,
    success = "Notification preferences saved.",
  ) {
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveNotificationPreferences(next);
      setPrefs(saved);
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save notification preferences.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePush(enabled: boolean) {
    if (!prefs) return;

    setBusy(true);
    setMessage("");

    try {
      if (!enabled) {
        await disableNativePushDevices();
        const saved = await saveNotificationPreferences({
          ...prefs,
          pushEnabled: false,
        });
        setPrefs(saved);
        setMessage("Native push notifications are off for this account.");
        return;
      }

      const result = await registerNativePush(true);

      if (result.status === "web") {
        setMessage(
          "Push permission is managed from the installed iOS or Android app. Web notifications remain available inside EnVizion Life.",
        );
        return;
      }

      if (result.status === "denied") {
        setMessage(
          "Notification permission was not granted. You can change it later in your device settings.",
        );
        return;
      }

      if (result.status === "missing_project_id") {
        setMessage(
          "This native build is not connected to EnVizion Life’s push project yet. In-app notifications still work normally.",
        );
        return;
      }

      if (result.status === "unavailable") {
        setMessage(result.message);
        return;
      }

      const saved = await saveNotificationPreferences({
        ...prefs,
        pushEnabled: true,
        timezone: notificationTimezone(),
      });
      setPrefs(saved);
      setMessage("Native push notifications are enabled on this device.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update native push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !prefs) {
    return (
      <Page>
        <Heading
          eyebrow="NOTIFICATION PREFERENCES"
          title="Choose how EnVizion gets your attention."
        />
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading notification preferences…</Txt>
        </Card>
        {Boolean(message) && <Txt>{message}</Txt>}
      </Page>
    );
  }

  const quietTimesValid =
    validQuietTime(prefs.quietStart) && validQuietTime(prefs.quietEnd);

  return (
    <Page>
      <Heading
        eyebrow="NOTIFICATION PREFERENCES"
        title="Useful updates, on your terms."
        body="Choose which updates can reach your device and when EnVizion should stay quiet."
      />

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.white }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Native push" />
      <PreferenceSwitch
        title="Push notifications"
        body={
          Platform.OS === "web"
            ? "Available from an installed iOS or Android build. In-app notifications continue on web."
            : "Allow EnVizion Life to send selected account updates to this device."
        }
        value={prefs.pushEnabled}
        disabled={busy || Platform.OS === "web"}
        onChange={(value) => void changePush(value)}
      />

      {Platform.OS !== "web" && (
        <Button
          title="Open device notification settings"
          secondary
          icon="settings-outline"
          disabled={busy}
          onPress={() => void openNotificationSystemSettings()}
        />
      )}

      <Section title="What can be pushed?" />
      <PreferenceSwitch
        title="Care reminders"
        body="Due reminders from your shared Care Calendar."
        value={prefs.reminderPush}
        disabled={busy}
        onChange={(value) =>
          void persist({ ...prefs, reminderPush: value })
        }
      />
      <PreferenceSwitch
        title="Support replies"
        body="Updates from EnVizion support and advocate conversations."
        value={prefs.supportPush}
        disabled={busy}
        onChange={(value) =>
          void persist({ ...prefs, supportPush: value })
        }
      />
      <PreferenceSwitch
        title="Coaching updates"
        body="Scheduling and status updates for advocate coaching."
        value={prefs.coachingPush}
        disabled={busy}
        onChange={(value) =>
          void persist({ ...prefs, coachingPush: value })
        }
      />
      <PreferenceSwitch
        title="Care-team updates"
        body="Care invitations, access changes, and shared-care updates."
        value={prefs.careTeamPush}
        disabled={busy}
        onChange={(value) =>
          void persist({ ...prefs, careTeamPush: value })
        }
      />

      <Section title="Quiet hours" />
      <PreferenceSwitch
        title="Pause push during quiet hours"
        body="Notifications remain in EnVizion Life and can be pushed after quiet hours end."
        value={prefs.quietHoursEnabled}
        disabled={busy}
        onChange={(value) =>
          void persist({
            ...prefs,
            quietHoursEnabled: value,
            timezone: notificationTimezone(),
          })
        }
      />

      {prefs.quietHoursEnabled && (
        <Card>
          <Field
            label="Quiet starts (HH:MM, 24-hour)"
            value={prefs.quietStart}
            onChange={(value) => setPrefs({ ...prefs, quietStart: value })}
          />
          <Field
            label="Quiet ends (HH:MM, 24-hour)"
            value={prefs.quietEnd}
            onChange={(value) => setPrefs({ ...prefs, quietEnd: value })}
          />
          <Txt style={S.small}>Timezone: {notificationTimezone()}</Txt>
          <Button
            title={busy ? "Saving quiet hours…" : "Save quiet hours"}
            disabled={busy || !quietTimesValid}
            onPress={() =>
              void persist(
                {
                  ...prefs,
                  timezone: notificationTimezone(),
                },
                "Quiet hours saved.",
              )
            }
          />
          {!quietTimesValid && (
            <Text style={[S.small, { color: C.rose }]}>
              Use a valid 24-hour time such as 22:00 or 07:30.
            </Text>
          )}
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="shield-checkmark-outline" />
        <Text style={S.h3}>Important</Text>
        <Txt>
          Push notifications are convenience alerts, not emergency monitoring.
          A delayed, muted, or unavailable push notification must never be used
          as confirmation that urgent care is or is not needed.
        </Txt>
      </Card>
    </Page>
  );
}
