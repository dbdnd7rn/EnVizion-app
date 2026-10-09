import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { AppearanceProvider, themedScreen, useAppearance } from "./src/appearance";
import { themeBackground } from "./src/themeColors";
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
import { withStartupTimeout } from "./src/startupTimeout";
import { CareProvider } from "./src/store";
import { ProfileAvatarProvider } from "./src/profileAvatar";
import { ProfileDashboardScreen } from "./src/screens/ProfileDashboardScreen";
import { CarePresenceProvider } from "./src/CarePresenceProvider";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { CareInsightsScreen } from "./src/screens/CareInsightsScreen";
import { CareCalendarScreen } from "./src/screens/CareCalendarScreen";
import { CareDocumentsScreen } from "./src/screens/CareDocumentsScreen";
import { CareContactsScreen } from "./src/screens/CareContactsScreen";
import { CareCommunicationLogScreen } from "./src/screens/CareCommunicationLogScreen";
import { FamilyCommunicationScreen } from "./src/screens/FamilyCommunicationScreen";
import { EmergencyCenterScreen } from "./src/screens/EmergencyCenterScreen";
import { CareTasksScreen } from "./src/screens/CareTasksScreen";
import { DoctorVisitCompanionScreen } from "./src/screens/DoctorVisitCompanionScreen";
import { CareShiftBoardScreen } from "./src/screens/CareShiftBoardScreen";
import { OnShiftCaregiverScreen } from "./src/screens/OnShiftCaregiverScreen";
import { CareScheduleScreen } from "./src/screens/CareScheduleScreen";
import { CareAnalyticsScreen } from "./src/screens/CareAnalyticsScreen";
import { CareCoordinationInboxScreen } from "./src/screens/CareCoordinationInboxScreen";
import { CareContinuityScreen } from "./src/screens/CareContinuityScreen";
import { CareCoverageRequestsScreen } from "./src/screens/CareCoverageRequestsScreen";
import { CoverageInsightsScreen } from "./src/screens/CoverageInsightsScreen";
import { CoverageForecastScreen } from "./src/screens/CoverageForecastScreen";
import { SmartCoveragePlannerScreen } from "./src/screens/SmartCoveragePlannerScreen";
import { WeeklyCoveragePlanScreen } from "./src/screens/WeeklyCoveragePlanScreen";
import { CareCoverageRequirementsScreen } from "./src/screens/CareCoverageRequirementsScreen";
import { CarePacketScreen } from "./src/screens/CarePacketScreen";
import { CarePlanScreen } from "./src/screens/CarePlanScreen";
import { MedicationManagementScreen } from "./src/screens/MedicationManagementScreen";
import { HospitalToHomeScreen } from "./src/screens/HospitalToHomeScreen";
import {
  AssistantScreen,
  HandoffScreen,
  TeamConversationScreen,
} from "./src/screens/ConversationScreens";
import type { RootStack, Tabs } from "./src/navigation";
import { C, Icon } from "./src/ui";
import { NotificationsProvider } from "./src/notifications";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { NotificationSettingsScreen } from "./src/screens/NotificationSettingsScreen";
import { CareTeamScreen } from "./src/screens/CareTeamScreen";
import { CareTeamActivityScreen } from "./src/screens/CareTeamActivityScreen";
import { CareTeamAccessReportScreen } from "./src/screens/CareTeamAccessReportScreen";
import { CareTeamSecurityReviewScreen } from "./src/screens/CareTeamSecurityReviewScreen";
import { CareTeamSecurityRemediationScreen } from "./src/screens/CareTeamSecurityRemediationScreen";
import { AdvocateHandoverScreen } from "./src/screens/AdvocateHandoverScreen";
import { CareAccessRecertificationScreen } from "./src/screens/CareAccessRecertificationScreen";
import { PrivacyDataScreen } from "./src/screens/PrivacyDataScreen";
import { AccessibilityScreen } from "./src/screens/AccessibilityScreen";
import { LaunchValidationScreen } from "./src/screens/LaunchValidationScreen";
import { PilotFeedbackScreen } from "./src/screens/PilotFeedbackScreen";
import { LaunchCenterScreen } from "./src/screens/LaunchCenterScreen";
import { PilotConsentGate } from "./src/PilotConsentGate";
import { PilotAdminScreen } from "./src/screens/PilotAdminScreen";
import { PilotIntelligenceScreen } from "./src/screens/PilotIntelligenceScreen";
import { AccessGovernanceAdminScreen } from "./src/screens/AccessGovernanceAdminScreen";
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
  AppointmentScreen,
} from "./src/screens/CareScreens";
import {
  OnboardingScreen,
  GuideScreen,
  SpecialistsScreen,
  SpecialistScreen,
  CoachingScreen,
  ResourcesScreen,
} from "./src/screens/SupportScreens";
import { WellnessScreen } from "./src/screens/WellnessScreen";

const Stack = createNativeStackNavigator<RootStack>();
const StaffStack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator<Tabs>();

function MainTabs() {
  const { dark } = useAppearance();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: dark ? "#A99DBB" : "#8A8494",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: dark ? "#211B2E" : "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: dark ? "#453750" : "#F0E9F1",
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
          shadowColor: dark ? "#000000" : "#2E2135",
          shadowOpacity: 0.035,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 5,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontFamily: "DMSans_600SemiBold",
          fontSize: 10,
          marginTop: 2,
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
            size={23}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={themedScreen(HomeScreen)}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="Toolkit"
        component={themedScreen(ToolkitScreen)}
        options={{ tabBarLabel: "Care" }}
      />
      <Tab.Screen
        name="Library"
        component={themedScreen(LibraryScreen)}
        options={{ tabBarLabel: "Learn" }}
      />
      <Tab.Screen
        name="Support"
        component={themedScreen(SupportScreen)}
        options={{ tabBarLabel: "Support" }}
      />
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

function LoadingState({ message = "Preparing your care companion…" }: { message?: string }) {
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
        {message}
      </Text>
    </View>
  );
}

function AnimatedLaunchScreen({ reducedMotion }: { reducedMotion: boolean }) {
  const reveal = React.useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const drift = React.useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) return;

    Animated.parallel([
      Animated.spring(reveal, {
        toValue: 1,
        damping: 12,
        stiffness: 95,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(drift, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [drift, reducedMotion, reveal]);

  return (
    <View
      accessibilityLabel="EnVizion Life is opening"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: themeBackground("#FCF9F6"),
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 290,
          height: 290,
          borderRadius: 145,
          borderWidth: 1,
          borderColor: "#7B428E24",
          opacity: drift.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.2, 0.8, 0.25],
          }),
          transform: [
            {
              scale: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [0.72, 1.18],
              }),
            },
            {
              rotate: drift.interpolate({
                inputRange: [0, 1],
                outputRange: ["-8deg", "8deg"],
              }),
            },
          ],
        }}
      />
      <Animated.View
        style={{
          alignItems: "center",
          opacity: reveal,
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
            {
              scale: reveal.interpolate({
                inputRange: [0, 0.72, 1],
                outputRange: [0.72, 1.06, 1],
              }),
            },
          ],
        }}
      >
        <Animated.Image
          source={require("./assets/envizion-original.png")}
          resizeMode="contain"
          style={{ width: 270, height: 168 }}
        />
        <Text
          style={{
            marginTop: 18,
            color: C.purple,
            fontFamily: "DMSans_700Bold",
            fontSize: 12,
            letterSpacing: 4,
          }}
        >
          CARE IN MOTION
        </Text>
      </Animated.View>
    </View>
  );
}

function SignedInApp({ reducedMotion }: { reducedMotion: boolean }) {
  const { dark } = useAppearance();
  return (
    <NotificationsProvider>
      <CareProvider>
        <CarePresenceProvider>
        <NavigationContainer
        theme={{
          ...(dark ? DarkTheme : DefaultTheme),
          colors: {
            ...(dark ? DarkTheme.colors : DefaultTheme.colors),
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
            component={themedScreen(OnboardingScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Main"
            component={themedScreen(MainTabs)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Tracker"
            component={themedScreen(TrackerScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Insights"
            component={themedScreen(CareInsightsScreen)}
            options={{ title: "Care timeline & insights" }}
          />
          <Stack.Screen
            name="CareCalendar"
            component={themedScreen(CareCalendarScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CareDocuments"
            component={themedScreen(CareDocumentsScreen)}
            options={{ title: "Care Document Vault" }}
          />
          <Stack.Screen
            name="CareContacts"
            component={themedScreen(CareContactsScreen)}
            options={{ title: "Care contacts & providers" }}
          />
          <Stack.Screen
            name="CareCommunicationLog"
            component={themedScreen(CareCommunicationLogScreen)}
            options={{ title: "Provider & insurance communication" }}
          />
          <Stack.Screen
            name="FamilyCommunication"
            component={themedScreen(FamilyCommunicationScreen)}
            options={{ title: "Family communication" }}
          />
          <Stack.Screen
            name="CareTasks"
            component={themedScreen(CareTasksScreen)}
            options={{ title: "Care tasks & shared care plan" }}
          />
          <Stack.Screen
            name="CareShiftBoard"
            component={themedScreen(CareShiftBoardScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OnShiftCaregiver"
            component={themedScreen(OnShiftCaregiverScreen)}
            options={{ title: "On-shift caregiver" }}
          />
          <Stack.Screen
            name="CareSchedule"
            component={themedScreen(CareScheduleScreen)}
            options={{ title: "Caregiver availability & schedule" }}
          />
          <Stack.Screen
            name="CareAnalytics"
            component={themedScreen(CareAnalyticsScreen)}
            options={{ title: "Care coordination analytics" }}
          />
          <Stack.Screen
            name="CareCoordinationInbox"
            component={themedScreen(CareCoordinationInboxScreen)}
            options={{ title: "Needs coordination" }}
          />
          <Stack.Screen
            name="CareContinuity"
            component={themedScreen(CareContinuityScreen)}
            options={{ title: "Live care team & continuity" }}
          />
          <Stack.Screen
            name="CareCoverageRequirements"
            component={themedScreen(CareCoverageRequirementsScreen)}
            options={{ title: "Recurring care coverage" }}
          />
          <Stack.Screen
            name="WeeklyCoveragePlan"
            component={themedScreen(WeeklyCoveragePlanScreen)}
            options={{ title: "Weekly coverage approval" }}
          />
          <Stack.Screen
            name="SmartCoveragePlanner"
            component={themedScreen(SmartCoveragePlannerScreen)}
            options={{ title: "Smart Coverage Planner" }}
          />
          <Stack.Screen
            name="CoverageInsights"
            component={themedScreen(CoverageInsightsScreen)}
            options={{ title: "Caregiver coverage insights" }}
          />
          <Stack.Screen
            name="CoverageForecast"
            component={themedScreen(CoverageForecastScreen)}
            options={{ title: "Proactive coverage forecast" }}
          />
          <Stack.Screen
            name="CareCoverageRequests"
            component={themedScreen(CareCoverageRequestsScreen)}
            options={{ title: "Open caregiver coverage" }}
          />
          <Stack.Screen
            name="CarePacket"
            component={themedScreen(CarePacketScreen)}
            options={{ title: "Care packet & printable summary" }}
          />
          <Stack.Screen
            name="Assistant"
            component={themedScreen(AssistantScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Handoff"
            component={themedScreen(HandoffScreen)}
            options={{ title: "Talk to our team" }}
          />
          <Stack.Screen
            name="TeamConversation"
            component={themedScreen(TeamConversationScreen)}
            options={{ title: "Team conversation" }}
          />
          <Stack.Screen
            name="CarePlan"
            component={themedScreen(CarePlanScreen)}
            options={{ title: "Daily care plan", headerShown: false }}
          />
          <Stack.Screen
            name="Medications"
            component={themedScreen(MedicationManagementScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Summary"
            component={themedScreen(SummaryScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Appointments"
            component={themedScreen(AppointmentScreen)}
            options={{ title: "Appointment prep" }}
          />
          <Stack.Screen
            name="DoctorVisitCompanion"
            component={themedScreen(DoctorVisitCompanionScreen)}
            options={{ title: "Doctor Visit Companion" }}
          />
          <Stack.Screen
            name="Transition"
            component={themedScreen(HospitalToHomeScreen)}
            options={{ title: "Hospital to home" }}
          />
          <Stack.Screen
            name="Emergency"
            component={themedScreen(EmergencyCenterScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Guide"
            component={themedScreen(GuideScreen)}
            options={{ title: "Your resource library" }}
          />
          <Stack.Screen
            name="Specialists"
            component={themedScreen(SpecialistsScreen)}
            options={{ title: "Healthcare navigation" }}
          />
          <Stack.Screen
            name="Specialist"
            component={themedScreen(SpecialistScreen)}
            options={{ title: "Specialist guide" }}
          />
          <Stack.Screen
            name="Coaching"
            component={themedScreen(CoachingScreen)}
            options={{ title: "Advocate coaching" }}
          />
          <Stack.Screen
            name="Wellness"
            component={themedScreen(WellnessScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Resources"
            component={themedScreen(ResourcesScreen)}
            options={{ title: "Trusted resources" }}
          />
          <Stack.Screen
            name="Profile"
            component={themedScreen(ProfileDashboardScreen)}
            options={{ title: "Your profile" }}
          />
          <Stack.Screen
            name="PrivacyData"
            component={themedScreen(PrivacyDataScreen)}
            options={{ title: "Account, privacy & data" }}
          />
          <Stack.Screen
            name="Accessibility"
            component={themedScreen(AccessibilityScreen)}
            options={{ title: "Accessibility & display" }}
          />
          <Stack.Screen
            name="LaunchValidation"
            component={themedScreen(LaunchValidationScreen)}
            options={{ title: "Pilot launch validation" }}
          />
          <Stack.Screen
            name="PilotFeedback"
            component={themedScreen(PilotFeedbackScreen)}
            options={{ title: "Pilot feedback" }}
          />
          <Stack.Screen
            name="LaunchCenter"
            component={themedScreen(LaunchCenterScreen)}
            options={{ title: "Launch Center" }}
          />
          <Stack.Screen
            name="CareTeam"
            component={themedScreen(CareTeamScreen)}
            options={{ title: "Care team & sharing", headerShown: false }}
          />
          <Stack.Screen
            name="CareTeamActivity"
            component={themedScreen(CareTeamActivityScreen)}
            options={{ title: "Care team activity" }}
          />
          <Stack.Screen
            name="CareTeamAccessReport"
            component={themedScreen(CareTeamAccessReportScreen)}
            options={{ title: "Care team access report" }}
          />
          <Stack.Screen
            name="CareTeamSecurityReview"
            component={themedScreen(CareTeamSecurityReviewScreen)}
            options={{ title: "Care team security review" }}
          />
          <Stack.Screen
            name="CareTeamSecurityRemediation"
            component={themedScreen(CareTeamSecurityRemediationScreen)}
            options={{ title: "Security remediation" }}
          />
          <Stack.Screen name="AdvocateHandover" component={themedScreen(AdvocateHandoverScreen)} options={{ title: "Primary Advocate handover", headerShown: false }} />
          <Stack.Screen
            name="CareAccessRecertification"
            component={themedScreen(CareAccessRecertificationScreen)}
            options={{ title: "90-day access review", headerShown: false }}
          />
          <Stack.Screen
            name="Notifications"
            component={themedScreen(NotificationsScreen)}
            options={{ title: "Notifications", headerShown: false }}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={themedScreen(NotificationSettingsScreen)}
            options={{ title: "Notification preferences" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
        </CarePresenceProvider>
      </CareProvider>
    </NotificationsProvider>
  );
}

function StaffSignedInApp({ reducedMotion }: { reducedMotion: boolean }) {
  const { dark } = useAppearance();
  return (
    <NotificationsProvider>
      <NavigationContainer
      theme={{
          ...(dark ? DarkTheme : DefaultTheme),
          colors: {
            ...(dark ? DarkTheme.colors : DefaultTheme.colors),
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
          component={themedScreen(StaffWorkspaceScreen)}
          options={{ headerShown: false }}
        />
        <StaffStack.Screen
          name="StaffManagement"
          component={themedScreen(StaffManagementScreen)}
          options={{ title: "Manage staff" }}
        />
        <StaffStack.Screen
          name="PilotAdmin"
          component={themedScreen(PilotAdminScreen)}
          options={{ title: "Pilot administration" }}
        />
        <StaffStack.Screen
          name="PilotIntelligence"
          component={themedScreen(PilotIntelligenceScreen)}
          options={{ title: "Pilot intelligence" }}
        />
        <StaffStack.Screen
          name="AccessGovernanceAdmin"
          component={themedScreen(AccessGovernanceAdminScreen)}
          options={{ title: "Access governance" }}
        />
        <StaffStack.Screen
          name="ClinicalContent"
          component={themedScreen(StaffClinicalContentScreen)}
          options={{ title: "Clinical content" }}
        />
        <StaffStack.Screen
          name="ClinicalContentEditor"
          component={themedScreen(ClinicalContentEditorScreen)}
          options={{ title: "Content review" }}
        />
        <StaffStack.Screen
          name="StaffSupportThread"
          component={themedScreen(StaffSupportThreadScreen)}
          options={{ title: "Support conversation" }}
        />
        <StaffStack.Screen
          name="Notifications"
          component={themedScreen(NotificationsScreen)}
          options={{ title: "Notifications", headerShown: false }}
        />
        <StaffStack.Screen
          name="NotificationSettings"
          component={themedScreen(NotificationSettingsScreen)}
          options={{ title: "Notification preferences" }}
        />
      </StaffStack.Navigator>
    </NavigationContainer>
    </NotificationsProvider>
  );
}

function AuthGate({ reducedMotion }: { reducedMotion: boolean }) {
  const { session, loading, recoveryMode, startupError, retryStartup, signOut } = useAuth();
  const [staff, setStaff] = useState<StaffMembership | null>(null);
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [staffRetry, setStaffRetry] = useState(0);

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

    withStartupTimeout(
      getStaffMembership(session.user.id, false),
      9000,
      "Workspace verification is taking longer than expected.",
    )
      .then((membership) => {
        if (!active) return;
        setStaff(membership);
      })
      .catch((error) => {
        if (!active) return;
        setStaff(null);
        setStaffError(
          error instanceof Error
            ? error.message
            : "We could not verify your workspace access. Check your connection and try again.",
        );
      })
      .finally(() => {
        if (active) setCheckingStaff(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, staffRetry]);

  if (loading) return <LoadingState message="Checking your account…" />;

  if (startupError) {
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
        <Icon name="cloud-offline-outline" size={32} color={C.purple} />
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 23, color: C.ink }}>
          We couldn't finish opening your account.
        </Text>
        <Text accessibilityRole="alert" style={{ fontSize: 14, lineHeight: 21, color: C.muted }}>
          {startupError} Check your connection, then try again. Your care records have not been changed.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry account loading"
          onPress={retryStartup}
          style={({ pressed }) => ({
            minHeight: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: C.purple,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: C.white, fontFamily: "DMSans_700Bold" }}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  if (session && recoveryMode) return <PasswordRecoveryScreen />;
  if (!session) return <AuthScreen />;
  if (checkingStaff) return <LoadingState message="Checking workspace access…" />;

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry workspace verification"
          onPress={() => setStaffRetry((attempt) => attempt + 1)}
          style={({ pressed }) => ({
            minHeight: 52,
            borderRadius: 26,
            backgroundColor: C.purple,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: C.white, fontFamily: "DMSans_700Bold" }}>
            Try again
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => void signOut()}
          style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: C.purple, fontFamily: "DMSans_600SemiBold" }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    );
  }

  if (staff) return <StaffSignedInApp reducedMotion={reducedMotion} />;

  return (
    <ProfileAvatarProvider>
      <PilotConsentGate>
        <SignedInApp reducedMotion={reducedMotion} />
      </PilotConsentGate>
    </ProfileAvatarProvider>
  );
}

function AppShell() {
  const { dark, ready } = useAppearance();
  const reducedMotion = useReducedMotion();
  const [showLaunch, setShowLaunch] = useState(true);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Lora_500Medium,
  });

  useEffect(() => {
    if (loaded || error) return;
    const timeout = setTimeout(() => setFontsTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, [loaded, error]);

  const fontsReady = loaded || Boolean(error) || fontsTimedOut;

  useEffect(() => {
    if (!fontsReady) return;
    const timer = setTimeout(
      () => setShowLaunch(false),
      reducedMotion ? 300 : 950,
    );
    return () => clearTimeout(timer);
  }, [fontsReady, reducedMotion]);

  if (!fontsReady || !ready) return <LoadingState message="Loading app resources…" />;

  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? "light" : "dark"} />
      <View
        style={{ flex: 1, backgroundColor: dark ? "#0E0D17" : "#EDE5EF", alignItems: "center" }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 480,
            flex: 1,
            backgroundColor: C.paper,
            ...(Platform.OS === "web"
              ? { boxShadow: dark ? "0 0 65px #00000055" : "0 0 80px #59306818" }
              : {}),
          }}
        >
          <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
            {showLaunch ? (
              <AnimatedLaunchScreen reducedMotion={reducedMotion} />
            ) : (
              <AuthProvider>
                <AuthGate reducedMotion={reducedMotion} />
              </AuthProvider>
            )}
          </SafeAreaView>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return <AppearanceProvider><AppShell /></AppearanceProvider>;
}
