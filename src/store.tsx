import React, { createContext, useContext, useReducer } from "react";
import type { Appointment, Entry } from "./domain";
type Medication = {
  id: string;
  name: string;
  instructions: string;
  time: string;
};
type State = {
  name: string;
  relationship: string;
  faith: boolean;
  entries: Entry[];
  medications: Medication[];
  meds: Record<string, boolean>;
  transition: number[];
  questions: string[];
  saved: string[];
  coaching: string | null;
  appointment: Appointment;
};
type Action =
  | { type: "appointment"; appointment: Appointment }
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
      type: "med";
      id: string;
    }
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
  name: "Sarah",
  relationship: "A parent",
  faith: true,
  entries: [],
  medications: [
    {
      id: "morning",
      name: "Morning medication",
      instructions: "Follow the pharmacy label",
      time: "8:00 AM",
    },
    {
      id: "evening",
      name: "Evening medication",
      instructions: "Follow the pharmacy label",
      time: "6:00 PM",
    },
  ],
  meds: {},
  transition: [],
  questions: [
    "What changes should we watch for at home?",
    "Can we review the current medication list?",
  ],
  saved: [],
  coaching: null,
  appointment: {
    title: "Primary care follow-up",
    date: "",
    time: "",
    location: "",
    notes: "Bring your discharge papers and care notes.",
  },
};
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "appointment":
      return { ...state, appointment: action.appointment };
    case "remove-question":
      return {
        ...state,
        questions: state.questions.filter((_, index) => index !== action.index),
      };
    case "profile":
      return {
        ...state,
        name: action.name.trim() || "Sarah",
        relationship: action.relationship,
        faith: action.faith,
      };
    case "entry":
      return { ...state, entries: [action.entry, ...state.entries] };
    case "med":
      return {
        ...state,
        meds: { ...state.meds, [action.id]: !state.meds[action.id] },
      };
    case "add-med":
      return {
        ...state,
        medications: [...state.medications, action.medication],
      };
    case "transition":
      return {
        ...state,
        transition: state.transition.includes(action.index)
          ? state.transition.filter((i) => i !== action.index)
          : [...state.transition, action.index],
      };
    case "question":
      return { ...state, questions: [...state.questions, action.text] };
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
} | null>(null);
export function CareProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return (
    <Context.Provider value={{ state, dispatch }}>{children}</Context.Provider>
  );
}
export function useCare() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing CareProvider");
  return c;
}
