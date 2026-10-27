import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { specialists } from "../src/content.ts";
import { SPECIALIST_PALETTES, SPECIALIST_QUESTIONS, SPECIALIST_NOTES } from "../src/components/SpecialistArtwork.tsx";

const source = readFileSync(new URL("../src/screens/SupportScreens.tsx",import.meta.url),"utf8");
const artworks = readFileSync(new URL("../src/components/SpecialistArtwork.tsx",import.meta.url),"utf8");

test("all current specialist pages have their own palette, relevant content and visuals", () => {
  assert.equal(specialists.length,8);
  assert.equal(SPECIALIST_PALETTES.length,specialists.length);
  assert.equal(SPECIALIST_QUESTIONS.length,specialists.length);
  assert.equal(SPECIALIST_NOTES.length,specialists.length);
  for(let i=0;i<specialists.length;i++){
    assert.equal(SPECIALIST_PALETTES[i].title,specialists[i][0]);
    assert.equal(SPECIALIST_QUESTIONS[i].length,3);
    assert.equal(new Set(SPECIALIST_QUESTIONS[i].map(q=>q.text)).size,3);
    assert.ok(SPECIALIST_NOTES[i].length>35);
    assert.match(artworks, new RegExp(`case ${i}:`));
  }
  const signatures=SPECIALIST_QUESTIONS.map(q=>q.map(x=>x.text).join("|"));
  assert.equal(new Set(signatures).size,specialists.length);
});
test("specialist list and detail use same unique art, themed glass and retain working destinations",()=>{
  assert.match(source,/specialists\.map\(\(\[title,subtitle\],i\)/);
  assert.match(source,/SpecialistArtwork index=\{i\}/);
  assert.match(source,/SpecialistArtwork index=\{index\}/);
  assert.match(source,/SpecialtyGlass/);
  assert.match(source,/n\.navigate\("Specialist",\{index:i\}\)/);
  assert.match(source,/n\.navigate\("Appointments"\)/);
  assert.doesNotMatch(source,/function SpecialistHeroGraphic\(/);
});
test("specialist artwork is distinct and observes reduced motion and dark mode",()=>{
  assert.match(artworks,/useAppearance/);
  assert.match(artworks,/isReduceMotionEnabled/);
  assert.match(artworks,/reduceMotionChanged/);
  assert.match(artworks,/Animated\.loop/);
  assert.match(artworks,/motion = false/);
});
