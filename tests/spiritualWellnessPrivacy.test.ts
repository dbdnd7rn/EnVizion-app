import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screen = fs.readFileSync("src/screens/WellnessScreen.tsx", "utf8");

test("spiritual reflection remains screen-local and non-persistent", () => {
  assert.match(
    screen,
    /const \[reflection, setReflection\] = useState\(""\)/,
  );
  assert.match(
    screen,
    /Only on this screen during this visit\. Nothing is sent or stored\./,
  );
  assert.match(screen, /Spiritual practices are optional\./);
  assert.doesNotMatch(
    screen,
    /supabase|AsyncStorage|SecureStore|localStorage|sessionStorage|fetch\(|axios|analytics|openai|backend/i,
  );
});

test("spiritual wellness keeps the exact requested scripture and natural-breathing wording", () => {
  assert.match(
    screen,
    /“God is our refuge and strength, a very present help in trouble\.”/,
  );
  assert.match(screen, /Psalm 46:1 · King James Version/);
  assert.match(screen, /Breathe naturally\. Nothing to achieve\./);
});

test("quiet moment timer guards duplicates and cleans up when the screen loses focus", () => {
  assert.match(screen, /if \(runningRef\.current\) return;/);
  assert.match(screen, /clearInterval\(intervalRef\.current\)/);
  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /clearTimerResources\(\)/);
  assert.match(screen, /setReflection\(""\)/);
});
