const apiBase = process.env.SEED_API_URL || "http://localhost:4000";
const seedMarker = "rolodexian-demo";
const clearOnly = process.argv.includes("--clear");

const contacts = [
  {
    key: "maya",
    name: "Maya Chen",
    nicknames: ["May", "MC"],
    birthdate: "1994-04-12",
    relationshipType: "Friend",
    relationshipStrength: 91,
    lastInteractionDate: "2026-06-22",
    selfRelationshipNotes: "Close friend from the neighborhood dinner group.",
    importantDates: ["2021-09-18 - Met at Ana's rooftop dinner", "2026-04-12 - Birthday"],
    appearance: {
      race: "East Asian",
      sex: "Female",
      details: "Short black hair, round glasses, usually wears olive or charcoal jackets.",
      descriptors: "Warm smile, quick laugh, calm presence."
    },
    traits: ["thoughtful", "dry humor", "planner"],
    preferences: {
      favoriteColor: "Olive green",
      favoriteFoods: ["ramen", "mango sticky rice", "jasmine tea ice cream"],
      interests: ["urban gardening", "indie films", "ceramics"],
      likes: ["quiet cafes", "handwritten notes"],
      dislikes: ["last-minute venue changes"],
      other: "Keeps a shared list of restaurants to try."
    },
    summary: "Maya is one of the strongest personal ties in the graph. She is connected to Priya through ceramics and knows Marcus from group dinners.",
    customFields: { city: "Seattle", seed: seedMarker },
    socialAccounts: [
      { platform: "Instagram", username: "maya.makes", url: "https://example.com/maya", notes: "Ceramics and garden photos" },
      { platform: "Signal", username: "Maya C.", url: "", notes: "Preferred messaging" }
    ],
    interactions: [
      { title: "Dinner at Soba House", occurredOn: "2026-06-22", notes: "Talked about summer travel and pottery sale." },
      { title: "Birthday call", occurredOn: "2026-04-12", notes: "Sent cookbook recommendation afterward." }
    ],
    colors: ["#155e54", "#f5f0e6"],
    extraImage: "Ceramics"
  },
  {
    key: "marcus",
    name: "Marcus Brooks",
    nicknames: ["Marc"],
    birthdate: "1991-11-03",
    relationshipType: "Romantic partner",
    relationshipStrength: 96,
    lastInteractionDate: "2026-06-25",
    selfRelationshipNotes: "Primary partner. High-priority relationship and frequent interactions.",
    importantDates: ["2024-02-14 - First date", "2026-11-03 - Birthday"],
    appearance: {
      race: "Black",
      sex: "Male",
      details: "Tall, close-cropped hair, usually in dark denim and clean sneakers.",
      descriptors: "Expressive eyebrows, relaxed posture."
    },
    traits: ["generous", "direct", "music nerd"],
    preferences: {
      favoriteColor: "Deep teal",
      favoriteFoods: ["jerk chicken", "lemon tart", "pistachio gelato"],
      interests: ["vinyl records", "bike rides", "documentaries"],
      likes: ["early plans", "window seats"],
      dislikes: ["overpacked weekends"],
      other: "Usually wants coffee before errands."
    },
    summary: "Marcus is the strongest direct connection. He overlaps with Maya and Jordan socially.",
    customFields: { city: "Seattle", seed: seedMarker },
    socialAccounts: [
      { platform: "Spotify", username: "marcus-listens", url: "https://example.com/marcus", notes: "Playlist sharing" }
    ],
    interactions: [
      { title: "Morning walk", occurredOn: "2026-06-25", notes: "Discussed July plans." },
      { title: "Record shop", occurredOn: "2026-06-15", notes: "Picked up a jazz reissue." }
    ],
    colors: ["#254441", "#f3e2cd"],
    extraImage: "Records"
  },
  {
    key: "sofia",
    name: "Sofia Alvarez",
    nicknames: ["Sofi"],
    birthdate: "1988-08-29",
    relationshipType: "Family",
    relationshipStrength: 88,
    lastInteractionDate: "2026-06-10",
    selfRelationshipNotes: "Cousin who is also the family calendar anchor.",
    importantDates: ["2026-08-29 - Birthday", "2026-12-24 - Family dinner"],
    appearance: {
      race: "Latina",
      sex: "Female",
      details: "Long curly brown hair, bright patterned scarves.",
      descriptors: "Animated gestures, big laugh."
    },
    traits: ["protective", "organized", "storyteller"],
    preferences: {
      favoriteColor: "Marigold",
      favoriteFoods: ["tamales", "flan", "strawberry ice cream"],
      interests: ["family history", "salsa nights"],
      likes: ["voice notes", "photo albums"],
      dislikes: ["vague RSVPs"],
      other: "Remembers everyone's birthdays."
    },
    summary: "Sofia links the family cluster and has a strong relationship with Nora.",
    customFields: { city: "Portland", seed: seedMarker },
    socialAccounts: [
      { platform: "Facebook", username: "sofia.alvarez", url: "https://example.com/sofia", notes: "Family photos" }
    ],
    interactions: [
      { title: "Family planning call", occurredOn: "2026-06-10", notes: "Coordinated summer reunion logistics." }
    ],
    colors: ["#bd6d26", "#fff6e7"],
    extraImage: "Family"
  },
  {
    key: "theo",
    name: "Theo Parker",
    nicknames: ["TP"],
    birthdate: "1990-02-17",
    relationshipType: "Coworker",
    relationshipStrength: 64,
    lastInteractionDate: "2026-05-29",
    selfRelationshipNotes: "Former project partner. Good person to check in with before major launches.",
    importantDates: ["2023-03-06 - Started Orion project"],
    appearance: {
      race: "White",
      sex: "Male",
      details: "Sandy hair, square frames, mostly button-down shirts.",
      descriptors: "Fast walker, neat notebook."
    },
    traits: ["analytical", "reserved", "reliable"],
    preferences: {
      favoriteColor: "Slate green",
      favoriteFoods: ["pho", "salted caramel", "black coffee"],
      interests: ["systems design", "trail running"],
      likes: ["clear agendas", "short meetings"],
      dislikes: ["surprise deadlines"],
      other: "Prefers email for work topics."
    },
    summary: "Theo is part of the work cluster and knows Alex from climbing.",
    customFields: { company: "Northstar Labs", seed: seedMarker },
    socialAccounts: [
      { platform: "LinkedIn", username: "theoparker", url: "https://example.com/theo", notes: "Professional updates" }
    ],
    interactions: [
      { title: "Launch retro", occurredOn: "2026-05-29", notes: "Compared notes on vendor handoff." }
    ],
    colors: ["#3f5f59", "#edf3f0"],
    extraImage: "Launch"
  },
  {
    key: "priya",
    name: "Priya Shah",
    nicknames: ["Pri"],
    birthdate: "1996-01-23",
    relationshipType: "Friend",
    relationshipStrength: 79,
    lastInteractionDate: "2026-06-18",
    selfRelationshipNotes: "Friend from the ceramics studio. Often coordinates small group outings.",
    importantDates: ["2026-01-23 - Birthday"],
    appearance: {
      race: "South Asian",
      sex: "Female",
      details: "Shoulder-length dark hair, silver nose stud, colorful sweaters.",
      descriptors: "Energetic, expressive hands."
    },
    traits: ["curious", "high energy", "connector"],
    preferences: {
      favoriteColor: "Cobalt",
      favoriteFoods: ["chana masala", "brownies", "mint chip"],
      interests: ["ceramics", "live comedy", "book clubs"],
      likes: ["spontaneous walks", "good stationery"],
      dislikes: ["being late"],
      other: "Collects tiny handmade bowls."
    },
    summary: "Priya connects the ceramics/social cluster and knows Maya well.",
    customFields: { city: "Seattle", seed: seedMarker },
    socialAccounts: [
      { platform: "Instagram", username: "priya.clay", url: "https://example.com/priya", notes: "Studio work" },
      { platform: "Threads", username: "priyashah", url: "https://example.com/priya-threads", notes: "" }
    ],
    interactions: [
      { title: "Studio night", occurredOn: "2026-06-18", notes: "Worked on glazing and made dinner plans." }
    ],
    colors: ["#305d9c", "#eef3fb"],
    extraImage: "Studio"
  },
  {
    key: "alex",
    name: "Alex Kim",
    nicknames: ["AK"],
    birthdate: "1993-07-06",
    relationshipType: "Custom",
    customRelationshipType: "Climbing friend",
    relationshipStrength: 58,
    lastInteractionDate: "2026-04-27",
    selfRelationshipNotes: "Friendly connection mostly through climbing gym sessions.",
    importantDates: ["2022-10-02 - First climbing session"],
    appearance: {
      race: "Korean American",
      sex: "Nonbinary",
      details: "Short undercut, usually in technical hoodies.",
      descriptors: "Calm voice, focused eye contact."
    },
    traits: ["steady", "encouraging", "low-key"],
    preferences: {
      favoriteColor: "Forest green",
      favoriteFoods: ["bibimbap", "matcha soft serve"],
      interests: ["bouldering", "film photography"],
      likes: ["gear talk", "quiet hangs"],
      dislikes: ["crowded gyms"],
      other: "Good person for low-pressure weekend plans."
    },
    summary: "Alex is a custom relationship type and bridges the work and climbing edges through Theo.",
    customFields: { gym: "Vertical Loft", seed: seedMarker },
    socialAccounts: [
      { platform: "Instagram", username: "alex.climbs", url: "https://example.com/alex", notes: "Climbing clips" }
    ],
    interactions: [
      { title: "Bouldering session", occurredOn: "2026-04-27", notes: "Talked about a possible outdoor trip." }
    ],
    colors: ["#2b6b4d", "#e9f5ec"],
    extraImage: "Climb"
  },
  {
    key: "nora",
    name: "Nora Patel",
    nicknames: ["Nor"],
    birthdate: "2000-05-14",
    relationshipType: "Family",
    relationshipStrength: 72,
    lastInteractionDate: "2026-03-12",
    selfRelationshipNotes: "Younger cousin. Best reached by text.",
    importantDates: ["2026-05-14 - Birthday", "2026-09-01 - Semester starts"],
    appearance: {
      race: "South Asian",
      sex: "Female",
      details: "Long dark hair, oversized glasses, canvas tote bag.",
      descriptors: "Thoughtful, quiet until comfortable."
    },
    traits: ["observant", "creative", "reserved"],
    preferences: {
      favoriteColor: "Lavender",
      favoriteFoods: ["sushi", "cheesecake", "black sesame ice cream"],
      interests: ["illustration", "anime", "environmental science"],
      likes: ["bookstore gift cards", "tea"],
      dislikes: ["phone calls without warning"],
      other: "Usually responds late evening."
    },
    summary: "Nora is part of the family cluster through Sofia.",
    customFields: { school: "UW", seed: seedMarker },
    socialAccounts: [
      { platform: "Discord", username: "nora_draws", url: "", notes: "Most responsive here" }
    ],
    interactions: [
      { title: "Text thread", occurredOn: "2026-03-12", notes: "Asked about internship applications." }
    ],
    colors: ["#7763a8", "#f1edfb"],
    extraImage: "Sketch"
  },
  {
    key: "jordan",
    name: "Jordan Reed",
    nicknames: ["Jord"],
    birthdate: "1987-10-09",
    relationshipType: "Acquaintance",
    relationshipStrength: 34,
    lastInteractionDate: "2025-11-08",
    selfRelationshipNotes: "Knows Marcus and sometimes appears at group events.",
    importantDates: ["2025-11-08 - Last group hang"],
    appearance: {
      race: "White",
      sex: "Male",
      details: "Buzz cut, leather jacket, often carries a camera.",
      descriptors: "Quiet observer, sharp sense of humor."
    },
    traits: ["witty", "sporadic", "private"],
    preferences: {
      favoriteColor: "Black",
      favoriteFoods: ["pizza", "espresso", "vanilla custard"],
      interests: ["street photography", "punk shows"],
      likes: ["small venues", "old cameras"],
      dislikes: ["big group chats"],
      other: "Better in person than over text."
    },
    summary: "Jordan demonstrates a weaker faded direct relationship because the last interaction is older.",
    customFields: { city: "Tacoma", seed: seedMarker },
    socialAccounts: [
      { platform: "Instagram", username: "reed.frames", url: "https://example.com/jordan", notes: "Photography account" }
    ],
    interactions: [
      { title: "Group concert", occurredOn: "2025-11-08", notes: "Brief catch-up after the show." }
    ],
    colors: ["#333333", "#ece7dd"],
    extraImage: "Concert"
  }
];

const relationships = [
  ["maya", "priya", "Friend", 88, "Ceramics studio friends.", "2024-05-01", "2026-06-18"],
  ["maya", "marcus", "Friend", 76, "Know each other through group dinners.", "2024-03-02", "2026-06-22"],
  ["marcus", "jordan", "Friend", 60, "Concert friends with occasional check-ins.", "2022-08-12", "2025-11-08"],
  ["sofia", "nora", "Family", 84, "Cousins who coordinate family updates.", "2000-05-14", "2026-03-12"],
  ["theo", "alex", "Coworker", 62, "Met through work and climb together.", "2023-04-19", "2026-04-27"],
  ["theo", "maya", "Acquaintance", 35, "Met at one dinner.", "2025-12-05", "2025-12-05"],
  ["priya", "alex", "Acquaintance", 48, "Both attend the same climbing gym occasionally.", "2025-09-10", "2026-01-20"]
];

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${options.method || "GET"} ${path} failed with ${response.status}`);
  }
  return payload;
}

function svgAvatar(name, [primary, secondary], label = "") {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <rect width="640" height="640" fill="${secondary}"/>
  <circle cx="320" cy="260" r="150" fill="${primary}" opacity="0.96"/>
  <circle cx="250" cy="230" r="22" fill="${secondary}" opacity="0.8"/>
  <circle cx="390" cy="230" r="22" fill="${secondary}" opacity="0.8"/>
  <path d="M235 335c48 52 121 52 170 0" fill="none" stroke="${secondary}" stroke-width="24" stroke-linecap="round" opacity="0.8"/>
  <text x="320" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="88" font-weight="700" fill="${primary}">${initials}</text>
  <text x="320" y="585" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${primary}" opacity="0.78">${label}</text>
</svg>`;
}

function svgScene(label, [primary, secondary]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" fill="${secondary}"/>
  <rect x="70" y="70" width="760" height="460" rx="34" fill="white" opacity="0.72"/>
  <circle cx="215" cy="220" r="82" fill="${primary}" opacity="0.9"/>
  <rect x="340" y="180" width="330" height="28" rx="14" fill="${primary}" opacity="0.72"/>
  <rect x="340" y="240" width="410" height="28" rx="14" fill="${primary}" opacity="0.45"/>
  <rect x="150" y="385" width="600" height="42" rx="21" fill="${primary}" opacity="0.82"/>
  <text x="450" y="488" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="${primary}">${label}</text>
</svg>`;
}

async function uploadSvg(contactId, kind, filename, svg) {
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("image", new Blob([svg], { type: "image/svg+xml" }), filename);
  return request(`/api/contacts/${contactId}/images`, {
    method: "POST",
    body: formData
  });
}

async function clearDemoContacts() {
  const { contacts: existingContacts } = await request("/api/contacts");
  const demoContacts = existingContacts.filter((contact) => contact.customFields?.seed === seedMarker);
  for (const contact of demoContacts) {
    await request(`/api/contacts/${contact.id}`, { method: "DELETE" });
  }
  return demoContacts.length;
}

async function seed() {
  await request("/api/health");
  const removed = await clearDemoContacts();

  if (clearOnly) {
    console.log(`Removed ${removed} demo contacts.`);
    return;
  }

  const created = new Map();

  for (const contact of contacts) {
    const { key, colors, extraImage, ...payload } = contact;
    const { contact: createdContact } = await request("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    created.set(key, createdContact);

    await uploadSvg(createdContact.id, "profile", `${key}-profile.svg`, svgAvatar(contact.name, colors, "Profile"));
    await uploadSvg(createdContact.id, "additional", `${key}-${extraImage.toLowerCase()}.svg`, svgScene(extraImage, colors));
  }

  for (const [sourceKey, targetKey, relationshipType, relationshipStrength, notes, startDate, lastInteractionDate] of relationships) {
    await request("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceContactId: created.get(sourceKey).id,
        targetContactId: created.get(targetKey).id,
        relationshipType,
        relationshipStrength,
        notes,
        startDate,
        lastInteractionDate
      })
    });
  }

  console.log(`Seeded ${contacts.length} contacts, ${relationships.length} relationships, and ${contacts.length * 2} images.`);
  console.log(`Open ${apiBase}`);
}

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
