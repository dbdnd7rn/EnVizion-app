import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Text,
  View,
} from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { Lora_500Medium } from "@expo-google-fonts/lora";
import { AuthProvider, AuthScreen, PasswordRecoveryScreen, useAuth } from "./src/auth";
import { CareProvider } from "./src/store";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import {
  AssistantScreen,
  HandoffScreen,
  TeamConversationScreen,
} from "./src/screens/ConversationScreens";
import type { RootStack, Tabs } from "./src/navigation";
import { C, Icon } from "./src/ui";
import { NotificationsProvider } from "./src/notifications";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { CareTeamScreen } from "./src/screens/CareTeamScreen";
import { getStaffMembership, type StaffMembership } from "./src/staff";
import {
  StaffSupportThreadScreen,
  StaffWorkspaceScreen,
} from "./src/screens/StaffScreens";
import { StaffManagementScreen } from "./src/screens/StaffManagementScreen";
import {
  ClinicalContentEditorScreen,
  StaffClinicalContentScreen,
} from "./src/screens/StaffClinicalContentScreens";
import {
  HomeScreen,
  ToolkitScreen,
  LibraryScreen,
  SupportScreen,
} from "./src/screens/MainScreens";
import {
  TrackerScreen,
  MedicationScreen,
  AppointmentScreen,
  TransitionScreen,
  EmergencyScreen,
} from "./src/screens/CareScreens";
import {
  OnboardingScreen,
  GuideScreen,
  SpecialistsScreen,
  SpecialistScreen,
  CoachingScreen,
  WellnessScreen,
  ResourcesScreen,
  ProfileScreen,
} from "./src/screens/SupportScreens";

const Stack = createNativeStackNavigator<RootStack>();
const StaffStack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator<Tabs>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: "#8B8091",
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.line,
          height: 76,
          paddingTop: 10,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: "DMSans_600SemiBold",
          fontSize: 10,
          marginTop: 3,
        },
        tabBarIcon: ({ color, focused }) => (
          <Icon
            name={
              {
                Home: focused ? "home" : "home-outline",
                Toolkit: focused ? "grid" : "grid-outline",
                Library: focused ? "book" : "book-outline",
                Support: focused ? "heart" : "heart-outline",
              }[route.name]
            }
            color={color}
            size={22}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Toolkit" component={ToolkitScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Support" component={SupportScreen} />
    </Tab.Navigator>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function LoadingState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.paper,
      }}
    >
      <ActivityIndicator color={C.purple} />
      <Text style={{ marginTop: 12, color: C.deep }}>
        Preparing your care companion…
      </Text>
    </View>
  );
}

function SignedInApp({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <NotificationsProvider>
      <CareProvider>
        <NavigationContainer
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: C.paper,
            primary: C.purple,
            card: C.paper,
            text: C.ink,
            border: C.line,
          },
        }}
      >
        <Stack.Navigator
          initialRouteName="Onboarding"
          screenOptions={{
            headerStyle: { backgroundColor: C.paper },
            headerShadowVisible: false,
            headerTintColor: C.purple,
            headerTitleStyle: {
              fontFamily: "DMSans_600SemiBold",
              fontSize: 15,
            },
            headerBackTitle: "Back",
            contentStyle: { backgroundColor: C.paper },
            animation: reducedMotion ? "none" : "fade",
          }}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Tracker"
            component={TrackerScreen}
            options={{ title: "Daily care" }}
          />
          <Stack.Screen
            name="Assistant"
            component={AssistantScreen}
            options={{ title: "Your assistant" }}
          />
          <Stack.Screen
            name="Handoff"
            component={HandoffScreen}
            options={{ title: "Talk to our team" }}
          />
          <Stack.Screen
            name="TeamConversation"
            component={TeamConversationScreen}
            options={{ title: "Team conversation" }}
          />
          <Stack.Screen
            name="Medications"
            component={MedicationScreen}
            options={{ title: "Medication logs" }}
          />
          <Stack.Screen
            name="Summary"
            component={SummaryScreen}
            options={{ title: "Care summary" }}
          />
          <Stack.Screen
            name="Appointments"
            component={AppointmentScreen}
            options={{ title: "Appointment prep" }}
          />
          <Stack.Screen
            name="Transition"
            component={TransitionScreen}
            options={{ title: "Transitioning home" }}
          />
          <Stack.Screen
            name="Emergency"
            component={EmergencyScreen}
            options={{ title: "Get help" }}
          />
          <Stack.Screen
            name="Guide"
            component={GuideScreen}
            options={{ title: "Your resource library" }}
          />
          <Stack.Screen
            name="Specialists"
            component={SpecialistsScreen}
            options={{ title: "Healthcare navigation" }}
          />
          <Stack.Screen
            name="Specialist"
            component={SpecialistScreen}
            options={{ title: "Specialist guide" }}
          />
          <Stack.Screen
            name="Coaching"
            component={CoachingScreen}
            options={{ title: "Advocate coaching" }}
          />
          <Stack.Screen
            name="Wellness"
            component={WellnessScreen}
            options={{ title: "Spiritual Wellness" }}
          />
          <Stack.Screen
            name="Resources"
            component={ResourcesScreen}
            options={{ title: "Trusted resources" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: "Your profile" }}
          />
          <Stack.Screen
            name="CareTeam"
            component={CareTeamScreen}
            options={{ title: "Care team & sharing" }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: "Notifications" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      </CareProvider>
    </NotificationsProvider>
  );
}

function StaffSignedInApp({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <NotificationsProvider>
      <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: C.paper,
          primary: C.purple,
          card: C.paper,
          text: C.ink,
          border: C.line,
        },
      }}
    >
      <StaffStack.Navigator
        initialRouteName="StaffWorkspace"
        screenOptions={{
          headerStyle: { backgroundColor: C.paper },
          headerShadowVisible: false,
          headerTintColor: C.purple,
          headerTitleStyle: {
            fontFamily: "DMSans_600SemiBold",
            fontSize: 15,
          },
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: C.paper },
          animation: reducedMotion ? "none" : "fade",
        }}
      >
        <StaffStack.Screen
          name="StaffWorkspace"
          component={StaffWorkspaceScreen}
          options={{ headerShown: false }}
        />
        <StaffStack.Screen
          name="StaffManagement"
          component={StaffManagementScreen}
          options={{ title: "Manage staff" }}
        />
        <StaffStack.Screen
          name="ClinicalContent"
          component={StaffClinicalContentScreen}
          options={{ title: "Clinical content" }}
        />
        <StaffStack.Screen
          name="ClinicalContentEditor"
          component={ClinicalContentEditorScreen}
          options={{ title: "Content review" }}
        />
        <StaffStack.Screen
          name="StaffSupportThread"
          component={StaffSupportThreadScreen}
          options={{ title: "Support conversation" }}
        />
        <StaffStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Notifications" }}
        />
      </StaffStack.Navigator>
    </NavigationContainer>
    </NotificationsProvider>
  );
}

function AuthGate({ reducedMotion }: { reducedMotion: boolean }) {
  const { session, loading, recoveryMode } = useAuth();
  const [staff, setStaff] = useState<StaffMembership | null>(null);
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");

  useEffect(() => {
    let active = true;

    if (!session) {
      setStaff(null);
      setStaffError("");
      setCheckingStaff(false);
      return () => {
        active = false;
      };
    }

    setCheckingStaff(true);
    setStaffError("");

    getStaffMembership()
      .then((membership) => {
        if (!active) return;
        setStaff(membership);
      })
      .catch(() => {
        if (!active) return;
        setStaff(null);
        setStaffError(
          "We could not verify your workspace access. Check your connection and sign in again.",
        );
      })
      .finally(() => {
        if (active) setCheckingStaff(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (loading || (session && checkingStaff && !recoveryMode)) return <LoadingState />;
  if (session && recoveryMode) return <PasswordRecoveryScreen />;
  if (!session) return <AuthScreen />;

  if (staffError) {
    return (
      <View
        style={{
          flex: 1,
          padding: 28,
          justifyContent: "center",
          backgroundColor: C.paper,
          gap: 14,
        }}
      >
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 24,
            color: C.ink,
          }}
        >
          Workspace verification failed
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 22,
            color: C.muted,
          }}
        >
          {staffError}
        </Text>
      </View>
    );
  }

  if (staff) return <StaffSignedInApp reducedMotion={reducedMotion} />;

  return <SignedInApp reducedMotion={reducedMotion} />;
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Lora_500Medium,
  });

  if (!loaded && !error) return <LoadingState />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View
        style={{ flex: 1, backgroundColor: "#EDE5EF", alignItems: "center" }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 480,
            flex: 1,
            backgroundColor: C.paper,
            ...(Platform.OS === "web"
              ? { boxShadow: "0 0 80px #59306818" }
              : {}),
          }}
        >
          <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
            <AuthProvider>
              <AuthGate reducedMotion={reducedMotion} />
            </AuthProvider>
          </SafeAreaView>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
