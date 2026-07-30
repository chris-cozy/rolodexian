import assert from "node:assert/strict";

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  return payload;
}

async function expectFailure(path, status, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, status, `${options.method || "GET"} ${path} should return ${status}.`);
  assert.ok(payload.error, `${options.method || "GET"} ${path} should return an error message.`);
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
assert.ok(created.contact.profile);
assert.deepEqual(
  created.contact.profile.sections.map((section) => section.type),
  ["importantDates", "preferences", "interactions"]
);
await expectFailure(`/api/contacts/${created.contact.id}/profile/sections`, 409, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "preferences" })
});

const profileUpdated = await request(`/api/contacts/${created.contact.id}/profile`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ descriptor: "A concise API verification profile." })
});
assert.equal(profileUpdated.contact.profile.descriptor, "A concise API verification profile.");

const markdownSection = await request(`/api/contacts/${created.contact.id}/profile/sections`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    type: "markdown",
    title: "Biography",
    content: { markdown: "## API profile\n\nMarkdown content." }
  })
});
assert.equal(markdownSection.section.type, "markdown");

const gallerySection = await request(`/api/contacts/${created.contact.id}/profile/sections`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "gallery", title: "Moments" })
});

const galleryForm = new FormData();
galleryForm.append("images", new Blob(["gallery-image"], { type: "image/png" }), "gallery.png");
const galleryUpload = await request(`/api/profile-sections/${gallerySection.section.id}/images`, {
  method: "POST",
  body: galleryForm
});
assert.equal(galleryUpload.items.length, 1);
const galleryItem = await request(`/api/profile-section-images/${galleryUpload.items[0].id}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ caption: "API gallery caption" })
});
assert.equal(galleryItem.item.caption, "API gallery caption");

const backgroundForm = new FormData();
backgroundForm.append("image", new Blob(["background-image"], { type: "image/jpeg" }), "background.jpg");
const backgroundUpload = await request(`/api/contacts/${created.contact.id}/profile/background`, {
  method: "POST",
  body: backgroundForm
});
assert.equal(backgroundUpload.contact.profile.backgroundImage.kind, "background");

const orderedSectionIds = [
  markdownSection.section.id,
  gallerySection.section.id,
  ...created.contact.profile.sections.map((section) => section.id)
];
const reordered = await request(`/api/contacts/${created.contact.id}/profile/sections/order`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sectionIds: orderedSectionIds })
});
assert.deepEqual(reordered.sections.map((section) => section.id), orderedSectionIds);
await expectFailure(`/api/contacts/${created.contact.id}/profile/sections/order`, 400, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sectionIds: orderedSectionIds.slice(1) })
});

const exportResponse = await fetch(`${baseUrl}/api/contacts/export`);
assert.ok(exportResponse.ok, `Export failed: ${exportResponse.status}`);
const versionThreeArchive = await exportResponse.json();
assert.equal(versionThreeArchive.version, 3);
assert.ok(versionThreeArchive.contacts.every((contact) => Array.isArray(contact.preferences.favoriteColors)));
assert.ok(
  versionThreeArchive.contacts.every((contact) =>
    contact.importantDates.every((importantDate) => typeof importantDate === "object")
  )
);
const exportedCustomized = versionThreeArchive.contacts.find((contact) => contact.id === created.contact.id);
assert.equal(exportedCustomized.profile.descriptor, "A concise API verification profile.");
assert.ok(exportedCustomized.images.some((image) => image.id === exportedCustomized.profile.backgroundImageId && image.kind === "background"));
assert.equal(exportedCustomized.profile.sections[1].galleryItems[0].caption, "API gallery caption");

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

const versionTwoId = "api-archive-v2-contact";
const versionTwoArchive = {
  format: "rolodexian.contacts-export",
  version: 2,
  exportedAt: new Date().toISOString(),
  contacts: [
    {
      id: versionTwoId,
      name: "Version Two Import",
      nicknames: [],
      relationshipType: "Friend",
      relationshipStrength: 70,
      importantDates: [{ date: "2028-05-02", description: "Version two milestone" }],
      appearance: {},
      traits: ["portable"],
      preferences: { favoriteColors: ["Blue"] },
      summary: "Version two profile summary.",
      customFields: {},
      socialAccounts: [],
      interactions: [],
      images: [],
      profileImageId: null
    }
  ],
  relationships: []
};
const versionTwoForm = new FormData();
versionTwoForm.append(
  "archive",
  new Blob([JSON.stringify(versionTwoArchive)], { type: "application/json" }),
  "contacts-v2.json"
);
await request("/api/contacts/import", { method: "POST", body: versionTwoForm });
const importedV2 = await request(`/api/contacts/${versionTwoId}`);
assert.deepEqual(importedV2.contact.profile.sections.map((section) => section.type), [
  "markdown",
  "importantDates",
  "preferences"
]);

const versionThreeForm = new FormData();
versionThreeForm.append(
  "archive",
  new Blob([JSON.stringify(versionThreeArchive)], { type: "application/json" }),
  "contacts-v3.json"
);
await request("/api/contacts/import", { method: "POST", body: versionThreeForm });
const roundTripped = await request(`/api/contacts/${created.contact.id}`);
assert.equal(roundTripped.contact.profile.descriptor, "A concise API verification profile.");
assert.equal(roundTripped.contact.profile.sections[1].galleryItems[0].caption, "API gallery caption");
await request(`/api/profile-section-images/${roundTripped.contact.profile.sections[1].galleryItems[0].id}`, { method: "DELETE" });
const afterMembershipRemoval = await request(`/api/contacts/${created.contact.id}`);
assert.equal(afterMembershipRemoval.contact.profile.sections[1].galleryItems.length, 0);
assert.ok(afterMembershipRemoval.contact.images.some((image) => image.kind === "additional"));
const withoutBackground = await request(`/api/contacts/${created.contact.id}/profile/background`, { method: "DELETE" });
assert.equal(withoutBackground.contact.profile.backgroundImage, null);

const graph = await request("/api/graph");
const selfEdge = graph.edges.find((edge) => edge.target === created.contact.id && edge.scope === "self");
assert.equal(selfEdge.lastInteractionDate, "2026-07-20");

console.log(`API compatibility verification passed for profile customization, v1/v2/v3 archives, and derived recency. Contact: ${created.contact.id}`);
