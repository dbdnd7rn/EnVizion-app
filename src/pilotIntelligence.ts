import { supabase } from "./supabase";
import type { PilotIntelligence } from "./pilotIntelligenceHelpers";

export type {
  PilotFunnel,
  PilotDeviceMatrixItem,
  PilotFeedbackTrend,
  PilotWaveComparison,
  PilotIntelligence,
} from "./pilotIntelligenceHelpers";

export {
  pilotFunnelRate,
  pilotOutcomeReportHtml,
} from "./pilotIntelligenceHelpers";

async function invokePilotAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pilot-admin", {
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function loadPilotIntelligence(): Promise<PilotIntelligence> {
  const result = await invokePilotAdmin<{ intelligence: PilotIntelligence }>({
    action: "intelligence",
  });
  return result.intelligence;
}
