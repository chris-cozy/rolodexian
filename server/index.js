import cors from "cors";
import Database from "better-sqlite3";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, "uploads");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "rolodexian.sqlite");
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";
const distDir = path.join(rootDir, "dist");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nicknames TEXT NOT NULL DEFAULT '[]',
  birthdate TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'Acquaintance',
  custom_relationship_type TEXT,
  relationship_strength INTEGER NOT NULL DEFAULT 50,
  last_interaction_date TEXT,
  self_relationship_notes TEXT,
  important_dates TEXT NOT NULL DEFAULT '[]',
  appearance TEXT NOT NULL DEFAULT '{}',
  traits TEXT NOT NULL DEFAULT '[]',
  preferences TEXT NOT NULL DEFAULT '{}',
  summary TEXT,
  custom_fields TEXT NOT NULL DEFAULT '{}',
  profile_image_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  platform TEXT,
  username TEXT,
  url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS interaction_events (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT,
  occurred_on TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  kind TEXT NOT NULL DEFAULT 'additional',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  target_contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'Acquaintance',
  custom_relationship_type TEXT,
  relationship_strength INTEGER NOT NULL DEFAULT 50,
  notes TEXT,
  start_date TEXT,
  last_interaction_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_contact_id <> target_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_social_contact ON social_accounts(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interaction_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_images_contact ON images(contact_id);
CREATE INDEX IF NOT EXISTS idx_relationship_source ON relationships(source_contact_id);
CREATE INDEX IF NOT EXISTS idx_relationship_target ON relationships(target_contact_id);
`);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  }
});

const app = express();

if (!isProduction) {
  app.use(cors({ origin: true }));
}

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadDir));

function nowIso() {
  return new Date().toISOString();
}

function clampStrength(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function jsonString(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeContactInput(body) {
  return {
    name: optionalText(body.name),
    nicknames: stringList(body.nicknames),
    birthdate: optionalText(body.birthdate),
    relationshipType: optionalText(body.relationshipType) || "Acquaintance",
    customRelationshipType: optionalText(body.customRelationshipType),
    relationshipStrength: clampStrength(body.relationshipStrength),
    lastInteractionDate: optionalText(body.lastInteractionDate),
    selfRelationshipNotes: optionalText(body.selfRelationshipNotes),
    importantDates: Array.isArray(body.importantDates) ? body.importantDates : [],
    appearance: body.appearance && typeof body.appearance === "object" ? body.appearance : {},
    traits: stringList(body.traits),
    preferences: body.preferences && typeof body.preferences === "object" ? body.preferences : {},
    summary: optionalText(body.summary),
    customFields: body.customFields && typeof body.customFields === "object" ? body.customFields : {},
    socialAccounts: Array.isArray(body.socialAccounts) ? body.socialAccounts : [],
    interactions: Array.isArray(body.interactions) ? body.interactions : []
  };
}

function imageUrl(row) {
  return `/uploads/${row.filename}`;
}

function mapImage(row) {
  return {
    id: row.id,
    contactId: row.contact_id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    kind: row.kind,
    notes: row.notes,
    createdAt: row.created_at,
    url: imageUrl(row)
  };
}

function mapContact(row) {
  return {
    id: row.id,
    name: row.name,
    nicknames: parseJson(row.nicknames, []),
    birthdate: row.birthdate,
    relationshipType: row.relationship_type,
    customRelationshipType: row.custom_relationship_type,
    relationshipStrength: row.relationship_strength,
    lastInteractionDate: row.last_interaction_date,
    selfRelationshipNotes: row.self_relationship_notes,
    importantDates: parseJson(row.important_dates, []),
    appearance: parseJson(row.appearance, {}),
    traits: parseJson(row.traits, []),
    preferences: parseJson(row.preferences, {}),
    summary: row.summary,
    customFields: parseJson(row.custom_fields, {}),
    profileImageId: row.profile_image_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    socialAccounts: [],
    interactions: [],
    images: [],
    profileImage: null
  };
}

const contactSelect = db.prepare("SELECT * FROM contacts WHERE id = ?");
const socialSelect = db.prepare("SELECT * FROM social_accounts WHERE contact_id = ? ORDER BY platform COLLATE NOCASE, username COLLATE NOCASE");
const interactionSelect = db.prepare("SELECT * FROM interaction_events WHERE contact_id = ? ORDER BY COALESCE(occurred_on, '') DESC, title COLLATE NOCASE");
const imageSelect = db.prepare("SELECT * FROM images WHERE contact_id = ? ORDER BY kind DESC, created_at DESC");

function getFullContact(id) {
  const row = contactSelect.get(id);
  if (!row) return null;
  const contact = mapContact(row);
  contact.socialAccounts = socialSelect.all(id).map((account) => ({
    id: account.id,
    contactId: account.contact_id,
    platform: account.platform,
    username: account.username,
    url: account.url,
    notes: account.notes
  }));
  contact.interactions = interactionSelect.all(id).map((event) => ({
    id: event.id,
    contactId: event.contact_id,
    title: event.title,
    occurredOn: event.occurred_on,
    notes: event.notes
  }));
  contact.images = imageSelect.all(id).map(mapImage);
  contact.profileImage = contact.images.find((image) => image.id === contact.profileImageId) || null;
  return contact;
}

function getAllContacts() {
  return db.prepare("SELECT * FROM contacts ORDER BY updated_at DESC, name COLLATE NOCASE ASC").all().map((row) => getFullContact(row.id));
}

const insertSocial = db.prepare(`
  INSERT INTO social_accounts (id, contact_id, platform, username, url, notes)
  VALUES (@id, @contactId, @platform, @username, @url, @notes)
`);

const insertInteraction = db.prepare(`
  INSERT INTO interaction_events (id, contact_id, title, occurred_on, notes)
  VALUES (@id, @contactId, @title, @occurredOn, @notes)
`);

function replaceChildRows(contactId, input) {
  db.prepare("DELETE FROM social_accounts WHERE contact_id = ?").run(contactId);
  db.prepare("DELETE FROM interaction_events WHERE contact_id = ?").run(contactId);

  for (const account of input.socialAccounts) {
    const hasData = [account.platform, account.username, account.url, account.notes].some(optionalText);
    if (!hasData) continue;
    insertSocial.run({
      id: account.id || randomUUID(),
      contactId,
      platform: optionalText(account.platform),
      username: optionalText(account.username),
      url: optionalText(account.url),
      notes: optionalText(account.notes)
    });
  }

  for (const event of input.interactions) {
    const hasData = [event.title, event.occurredOn, event.notes].some(optionalText);
    if (!hasData) continue;
    insertInteraction.run({
      id: event.id || randomUUID(),
      contactId,
      title: optionalText(event.title),
      occurredOn: optionalText(event.occurredOn),
      notes: optionalText(event.notes)
    });
  }
}

const createContactTx = db.transaction((input) => {
  const id = randomUUID();
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO contacts (
      id, name, nicknames, birthdate, relationship_type, custom_relationship_type,
      relationship_strength, last_interaction_date, self_relationship_notes, important_dates,
      appearance, traits, preferences, summary, custom_fields, created_at, updated_at
    )
    VALUES (
      @id, @name, @nicknames, @birthdate, @relationshipType, @customRelationshipType,
      @relationshipStrength, @lastInteractionDate, @selfRelationshipNotes, @importantDates,
      @appearance, @traits, @preferences, @summary, @customFields, @createdAt, @updatedAt
    )
  `).run({
    id,
    name: input.name,
    nicknames: jsonString(input.nicknames, []),
    birthdate: input.birthdate,
    relationshipType: input.relationshipType,
    customRelationshipType: input.customRelationshipType,
    relationshipStrength: input.relationshipStrength,
    lastInteractionDate: input.lastInteractionDate,
    selfRelationshipNotes: input.selfRelationshipNotes,
    importantDates: jsonString(input.importantDates, []),
    appearance: jsonString(input.appearance, {}),
    traits: jsonString(input.traits, []),
    preferences: jsonString(input.preferences, {}),
    summary: input.summary,
    customFields: jsonString(input.customFields, {}),
    createdAt: timestamp,
    updatedAt: timestamp
  });
  replaceChildRows(id, input);
  return id;
});

const updateContactTx = db.transaction((id, input) => {
  const timestamp = nowIso();
  db.prepare(`
    UPDATE contacts SET
      name = @name,
      nicknames = @nicknames,
      birthdate = @birthdate,
      relationship_type = @relationshipType,
      custom_relationship_type = @customRelationshipType,
      relationship_strength = @relationshipStrength,
      last_interaction_date = @lastInteractionDate,
      self_relationship_notes = @selfRelationshipNotes,
      important_dates = @importantDates,
      appearance = @appearance,
      traits = @traits,
      preferences = @preferences,
      summary = @summary,
      custom_fields = @customFields,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    name: input.name,
    nicknames: jsonString(input.nicknames, []),
    birthdate: input.birthdate,
    relationshipType: input.relationshipType,
    customRelationshipType: input.customRelationshipType,
    relationshipStrength: input.relationshipStrength,
    lastInteractionDate: input.lastInteractionDate,
    selfRelationshipNotes: input.selfRelationshipNotes,
    importantDates: jsonString(input.importantDates, []),
    appearance: jsonString(input.appearance, {}),
    traits: jsonString(input.traits, []),
    preferences: jsonString(input.preferences, {}),
    summary: input.summary,
    customFields: jsonString(input.customFields, {}),
    updatedAt: timestamp
  });
  replaceChildRows(id, input);
});

function relationshipLabel(row) {
  return row.relationship_type === "Custom" && row.custom_relationship_type
    ? row.custom_relationship_type
    : row.relationship_type;
}

function mapRelationship(row) {
  return {
    id: row.id,
    sourceContactId: row.source_contact_id,
    targetContactId: row.target_contact_id,
    sourceName: row.source_name,
    targetName: row.target_name,
    relationshipType: row.relationship_type,
    customRelationshipType: row.custom_relationship_type,
    relationshipLabel: relationshipLabel(row),
    relationshipStrength: row.relationship_strength,
    notes: row.notes,
    startDate: row.start_date,
    lastInteractionDate: row.last_interaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function allRelationships() {
  return db.prepare(`
    SELECT relationships.*, source.name AS source_name, target.name AS target_name
    FROM relationships
    JOIN contacts source ON source.id = relationships.source_contact_id
    JOIN contacts target ON target.id = relationships.target_contact_id
    ORDER BY updated_at DESC
  `).all().map(mapRelationship);
}

function getRelationship(id) {
  const row = db.prepare(`
    SELECT relationships.*, source.name AS source_name, target.name AS target_name
    FROM relationships
    JOIN contacts source ON source.id = relationships.source_contact_id
    JOIN contacts target ON target.id = relationships.target_contact_id
    WHERE relationships.id = ?
  `).get(id);
  return row ? mapRelationship(row) : null;
}

function normalizeRelationshipInput(body) {
  return {
    sourceContactId: optionalText(body.sourceContactId),
    targetContactId: optionalText(body.targetContactId),
    relationshipType: optionalText(body.relationshipType) || "Acquaintance",
    customRelationshipType: optionalText(body.customRelationshipType),
    relationshipStrength: clampStrength(body.relationshipStrength),
    notes: optionalText(body.notes),
    startDate: optionalText(body.startDate),
    lastInteractionDate: optionalText(body.lastInteractionDate)
  };
}

function daysSince(dateText) {
  if (!dateText) return null;
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function recencyScore(dateText) {
  const days = daysSince(dateText);
  if (days === null) return 50;
  if (days <= 7) return 100;
  if (days <= 30) return 88;
  if (days <= 90) return 72;
  if (days <= 180) return 58;
  if (days <= 365) return 42;
  return 25;
}

function suggestedStrength(manualStrength, lastInteractionDate, recencyWeight = 0.25) {
  const manual = clampStrength(manualStrength);
  const recency = recencyScore(lastInteractionDate);
  return clampStrength(manual * (1 - recencyWeight) + recency * recencyWeight);
}

function validateRelationship(input, existingId = null) {
  if (!input.sourceContactId || !input.targetContactId) {
    return "Both contacts are required.";
  }
  if (input.sourceContactId === input.targetContactId) {
    return "A contact cannot be related to itself.";
  }
  if (!contactSelect.get(input.sourceContactId) || !contactSelect.get(input.targetContactId)) {
    return "One of the selected contacts no longer exists.";
  }
  const duplicate = db.prepare(`
    SELECT id FROM relationships
    WHERE id <> COALESCE(?, '')
      AND (
        (source_contact_id = ? AND target_contact_id = ?)
        OR (source_contact_id = ? AND target_contact_id = ?)
      )
  `).get(existingId, input.sourceContactId, input.targetContactId, input.targetContactId, input.sourceContactId);
  if (duplicate) {
    return "Those contacts are already connected.";
  }
  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dataDir, uploadDir });
});

app.get("/api/contacts", (req, res) => {
  const search = optionalText(req.query.search)?.toLowerCase();
  const relationshipType = optionalText(req.query.relationshipType);
  let contacts = getAllContacts();

  if (relationshipType) {
    contacts = contacts.filter((contact) => contact.relationshipType === relationshipType);
  }

  if (search) {
    contacts = contacts.filter((contact) => {
      const searchable = [
        contact.name,
        contact.relationshipType,
        contact.customRelationshipType,
        contact.summary,
        JSON.stringify(contact.nicknames),
        JSON.stringify(contact.appearance),
        JSON.stringify(contact.traits),
        JSON.stringify(contact.preferences),
        JSON.stringify(contact.customFields),
        JSON.stringify(contact.socialAccounts)
      ].join(" ").toLowerCase();
      return searchable.includes(search);
    });
  }

  res.json({ contacts });
});

app.post("/api/contacts", (req, res) => {
  const input = normalizeContactInput(req.body);
  if (!input.name) {
    return res.status(400).json({ error: "Name is required." });
  }
  const id = createContactTx(input);
  res.status(201).json({ contact: getFullContact(id) });
});

app.get("/api/contacts/:id", (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  res.json({ contact });
});

app.put("/api/contacts/:id", (req, res) => {
  if (!contactSelect.get(req.params.id)) {
    return res.status(404).json({ error: "Contact not found." });
  }
  const input = normalizeContactInput(req.body);
  if (!input.name) {
    return res.status(400).json({ error: "Name is required." });
  }
  updateContactTx(req.params.id, input);
  res.json({ contact: getFullContact(req.params.id) });
});

app.delete("/api/contacts/:id", async (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
  await Promise.allSettled(
    contact.images.map((image) => fsp.unlink(path.join(uploadDir, image.filename)))
  );
  res.status(204).end();
});

app.post("/api/contacts/:id/images", upload.single("image"), async (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  if (!req.file) return res.status(400).json({ error: "Image file is required." });

  const id = randomUUID();
  const kind = req.body.kind === "profile" ? "profile" : "additional";
  const previousProfileImages = kind === "profile"
    ? db.prepare("SELECT id, filename FROM images WHERE contact_id = ? AND kind = 'profile'").all(req.params.id)
    : [];

  db.prepare(`
    INSERT INTO images (id, contact_id, filename, original_name, mime_type, size, kind, notes, created_at)
    VALUES (@id, @contactId, @filename, @originalName, @mimeType, @size, @kind, @notes, @createdAt)
  `).run({
    id,
    contactId: req.params.id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    kind,
    notes: optionalText(req.body.notes),
    createdAt: nowIso()
  });

  if (kind === "profile") {
    db.prepare("UPDATE contacts SET profile_image_id = ?, updated_at = ? WHERE id = ?").run(id, nowIso(), req.params.id);
    db.prepare("DELETE FROM images WHERE contact_id = ? AND kind = 'profile' AND id <> ?").run(req.params.id, id);
    await Promise.allSettled(
      previousProfileImages.map((image) => fsp.unlink(path.join(uploadDir, image.filename)))
    );
  }

  res.status(201).json({ contact: getFullContact(req.params.id) });
});

app.delete("/api/images/:id", async (req, res) => {
  const image = db.prepare("SELECT * FROM images WHERE id = ?").get(req.params.id);
  if (!image) return res.status(404).json({ error: "Image not found." });
  db.prepare("UPDATE contacts SET profile_image_id = NULL WHERE profile_image_id = ?").run(req.params.id);
  db.prepare("DELETE FROM images WHERE id = ?").run(req.params.id);
  await fsp.unlink(path.join(uploadDir, image.filename)).catch(() => {});
  res.status(204).end();
});

app.get("/api/relationships", (_req, res) => {
  res.json({ relationships: allRelationships() });
});

app.post("/api/relationships", (req, res) => {
  const input = normalizeRelationshipInput(req.body);
  const validationError = validateRelationship(input);
  if (validationError) return res.status(400).json({ error: validationError });

  const id = randomUUID();
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO relationships (
      id, source_contact_id, target_contact_id, relationship_type, custom_relationship_type,
      relationship_strength, notes, start_date, last_interaction_date, created_at, updated_at
    )
    VALUES (
      @id, @sourceContactId, @targetContactId, @relationshipType, @customRelationshipType,
      @relationshipStrength, @notes, @startDate, @lastInteractionDate, @createdAt, @updatedAt
    )
  `).run({
    id,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  res.status(201).json({ relationship: getRelationship(id) });
});

app.put("/api/relationships/:id", (req, res) => {
  if (!getRelationship(req.params.id)) return res.status(404).json({ error: "Relationship not found." });
  const input = normalizeRelationshipInput(req.body);
  const validationError = validateRelationship(input, req.params.id);
  if (validationError) return res.status(400).json({ error: validationError });

  db.prepare(`
    UPDATE relationships SET
      source_contact_id = @sourceContactId,
      target_contact_id = @targetContactId,
      relationship_type = @relationshipType,
      custom_relationship_type = @customRelationshipType,
      relationship_strength = @relationshipStrength,
      notes = @notes,
      start_date = @startDate,
      last_interaction_date = @lastInteractionDate,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: req.params.id,
    ...input,
    updatedAt: nowIso()
  });

  res.json({ relationship: getRelationship(req.params.id) });
});

app.delete("/api/relationships/:id", (req, res) => {
  const result = db.prepare("DELETE FROM relationships WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Relationship not found." });
  res.status(204).end();
});

app.get("/api/graph", (_req, res) => {
  const contacts = getAllContacts();
  const relationships = allRelationships();
  const nodes = [
    {
      id: "self",
      label: "Me",
      type: "self"
    },
    ...contacts.map((contact) => ({
      id: contact.id,
      contactId: contact.id,
      label: contact.name,
      type: "contact",
      relationshipType: contact.relationshipType,
      imageUrl: contact.profileImage?.url || null,
      strength: contact.relationshipStrength,
      suggestedStrength: suggestedStrength(contact.relationshipStrength, contact.lastInteractionDate)
    }))
  ];

  const edges = [
    ...contacts.map((contact) => ({
      id: `self-${contact.id}`,
      source: "self",
      target: contact.id,
      scope: "self",
      type: contact.relationshipType,
      label: contact.relationshipType === "Custom" ? contact.customRelationshipType || "Custom" : contact.relationshipType,
      manualStrength: contact.relationshipStrength,
      strength: suggestedStrength(contact.relationshipStrength, contact.lastInteractionDate),
      lastInteractionDate: contact.lastInteractionDate
    })),
    ...relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.sourceContactId,
      target: relationship.targetContactId,
      scope: "contact",
      type: relationship.relationshipType,
      label: relationship.relationshipLabel,
      manualStrength: relationship.relationshipStrength,
      strength: suggestedStrength(relationship.relationshipStrength, relationship.lastInteractionDate, 0.15),
      lastInteractionDate: relationship.lastInteractionDate
    }))
  ];

  res.json({ nodes, edges });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

if (isProduction && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Rolodexian API listening on http://localhost:${port}`);
});
