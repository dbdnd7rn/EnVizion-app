import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { specialists } from "../src/content.ts";

const source = readFileSync(new URL("../src/screens/SupportScreens.tsx",import.meta.url),"utf8");
const artworks = readFileSync(new URL("../src/components/SpecialistArtwork.tsx",import.meta.url),"utf8");

test("all current specialist pages have individually named palettes and graphics", () => {
  assert.equal(specialists.length,8);
  const artTitles=[...artworks.matchAll(/secondary:\s*"(?:#[A-Fa-f0-9]+)",\s*title:\s*"([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(artTitles,specialists.map(x=>x[0]));
  for(let i=0;i<specialists.length;i++){
    if(i<7)assert.match(artworks,new RegExp(`case ${i}:`));
    assert.ok(artworks.includes(specialists[i][0]));
  }
  assert.match(artworks,/SPECIALIST_QUESTIONS/);
  assert.match(artworks,/SPECIALIST_NOTES/);
  assert.match(artworks,/How should we track changes in memory or movement/);
  assert.match(artworks,/What breathing changes should prompt us to seek help/);
  assert.match(artworks,/What should we track about pain or stiffness/);
});
test("specialist list and detail share theme/art, with working destinations",()=>{
  assert.match(source,/specialists\.map\(\(\[title,subtitle\],i\)/);
  assert.match(source,/SpecialistArtwork index=\{i\}/);
  assert.match(source,/SpecialistArtwork index=\{index\}/);
  assert.match(source,/SpecialtyGlass/);
  assert.match(source,/n\.navigate\("Specialist",\{index:i\}\)/);
  assert.match(source,/n\.navigate\("Appointments"\)/);
  assert.doesNotMatch(source,/function SpecialistHeroGraphic\(/);
});
test("specialty artwork respects reduced motion and dark mode",()=>{
  assert.match(artworks,/useAppearance/);
  assert.match(artworks,/isReduceMotionEnabled/);
  assert.match(artworks,/reduceMotionChanged/);
  assert.match(artworks,/Animated\.loop/);
  assert.match(artworks,/motion = false/);
});

test("all SVG artwork instances have unique gradient resource IDs",()=>{
  assert.match(artworks,/useId\(\)/);
  assert.match(artworks,/id=\{gradientId\}/);
  assert.match(artworks,/fill=\{`url\(#\$\{gradientId\}\)`\}/);
  assert.doesNotMatch(artworks,/id="specialistGlow"/);
});
test("long specialty names use a stacked mobile hero instead of overlapping the art",()=>{
  assert.match(source,/const stackedHero=compact && item\[0\]\.length>19/);
  assert.match(source,/minHeight:stackedHero\?310:226/);
  assert.match(source,/height=\{stackedHero\?155:215\}/);
});
