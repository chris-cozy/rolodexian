import assert from "node:assert/strict";

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  return payload;
}

const created = await request("/api/contacts", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "API Compatibility Contact",
    nicknames: ["API Friend"],
    relationshipType: "Friend",
    relationshipStrength: 64,
    importantDates: [
      "2026-11-03 - Birthday",
      "Legacy date note",
      "2027-02-14 - Community anniversary",
      "2026-08-02 - Project milestone",
      "2025-10-01 - First meeting",
      "2026-07-27 - Today"
    ],
    appearance: {},
    traits: [],
    preferences: { favoriteColor: "Deep teal" },
    customFields: {},
    socialAccounts: [],
    interactions: [
      { title: "Coffee", occurredOn: "2026-05-02" },
      { title: "Call", occurredOn: "2026-07-20" }
    ]
  })
});

assert.deepEqual(created.contact.preferences.favoriteColors, ["Deep teal"]);
assert.equal("favoriteColor" in created.contact.preferences, false);
assert.deepEqual(created.contact.importantDates, [
  { date: "2026-11-03", description: "Birthday" },
  { date: "", description: "Legacy date note" },
  { date: "2027-02-14", description: "Community anniversary" },
  { date: "2026-08-02", description: "Project milestone" },
  { date: "2025-10-01", description: "First meeting" },
  { date: "2026-07-27", description: "Today" }
]);
assert.equal(created.contact.lastInteractionDate, "2026-07-20");

const exportResponse = await fetch(`${baseUrl}/api/contacts/export`);
assert.ok(exportResponse.ok, `Export failed: ${exportResponse.status}`);
const versionTwoArchive = await exportResponse.json();
assert.equal(versionTwoArchive.version, 2);
assert.ok(versionTwoArchive.contacts.every((contact) => Array.isArray(contact.preferences.favoriteColors)));
assert.ok(
  versionTwoArchive.contacts.every((contact) =>
    contact.importantDates.every((importantDate) => typeof importantDate === "object")
  )
);

const legacyId = "api-archive-v1-contact";
const versionOneArchive = {
  format: "rolodexian.contacts-export",
  version: 1,
  exportedAt: new Date().toISOString(),
  contacts: [
    {
      id: legacyId,
      name: "Version One Import",
      nicknames: ["V1"],
      relationshipType: "Acquaintance",
      relationshipStrength: 50,
      importantDates: ["2027-01-02: Reunion", "Date unknown"],
      appearance: {},
      traits: [],
      preferences: { favoriteColor: "Sea glass" },
      customFields: {},
      socialAccounts: [],
      interactions: [],
      images: [],
      profileImageId: null
    }
  ],
  relationships: []
};
const versionOneForm = new FormData();
versionOneForm.append(
  "archive",
  new Blob([JSON.stringify(versionOneArchive)], { type: "application/json" }),
  "contacts-v1.json"
);
await request("/api/contacts/import", { method: "POST", body: versionOneForm });
const importedV1 = await request(`/api/contacts/${legacyId}`);
assert.deepEqual(importedV1.contact.preferences.favoriteColors, ["Sea glass"]);
assert.deepEqual(importedV1.contact.importantDates, [
  { date: "2027-01-02", description: "Reunion" },
  { date: "", description: "Date unknown" }
]);

const versionTwoForm = new FormData();
versionTwoForm.append(
  "archive",
  new Blob([JSON.stringify(versionTwoArchive)], { type: "application/json" }),
  "contacts-v2.json"
);
await request("/api/contacts/import", { method: "POST", body: versionTwoForm });

const graph = await request("/api/graph");
const selfEdge = graph.edges.find((edge) => edge.target === created.contact.id && edge.scope === "self");
assert.equal(selfEdge.lastInteractionDate, "2026-07-20");

console.log(`API compatibility verification passed for canonical writes, v1/v2 archives, and derived recency. Contact: ${created.contact.id}`);
