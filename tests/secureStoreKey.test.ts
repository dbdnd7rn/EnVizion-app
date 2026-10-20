import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { secureStoreKey } from "../src/secureStoreKey.ts";

const safe = /^[A-Za-z0-9._-]+$/;
const storage = readFileSync(new URL("../src/supabase.ts", import.meta.url), "utf8");

test("previously valid Supabase SecureStore keys keep their names and sessions", () => {
  for (const key of [
    "sb-nvmepknmkptltnuxdyfv-auth-token",
    "sb-nvmepknmkptltnuxdyfv-auth-token-code-verifier",
    "supabase.auth.token",
    "envizion_session_1",
  ]) {
    assert.equal(secureStoreKey(key), key);
  }
});

test("invalid SecureStore keys are encoded safely and deterministically", () => {
  for (const key of [
    "https://envizion.example/auth:token",
    "supabase:auth/token",
    "some key with spaces",
    "token@email",
    "session:🎉",
    "",
  ]) {
    const normalized = secureStoreKey(key);
    assert.ok(normalized.length > 0);
    assert.match(normalized, safe);
    assert.equal(normalized, secureStoreKey(key));
    assert.notEqual(normalized, key);
  }
});

test("different invalid names cannot collide and reserved names are safely escaped", () => {
  const inputs = ["a:b", "a/b", "a b", "a_b", "a-b", "a.b", "ab", "a+b", "a@b", "🎉", "", "envizion_secure_key_"];
  const keys = inputs.map(secureStoreKey);
  assert.equal(new Set(keys).size, inputs.length);
  assert.match(secureStoreKey("envizion_secure_key_"), safe);
});

test("native Supabase storage sanitizes every key and preserves secure session values", () => {
  assert.match(storage, /getItemAsync\(secureStoreKey\(key\)\)/);
  assert.match(storage, /setItemAsync\(secureStoreKey\(key\), value/);
  assert.match(storage, /deleteItemAsync\(secureStoreKey\(key\)\)/);
  assert.match(storage, /keychainAccessible: SecureStore\.WHEN_UNLOCKED/);
  assert.match(storage, /Platform\.OS === "web" \? webStorage : nativeStorage/);
  assert.doesNotMatch(storage, /SecureStore\.setItemAsync\(key,/);
});
