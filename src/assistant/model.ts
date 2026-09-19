export type Destination =
  | "Appointments"
  | "Transition"
  | "Medications"
  | "Wellness"
  | "Resources"
  | "Summary";
export type Message = {
  id: string;
  role: "user" | "assistant" | "staff";
  text: string;
  at: string;
  resource?: { label: string; destination: Destination };
  suggestTeam?: boolean;
};
export type SupportRequest = {
  id: string;
  topic: string;
  context: string;
  channel: "In-app inbox" | "WhatsApp" | "Email";
  transcript: Message[];
  thread: Message[];
  status: "preview-open" | "preview-resolved";
};
export type ConversationState = {
  messages: Message[];
  request: SupportRequest | null;
};
export const initialConversation: ConversationState = {
  messages: [],
  request: null,
};
export type ConversationAction =
  | { type: "conversation-turn"; messages: Message[] }
  | { type: "support-request"; request: SupportRequest }
  | { type: "support-message"; requestId: string; message: Message }
  | { type: "support-resolve"; requestId: string }
  | { type: "conversation-clear" };

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case "conversation-turn":
      return { ...state, messages: [...state.messages, ...action.messages] };
    case "support-request":
      if (state.request?.status === "preview-open") return state;
      return {
        ...state,
        request: {
          ...action.request,
          transcript: action.request.transcript.map((m) => ({ ...m })),
          thread: [...action.request.thread],
        },
      };
    case "support-message":
      if (
        !state.request ||
        state.request.id !== action.requestId ||
        state.request.status !== "preview-open" ||
        !action.message.text.trim()
      )
        return state;
      return {
        ...state,
        request: {
          ...state.request,
          thread: [...state.request.thread, action.message],
        },
      };
    case "support-resolve":
      if (!state.request || state.request.id !== action.requestId) return state;
      return {
        ...state,
        request: { ...state.request, status: "preview-resolved" },
      };
    case "conversation-clear":
      return { ...state, messages: [] };
  }
}

export function makeMessage(role: Message["role"], text: string): Message {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    text: text.trim(),
    at: new Date().toISOString(),
  };
}

// Deliberately scripted: this is not an LLM or a symptom triage system.
// A production service must enforce its own clinical boundaries, identity and consent.
export function previewReply(
  question: string,
  faith: boolean,
): Omit<Message, "id" | "at" | "role"> {
  const q = question.toLowerCase().trim();
  const answers: Array<[RegExp, string, string, Destination]> = [
    [
      /^(how (do|can) i (prepare|get ready) for (a|an|my) (visit|appointment)\??|prepare for a visit)$/,
      "Start with the questions you want answered. In Appointment prep, you can keep your visit details and question list together, then print a copy. Your Care summary brings together the observations you have entered.",
      "Open appointment prep",
      "Appointments",
    ],
    [
      /^(how (do|can) i (use|find) (the )?(medication log|medicine log)\??|organize medications)$/,
      "Use Medication logs to copy sample label details, record entries, and review their timestamps. If an entry is incorrect, withdraw it so the correction stays visible. This tool does not recommend doses or medication changes.",
      "Open medication logs",
      "Medications",
    ],
    [
      /^(where (do|can) i (find|start) (the )?(transition|hospital.to.home) checklist\??|plan the transition home)$/,
      "Walking Through the Transition keeps your preparation checklist together. Use it alongside the instructions from your discharge team. You can mark items prepared and print the checklist for your next conversation.",
      "Open transition checklist",
      "Transition",
    ],
    [
      /^(where (do|can) i find (trusted )?resources\??|find trusted resources)$/,
      "The resource directory links to public health organizations and printable worksheets. The library also includes educational drafts for review with the care team.",
      "Browse resources",
      "Resources",
    ],
    [
      /^(i need (a moment|encouragement)|find a quiet moment)$/,
      faith
        ? "You can make space for a quiet moment. Spiritual Wellness offers optional faith-based reflection and a breathing timer. If you would rather talk to someone, you can prepare a support request."
        : "You can make space for a quiet moment. Spiritual Wellness includes a quiet timer. You can use it as a moment to pause. If you would rather talk to someone, you can prepare a support request.",
      "Open Spiritual Wellness",
      "Wellness",
    ],
  ];
  const match = answers.find(([pattern]) => pattern.test(q));
  if (match)
    return {
      text: match[1],
      resource: { label: match[2], destination: match[3] },
    };
  if (/^(hi|hello|hey)[!.]?$/.test(q))
    return {
      text: "Hello. I can demonstrate basic app guidance. Try one of the suggested questions, or choose Talk to our team to preview a conversation with a person.",
    };
  return {
    text: "This preview cannot answer that reliably. For an individual care question, contact your healthcare professional. You can also prepare a request for the EnVizion Life support team. If you think this may be an emergency, call your local emergency number now; do not wait for chat.",
    suggestTeam: true,
  };
}

export const starters = [
  "Prepare for a visit",
  "Organize medications",
  "Plan the transition home",
  "Find trusted resources",
  "Find a quiet moment",
];
