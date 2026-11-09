import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const expo = app.expo;
const icon = "./assets/envizion-app-icon.png";
const splash = "./assets/envizion-original.png";

assert.equal(expo.name, "EnVizion Life");
assert.equal(expo.icon, icon, "Default launcher icon must use the official EnVizion logo");
assert.equal(expo.android.icon, icon, "Android icon must use the official EnVizion logo");
assert.equal(
  expo.android.adaptiveIcon.foregroundImage,
  icon,
  "Android adaptive icon must use the official EnVizion logo",
);
assert.equal(expo.splash.image, splash, "Native splash must use the original EnVizion logo");
assert.equal(expo.splash.backgroundColor, "#FCF9F6");
assert.equal(expo.android.adaptiveIcon.backgroundColor, "#FCF9F6");
assert.ok(
  Number.isInteger(expo.android.versionCode) && expo.android.versionCode >= 3,
  "Android versionCode must advance when producing a replacement APK",
);

for (const path of [icon, splash]) {
  const png = readFileSync(new URL("../" + path.replace(/^\.\//, ""), import.meta.url));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", path + " must be a PNG");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width >= 512 && height >= 512, path + " should be high resolution");
  if (path === icon) assert.equal(width, height, "Android launcher icon should be square");
  console.log(path + ": " + width + " x " + height + " PNG");
}

console.log("EnVizion Life Android icon, splash and APK version checks passed.");
