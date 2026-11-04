import type { TermExplanation } from "./contracts.ts";

/**
 * Small, clinician-reviewable, non-personal glossary for offline-style fallback
 * when external AI is unavailable. Exact term matches only; never extrapolate
 * to the patient's records, diagnose, or interpret free-text context.
 */
const entries: Record<string, { meaning: string; example: string; question: string }> = {
  benign: {
    meaning: "Usually means a finding is not cancerous or is not expected to cause harm. Its exact meaning depends on what the clinician is describing.",
    example: "A clinician might call a growth 'benign' to describe a growth that is not cancerous.",
    question: "What exactly is benign in this case, and does it need monitoring?",
  },
  tachycardia: {
    meaning: "A heartbeat that is faster than normal for the situation. The cause and importance depend on the person's symptoms and health.",
    example: "A clinician may use 'tachycardia' when talking about a rapid pulse.",
    question: "What caused the fast heart rate, and when should we call for help?",
  },
  edema: {
    meaning: "Swelling caused by extra fluid collecting in body tissues.",
    example: "Swelling around the ankles may be described as edema.",
    question: "What might be causing the swelling, and which changes should we watch for?",
  },
  hypertension: {
    meaning: "High blood pressure, meaning the force of blood against the artery walls is higher than recommended.",
    example: "A clinician may discuss hypertension when reviewing blood pressure readings.",
    question: "What blood pressure range is appropriate for this person?",
  },
  hypotension: {
    meaning: "Blood pressure that is lower than expected. Whether it is concerning depends on the person and their symptoms.",
    example: "A clinician may say 'hypotension' when discussing a low blood pressure reading.",
    question: "What is the usual blood pressure range, and what symptoms require attention?",
  },
  bradycardia: {
    meaning: "A heartbeat that is slower than usual. It can be normal in some situations or need medical attention in others.",
    example: "A clinician might use 'bradycardia' while discussing a slow pulse.",
    question: "Is this slow heart rate expected, and are there warning signs to watch for?",
  },
  arrhythmia: {
    meaning: "An irregularity in the heart's rhythm, such as beating too quickly, too slowly, or unevenly.",
    example: "An ECG report may mention an arrhythmia.",
    question: "Which rhythm change was found, and does it need treatment or monitoring?",
  },
  dyspnea: {
    meaning: "The medical term for shortness of breath or difficulty breathing.",
    example: "A clinician might write 'dyspnea' to describe a person's feeling of being breathless.",
    question: "What may be causing the breathlessness, and when is emergency care needed?",
  },
  hypoxia: {
    meaning: "When the body's tissues are not getting enough oxygen.",
    example: "A clinician may discuss hypoxia while explaining concerns about oxygen supply.",
    question: "What does this mean for the person, and what should we do if breathing worsens?",
  },
  exacerbation: {
    meaning: "A flare-up or worsening of a condition compared with the person's usual state.",
    example: "A clinician might call worsening COPD symptoms an exacerbation.",
    question: "Which signs show a flare-up is starting, and what is our written action plan?",
  },
  inflammation: {
    meaning: "The body's response to irritation, injury, or infection. It can cause swelling, pain, warmth, or redness.",
    example: "A clinician might describe swollen joints as having inflammation.",
    question: "What is causing the inflammation, and how will it be monitored?",
  },
  prognosis: {
    meaning: "A clinician's estimate of how a health condition may change over time, based on available information.",
    example: "A doctor may discuss prognosis when explaining possible outcomes and uncertainty.",
    question: "What outcomes are possible, and what factors could change the outlook?",
  },
  neuropathy: {
    meaning: "A problem involving nerves outside the brain and spinal cord. It may cause numbness, tingling, pain, or weakness.",
    example: "A clinician might use 'neuropathy' while discussing tingling in the feet.",
    question: "Which nerves are affected, and what changes should we report?",
  },
  biopsy: {
    meaning: "A procedure in which a small sample of tissue or cells is taken for examination.",
    example: "A clinician may request a biopsy to find out more about an unusual growth.",
    question: "What is the biopsy checking for, and when will the results be available?",
  },
  malignant: {
    meaning: "Describes a cancerous growth that may invade nearby tissues or spread. The exact implications depend on the diagnosis.",
    example: "A pathology report may use the word 'malignant' for a cancerous tumor.",
    question: "What does this result mean, and what are the next steps?",
  },
  metastasis: {
    meaning: "The spread of cancer from where it began to another part of the body.",
    example: "A clinician may discuss metastasis when explaining imaging results in someone with cancer.",
    question: "Where has the cancer spread, and what does that mean for care?",
  },
  remission: {
    meaning: "A period when signs or symptoms of a disease have decreased or are no longer detectable. It does not always mean the condition is cured.",
    example: "A clinician may say a cancer is in remission when tests show no detectable signs.",
    question: "What does remission mean here, and which follow-up checks are needed?",
  },
  creatinine: {
    meaning: "A substance measured in blood or urine that clinicians often use, along with other information, to evaluate kidney function.",
    example: "A kidney specialist may review a blood creatinine result.",
    question: "How should we understand the creatinine result alongside other kidney tests?",
  },
  dialysis: {
    meaning: "A treatment that removes waste and extra fluid from the blood when the kidneys cannot do this well enough.",
    example: "A kidney team may discuss dialysis for advanced kidney failure.",
    question: "Why might dialysis be needed, and what are the treatment options?",
  },
  glucose: {
    meaning: "A type of sugar in the blood that the body uses for energy.",
    example: "A clinician may check blood glucose when monitoring diabetes.",
    question: "What glucose range is recommended for this person?",
  },
  insulin: {
    meaning: "A hormone that helps glucose move from the blood into cells. Some people use insulin medicine when their bodies cannot regulate glucose adequately.",
    example: "A clinician may discuss insulin when reviewing diabetes care.",
    question: "What is the prescribed plan, and how should we respond to low glucose?",
  },
  "oxygen saturation": {
    meaning: "An estimate of how much of the hemoglobin in the blood is carrying oxygen, usually shown as a percentage.",
    example: "A fingertip pulse oximeter can display an oxygen saturation reading.",
    question: "What is this person's usual oxygen saturation range, and when should we seek help?",
  },
  copd: {
    meaning: "Chronic obstructive pulmonary disease, a long-term lung condition that limits airflow and can make breathing difficult.",
    example: "A pulmonologist may discuss COPD and a plan for symptom flare-ups.",
    question: "What is the usual breathing baseline, and what should we do during a flare-up?",
  },
  chf: {
    meaning: "Congestive heart failure, a condition in which the heart cannot pump blood as effectively as the body needs, sometimes causing fluid buildup.",
    example: "A clinician may mention CHF when discussing breathlessness and fluid retention.",
    question: "What symptoms and daily changes should we monitor at home?",
  },
  "heart failure": {
    meaning: "A condition in which the heart does not pump or fill well enough to meet the body's needs. It does not mean the heart has stopped.",
    example: "A clinician may discuss heart failure when reviewing swelling or shortness of breath.",
    question: "What is the specific heart failure diagnosis and home monitoring plan?",
  },
  tia: {
    meaning: "Transient ischemic attack: a brief interruption of blood supply to part of the brain that causes stroke-like symptoms. It is an urgent warning sign and needs emergency medical assessment, even if symptoms resolve.",
    example: "A clinician may describe short-lived stroke-like symptoms as a possible TIA.",
    question: "What immediate emergency plan should we follow if stroke-like symptoms occur?",
  },
  "transient ischemic attack": {
    meaning: "A brief interruption of blood supply to part of the brain that causes stroke-like symptoms. It is an urgent warning sign and needs emergency medical assessment, even if symptoms resolve.",
    example: "Someone who has briefly had stroke-like symptoms may be evaluated for a transient ischemic attack.",
    question: "What immediate emergency plan should we follow if stroke-like symptoms occur?",
  },
  "dnr": {
    meaning: "Do Not Resuscitate: a medical order about not attempting cardiopulmonary resuscitation if breathing or the heartbeat stops. It does not automatically mean stopping other medical care.",
    example: "A clinician may discuss a DNR order when planning emergency treatment preferences.",
    question: "What does the documented order cover, and where should it be kept?",
  },
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

export function explainKnownMedicalTerm(term: string): TermExplanation | null {
  const match = entries[normalized(term)];
  if (!match) return null;
  return {
    known: true,
    plainMeaning: match.meaning,
    everydayExample: match.example,
    questionForClinician: match.question,
    uncertainty: "General glossary definition only. A clinician must explain what this means for the individual patient. This does not interpret the optional phrase.",
  };
}
