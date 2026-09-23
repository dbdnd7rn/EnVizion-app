import React, { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import type { Appointment, Entry } from "./domain";
import { loadCareData, type CareSnapshot } from "./backend";
import type { CareRole } from "./careTeam";
import {
  conversationReducer,
  initialConversation,
  type ConversationState,
  type ConversationAction,
} from "./assistant/model";
import {
  correctMedicationRecord,
  type Medication,
  type MedicationRecord,
} from "./medications";
type State = {
  conversation: ConversationState;
  name: string;
  relationship: string;
  faith: boolean;
  careRecipientId: string | null;
  careRecipientName: string;
  accessRole: CareRole;
  entries: Entry[];
  medications: Medication[];
  meds: Record<string, boolean>;
  medicationRecords: MedicationRecord[];
  transition: number[];
  questions: string[];
  saved: string[];
  coaching: string | null;
  appointment: Appointment;
  appointmentId: string | null;
  questionIds: string[];
  hydrated: boolean;
};
type Action =
  | ConversationAction
  | { type: "hydrate-care"; snapshot: CareSnapshot }
  | { type: "appointment"; appointment: Appointment; appointmentId?: string | null }
  | { type: "remove-question"; index: number }
  | {
      type: "profile";
      name: string;
      relationship: string;
      faith: boolean;
    }
  | {
      type: "entry";
      entry: Entry;
    }
  | {
      type: "record-med";
      record: MedicationRecord;
    }
  | { type: "correct-med"; id: string; at: string }
  | { type: "edit-med"; medication: Medication }
  | { type: "remove-med"; id: string }
  | {
      type: "add-med";
      medication: Medication;
    }
  | {
      type: "transition";
      index: number;
    }
  | {
      type: "question";
      text: string;
      id?: string;
      appointmentId?: string | null;
    }
  | {
      type: "bookmark";
      id: string;
    }
  | {
      type: "coaching";
      topic: string;
    }
  | {
      type: "reset";
    };
const initial: State = {
  conversation: initialConversation,
  name: "",
  relationship: "A loved one",
  faith: false,
  careRecipientId: null,
  careRecipientName: "",
  accessRole: "viewer",
  entries: [],
  medications: [],
  meds: {},
  medicationRecords: [],
  transition: [],
  questions: [],
  questionIds: [],
  saved: [],
  coaching: null,
  appointment: {
    title: "Next appointment",
    date: "",
    time: "",
    location: "",
    notes: "",
  },
  appointmentId: null,
  hydrated: false,
};
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate-care":
      return {
        ...state,
        ...action.snapshot,
        meds: Object.fromEntries(
          action.snapshot.medications.map((m) => [
            m.id,
            action.snapshot.medicationRecords.some(
              (r) => r.medication.id === m.id && !r.correctedAt,
            ),
          ]),
        ),
        hydrated: true,
      };
    case "conversation-turn":
    case "support-request":
    case "support-message":
    case "support-resolve":
    case "conversation-clear":
      return {
        ...state,
        conversation: conversationReducer(state.conversation, action),
      };
    case "appointment":
      return {
        ...state,
        appointment: action.appointment,
        appointmentId:
          action.appointmentId === undefined
            ? state.appointmentId
            : action.appointmentId,
      };
    case "remove-question":
      return {
        ...state,
        questions: state.questions.filter((_, index) => index !== action.index),
        questionIds: state.questionIds.filter((_, index) => index !== action.index),
      };
    case "profile":
      return {
        ...state,
        name: action.name.trim() || "Caregiver",
        relationship: action.relationship,
        faith: action.faith,
      };
    case "entry":
      return { ...state, entries: [action.entry, ...state.entries] };
    case "record-med":
      return {
        ...state,
        meds: { ...state.meds, [action.record.medication.id]: true },
        medicationRecords: [action.record, ...state.medicationRecords],
      };
    case "correct-med": {
      const records = correctMedicationRecord(
        state.medicationRecords,
        action.id,
        action.at,
      );
      return {
        ...state,
        medicationRecords: records,
        meds: Object.fromEntries(
          state.medications.map((m) => [
            m.id,
            records.some((r) => r.medication.id === m.id && !r.correctedAt),
          ]),
        ),
      };
    }
    case "edit-med":
      return {
        ...state,
        medications: state.medications.map((m) =>
          m.id === action.medication.id ? action.medication : m,
        ),
      };
    case "add-med":
      return {
        ...state,
        medications: [...state.medications, action.medication],
      };
    case "remove-med": {
      const { [action.id]: _removed, ...remainingMeds } = state.meds;
      return {
        ...state,
        medications: state.medications.filter((m) => m.id !== action.id),
        meds: remainingMeds,
      };
    }
    case "transition":
      return {
        ...state,
        transition: state.transition.includes(action.index)
          ? state.transition.filter((i) => i !== action.index)
          : [...state.transition, action.index],
      };
    case "question":
      return {
        ...state,
        questions: [...state.questions, action.text],
        questionIds: [...state.questionIds, action.id ?? ""],
        appointmentId:
          action.appointmentId === undefined
            ? state.appointmentId
            : action.appointmentId,
      };
    case "bookmark":
      return {
        ...state,
        saved: state.saved.includes(action.id)
          ? state.saved.filter((id) => id !== action.id)
          : [...state.saved, action.id],
      };
    case "coaching":
      return { ...state, coaching: action.topic };
    case "reset":
      return initial;
  }
}
const Context = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  refresh: () => Promise<void>;
  loading: boolean;
} | null>(null);

export function CareProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await loadCareData();
      if (snapshot) {
        dispatch({ type: "hydrate-care", snapshot });
      }
    } catch {
      // Keep the app usable if the network is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Context.Provider value={{ state, dispatch, refresh, loading }}>
      {children}
    </Context.Provider>
  );
}
export function useCare() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing CareProvider");
  return c;
}
