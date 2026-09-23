import type { NavigatorScreenParams } from "@react-navigation/native";
import type { TrackerKind } from "./domain";
export type Tabs = {
  Home: undefined;
  Toolkit: undefined;
  Library: undefined;
  Support: undefined;
};
export type RootStack = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<Tabs> | undefined;
  Tracker: {
    kind: TrackerKind;
  };
  Medications: undefined;
  Summary: undefined;
  Insights: undefined;
  CareCalendar: undefined;
  CareDocuments: undefined;
  CareContacts: undefined;
  CareCommunicationLog: undefined;
  CareTasks: undefined;
  CareShiftBoard: undefined;
  OnShiftCaregiver: undefined;
  CareSchedule: undefined;
  CareAnalytics: undefined;
  CareCoordinationInbox: undefined;
  CareContinuity: undefined;
  CareCoverageRequirements: undefined;
  SmartCoveragePlanner: undefined;
  CareCoverageRequests:
    | {
        startsAt?: string;
        endsAt?: string;
      }
    | undefined;
  CarePacket: undefined;
  Assistant: undefined;
  Handoff: undefined;
  TeamConversation: undefined;
  Appointments: undefined;
  Transition: undefined;
  Specialists: undefined;
  Specialist: {
    index: number;
  };
  Guide: {
    id: string;
  };
  Coaching: undefined;
  Wellness: undefined;
  Emergency: undefined;
  Resources: undefined;
  Profile: undefined;
  PrivacyData: undefined;
  CareTeam: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  StaffWorkspace: undefined;
  StaffManagement: undefined;
  PilotAdmin: undefined;
  ClinicalContent: undefined;
  ClinicalContentEditor: {
    contentId: string;
  };
  StaffSupportThread: {
    requestId: string;
  };
};
