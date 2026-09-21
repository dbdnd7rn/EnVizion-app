import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { supabase } from "./supabase";

export type NativePushSetup =
  | { status: "enabled"; token: string }
  | { status: "web" }
  | { status: "denied" }
  | { status: "missing_project_id" }
  | { status: "unavailable"; message: string };

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

async function notificationsModule() {
  return import("expo-notifications");
}

async function permissionGranted(requestIfNeeded: boolean) {
  const Notifications = await notificationsModule();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("care-updates", {
      name: "Care updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: "#7B428E",
    });
  }

  let permission = await Notifications.getPermissionsAsync();

  const iosAllowed =
    Platform.OS === "ios" &&
    permission.ios &&
    [
      Notifications.IosAuthorizationStatus.AUTHORIZED,
      Notifications.IosAuthorizationStatus.PROVISIONAL,
      Notifications.IosAuthorizationStatus.EPHEMERAL,
    ].includes(permission.ios.status);

  if (permission.granted || iosAllowed) return true;
  if (!requestIfNeeded) return false;

  permission = await Notifications.requestPermissionsAsync();

  const requestedIosAllowed =
    Platform.OS === "ios" &&
    permission.ios &&
    [
      Notifications.IosAuthorizationStatus.AUTHORIZED,
      Notifications.IosAuthorizationStatus.PROVISIONAL,
      Notifications.IosAuthorizationStatus.EPHEMERAL,
    ].includes(permission.ios.status);

  return Boolean(permission.granted || requestedIosAllowed);
}

export async function configureNativeNotificationBehavior() {
  if (Platform.OS === "web") return;

  const Notifications = await notificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export async function registerNativePush(
  requestPermission: boolean,
): Promise<NativePushSetup> {
  if (Platform.OS === "web") return { status: "web" };

  try {
    const allowed = await permissionGranted(requestPermission);
    if (!allowed) return { status: "denied" };

    const id = projectId();
    if (!id) return { status: "missing_project_id" };

    const Notifications = await notificationsModule();
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: id,
      })
    ).data;

    const { data, error } = await supabase.functions.invoke(
      "device-registration",
      {
        body: {
          action: "register",
          expoPushToken: token,
          platform: Platform.OS,
          deviceLabel:
            Platform.OS === "ios" ? "Apple device" : "Android device",
        },
      },
    );

    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));

    return { status: "enabled", token };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error
          ? error.message
          : "Native push registration is unavailable.",
    };
  }
}

export async function disableNativePushDevices() {
  if (Platform.OS === "web") return;

  const { data, error } = await supabase.functions.invoke(
    "device-registration",
    {
      body: { action: "disable_all" },
    },
  );

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}

export async function setNativeBadgeCount(count: number) {
  if (Platform.OS === "web") return;

  try {
    const Notifications = await notificationsModule();
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Badge support varies by launcher and device configuration.
  }
}

export async function openNotificationSystemSettings() {
  if (Platform.OS === "web") return;
  await Linking.openSettings();
}
