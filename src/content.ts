export type Guide = {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: string;
  readTime: string;
  sections: {
    title: string;
    body: string;
  }[];
  url?: string;
};
export const guides: Guide[] = [
  {
    id: "rights",
    title: "Your voice matters",
    category: "Patient rights",
    description: "Feel more prepared to ask, understand, and advocate.",
    icon: "shield-checkmark-outline",
    readTime: "3 min read",
    sections: [
      {
        title: "Ask for clarity",
        body: "Ask the care team to explain the care plan, available options, and next steps in language you understand. Ask about interpretation or accessibility support when needed.",
      },
      {
        title: "Make room for the patient’s wishes",
        body: "Ask how your loved one wants you involved. Discuss consent, privacy preferences, and who may receive updates with the care team.",
      },
      {
        title: "When something feels unresolved",
        body: "Ask the hospital for its patient advocate or patient relations contact. Keep a note of your concern and the response. Specific rights vary by setting and location.",
      },
    ],
    url: "https://www.medicare.gov/basics/your-medicare-rights",
  },
  {
    id: "advance",
    title: "Start a meaningful conversation",
    category: "Advance care planning",
    description: "A gentle starting point for wishes, values, and future care.",
    icon: "chatbubbles-outline",
    readTime: "4 min read",
    sections: [
      {
        title: "Begin with what matters",
        body: "What gives your loved one comfort? What would they want the care team to know if they could not speak for themselves?",
      },
      {
        title: "Choose someone to speak for you",
        body: "Discuss who your loved one trusts to help communicate their wishes. Ask a qualified professional about the correct forms for your location.",
      },
      {
        title: "Keep the conversation accessible",
        body: "Write down questions, discuss them with the healthcare team, and ask where completed documents should be kept. This worksheet is a conversation starter, not a legal advance directive.",
      },
    ],
    url: "https://www.nia.nih.gov/health/advance-care-planning",
  },
  {
    id: "copd",
    title: "Living with COPD",
    category: "Condition guide",
    description:
      "Organize breathing observations and questions for your care team.",
    icon: "fitness-outline",
    readTime: "4 min read",
    sections: [
      {
        title: "Understand your everyday baseline",
        body: "Ask your clinician what breathing, activity, and symptoms are usual for your loved one. Keep their personalized action plan nearby.",
      },
      {
        title: "Notice and record changes",
        body: "Record changes in breathing, cough, mucus, activity, and sleep. Share concerns with the healthcare team. Do not change prescribed oxygen or medicines based on this app.",
      },
      {
        title: "Prepare for your next visit",
        body: "Ask: What changes should we report? Who should we call after hours? Can you review inhaler technique and our written action plan?",
      },
    ],
    url: "https://www.nhlbi.nih.gov/health/copd",
  },
  {
    id: "heart",
    title: "Understanding heart failure",
    category: "Condition guide",
    description: "A place for daily observations and better conversations.",
    icon: "heart-outline",
    readTime: "3 min read",
    sections: [
      {
        title: "Use the plan made for you",
        body: "Ask the care team which measurements to track and how often. Record weight, breathing changes, and swelling if requested.",
      },
      {
        title: "Know your contact plan",
        body: "Ask the clinician to write down the changes that require a call and the appropriate contact number. This app does not calculate risk or set alert thresholds.",
      },
      {
        title: "Bring your notes",
        body: "Take your symptom notes and medication list to appointments. Ask before making changes to medicines, fluids, or diet.",
      },
    ],
    url: "https://www.nhlbi.nih.gov/health/heart-failure",
  },
  ...[
    [
      "diabetes",
      "Diabetes",
      "water-outline",
      "blood sugar readings, meal timing, and questions about your prescribed monitoring plan",
      "https://www.niddk.nih.gov/health-information/diabetes",
    ],
    [
      "kidney",
      "Kidney health",
      "leaf-outline",
      "changes you notice, your medication list, and questions about follow-up tests",
      "https://www.niddk.nih.gov/health-information/kidney-disease",
    ],
    [
      "memory",
      "Memory & neurological care",
      "flower-outline",
      "changes in memory, movement, sleep, and daily routines",
      "https://www.nia.nih.gov/health/alzheimers-and-dementia",
    ],
    [
      "stroke",
      "After a stroke or TIA",
      "pulse-outline",
      "questions about recovery, support at home, and your follow-up plan",
      "https://www.cdc.gov/stroke/",
    ],
  ].map(([id, title, icon, topic, url]) => ({
    id,
    title,
    icon,
    category: "Condition guide",
    description: "Practical questions for a more confident care journey.",
    readTime: "2 min read",
    url,
    sections: [
      { title: "Prepare together", body: `Keep a simple record of ${topic}.` },
      {
        title: "Questions to bring",
        body: "What should we watch for at home? Who should we contact about a change? What support would make daily care easier?",
      },
      {
        title: "Learn from a trusted source",
        body: "Open the linked public health resource for more education, and discuss individual care with your healthcare team.",
      },
    ],
  })),
];
export const specialists = [
  [
    "Primary care",
    "Your starting point for ongoing care",
    "Review the overall care plan, medication list, and referrals.",
  ],
  [
    "Cardiology",
    "Heart and circulation",
    "Bring weight or blood pressure logs requested by the team. Ask about your written symptom and contact plan.",
  ],
  [
    "Hematology & oncology",
    "Blood conditions and cancer care",
    "Bring treatment questions, symptoms, and a current medication list. Ask whom to contact between visits.",
  ],
  [
    "Nephrology",
    "Kidney care",
    "Bring requested blood pressure records and questions about tests, medicines, and your individual care plan.",
  ],
  [
    "Neurology",
    "Brain, memory, and movement",
    "Record when changes began and their effect on daily life. Bring questions about safety and support.",
  ],
  [
    "Endocrinology",
    "Hormones and diabetes",
    "Bring glucose logs if requested, medication details, and questions about your monitoring plan.",
  ],
  [
    "Pulmonology",
    "Lungs and breathing",
    "Bring breathing observations and questions about inhalers and your personalized action plan.",
  ],
  [
    "Rheumatology",
    "Joints and inflammatory conditions",
    "Bring notes about symptoms, mobility, and effects on daily activities.",
  ],
];
export const transitionSteps = [
  "Confirm the discharge instructions with the care team",
  "Review the medication list and what has changed",
  "Write down follow-up appointments",
  "Check equipment, transport, and home support",
  "Ask about warning signs and who to call",
  "Share the plan with your loved one and care partners",
];
export const trustedResources = [
  {
    title: "Medicare",
    subtitle: "Coverage, rights, and getting started",
    url: "https://www.medicare.gov/",
  },
  {
    title: "MedlinePlus",
    subtitle: "Health topics and medication information",
    url: "https://medlineplus.gov/",
  },
  {
    title: "National Institute on Aging",
    subtitle: "Caregiving and advance care planning",
    url: "https://www.nia.nih.gov/health/caregiving",
  },
  {
    title: "EnVizion Life",
    subtitle: "Learn more about the program",
    url: "https://envizionlife.net",
  },
];
