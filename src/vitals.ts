import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TemperatureUnit } from "./vitalsHelpers";
export * from "./vitalsHelpers";
const UNIT_PREFERENCE_KEY = "envizion.vitals.temperature-unit.v1";
export async function loadTemperaturePreference(): Promise<TemperatureUnit> {
  try {
    const saved = await AsyncStorage.getItem(UNIT_PREFERENCE_KEY);
    return saved === "C" ? "C" : "F";
  } catch { return "F"; }
}
export async function saveTemperaturePreference(unit: TemperatureUnit): Promise<void> {
  await AsyncStorage.setItem(UNIT_PREFERENCE_KEY, unit);
}
