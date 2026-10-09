import test from "node:test";
import assert from "node:assert/strict";
import {
  findCareTools,
  normalizeCareToolSearch,
  type SearchableCareTool,
} from "../src/careToolSearch.ts";

const catalog: SearchableCareTool[] = [
  {
    title: "Medication management",
    subtitle: "Medication list, doses, refills, and reconciliation",
    keywords: "medication medicine pharmacy PRN refill",
    category: "Plan & prepare",
  },
  {
    title: "Care Document Vault",
    subtitle: "Store and review care records",
    keywords: "documents upload file pdf",
    category: "Plan & prepare",
  },
  {
    title: "Family care calendar & agenda",
    subtitle: "Plan visits and shifts",
    keywords: "appointment calendar schedule doctor",
    category: "Care team & coordination",
  },
  {
    title: "Recurring care coverage",
    subtitle: "Keep caregiving shifts staffed",
    keywords: "caregiver availability shifts schedule",
    category: "Care team & coordination",
  },
  {
    title: "Vitals",
    subtitle: "Record blood pressure, pulse, and temperature",
    keywords: "health check in",
    category: "Daily care",
  },
];

const history = {
  pinned: ["Care Document Vault", "Medication management"],
  recent: ["Recurring care coverage", "Medication management"],
  usage: { "Recurring care coverage": 4, "Medication management": 2 },
};

const titles = (
  query: string,
  scope: "all" | "pinned" | "recent" | `category:${string}` = "all",
  sort: "relevance" | "alphabetical" | "recent" = "relevance",
  preferences = history,
) => findCareTools(catalog, query, scope, sort, preferences).map((item) => item.title);

test("search is case insensitive and matches metadata and user intent", () => {
  assert.equal(titles("MEDICATION")[0], "Medication management");
  assert.deepEqual(titles("meds refill"), ["Medication management"]);
  assert.equal(titles("blood pressure")[0], "Vitals");
  assert.equal(titles("docs")[0], "Care Document Vault");
  assert.equal(titles("appointments")[0], "Family care calendar & agenda");
});

test("search finds relevant navigation categories and uses all tokens", () => {
  assert.ok(titles("care coverage").includes("Recurring care coverage"));
  assert.ok(titles("care team").includes("Recurring care coverage"));
  assert.deepEqual(titles("medication giraffe"), []);
});

test("filter searches only pinned or recent real tool titles", () => {
  assert.deepEqual(titles("", "pinned"), [
    "Care Document Vault",
    "Medication management",
  ]);
  assert.deepEqual(titles("", "recent"), [
    "Recurring care coverage",
    "Medication management",
  ]);
  assert.deepEqual(
    titles("meds", "pinned"),
    ["Medication management"],
  );
  assert.deepEqual(
    titles("meds", "recent"),
    ["Medication management"],
  );
});

test("category filter and alphabetical sort combine with search", () => {
  assert.deepEqual(
    titles("", "category:Plan & prepare", "alphabetical"),
    ["Care Document Vault", "Medication management"],
  );
  assert.deepEqual(
    titles("medicine", "category:Care team & coordination"),
    [],
  );
});

test("sort by recently opened, gracefully handling no history", () => {
  assert.deepEqual(
    titles("", "all", "recent").slice(0, 2),
    ["Recurring care coverage", "Medication management"],
  );
  assert.equal(titles("meds", "all", "recent")[0], "Medication management");
  assert.equal(
    titles("", "all", "alphabetical")[0],
    "Care Document Vault",
  );
});

test("empty pinned or recent filters show no tools and never fabricate records", () => {
  const empty = { pinned: [], recent: [], usage: {} };
  assert.deepEqual(titles("", "pinned", "relevance", empty), []);
  assert.deepEqual(titles("", "recent", "relevance", empty), []);
});

test("search normalization handles separators and accents", () => {
  assert.equal(normalizeCareToolSearch("  CARE—plan!!  "), "care plan");
  assert.equal(normalizeCareToolSearch("café"), "cafe");
});

test("search does not alter its input catalogue or the local preferences", () => {
  const before = JSON.stringify({ catalog, history });
  titles("medication");
  titles("", "recent");
  assert.equal(JSON.stringify({ catalog, history }), before);
});
