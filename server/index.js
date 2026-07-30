import cors from "cors";
import Database from "better-sqlite3";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { normalizeImportantDates, normalizePreferences } from "./contact-data.js";
import { latestInteractionDate } from "./interaction-date.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, "uploads");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "rolodexian.sqlite");
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";
const steamDistDir = path.join(rootDir, "apps", "steam-client", "dist");
const retroDistDir = path.join(rootDir, "apps", "retro-client", "dist");
const devSteamWebUrl = process.env.DEV_STEAM_WEB_URL || process.env.DEV_WEB_URL || "http://localhost:5173";
const devRetroWebUrl = process.env.DEV_RETRO_WEB_URL || "http://localhost:5174";
const archiveFormat = "rolodexian.contacts-export";
const archiveVersion = 3;
const supportedArchiveVersions = new Set([1, 2, 3]);

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

CREATE TABLE IF NOT EXISTS contact_profiles (
  contact_id TEXT PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  descriptor TEXT,
  background_image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_sections (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_section_images (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES profile_sections(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  caption TEXT,
  UNIQUE(section_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_social_contact ON social_accounts(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interaction_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_images_contact ON images(contact_id);
CREATE INDEX IF NOT EXISTS idx_relationship_source ON relationships(source_contact_id);
CREATE INDEX IF NOT EXISTS idx_relationship_target ON relationships(target_contact_id);
CREATE INDEX IF NOT EXISTS idx_profile_sections_contact ON profile_sections(contact_id, position);
CREATE INDEX IF NOT EXISTS idx_profile_section_images_section ON profile_section_images(section_id, position);
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

const archiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isJson = file.mimetype === "application/json" || file.originalname?.toLowerCase().endsWith(".json");
    cb(null, Boolean(isJson));
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

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

const profileSectionTypes = new Set([
  "markdown",
  "gallery",
  "importantDates",
  "preferences",
  "socialAccounts",
  "interactions"
]);
const singletonProfileSectionTypes = new Set([
  "importantDates",
  "preferences",
  "socialAccounts",
  "interactions"
]);
const defaultSectionTitles = {
  markdown: "About",
  gallery: "Gallery",
  importantDates: "Important Dates",
  preferences: "Preferences",
  socialAccounts: "Social Accounts",
  interactions: "Interaction History"
};

function normalizeProfileSectionType(value) {
  const type = optionalText(value);
  return type && profileSectionTypes.has(type) ? type : null;
}

function normalizeProfileContent(type, value) {
  if (type !== "markdown") return {};
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { markdown: String(raw.markdown || "") };
}

function normalizeContactInput(body) {
  return {
    name: optionalText(body.name),
    nicknames: stringList(body.nicknames),
    birthdate: optionalText(body.birthdate),
    relationshipType: optionalText(body.relationshipType) || "Acquaintance",
    customRelationshipType: optionalText(body.customRelationshipType),
    relationshipStrength: clampStrength(body.relationshipStrength),
    selfRelationshipNotes: optionalText(body.selfRelationshipNotes),
    importantDates: normalizeImportantDates(body.importantDates),
    appearance: body.appearance && typeof body.appearance === "object" ? body.appearance : {},
    traits: stringList(body.traits),
    preferences: normalizePreferences(body.preferences),
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

function archiveFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredText(value, fieldName) {
  const text = optionalText(value);
  if (!text) throw badRequest(`${fieldName} is required.`);
  return text;
}

function safeImageExtension(image) {
  const fromName = [image.originalName, image.filename]
    .map((name) => path.extname(String(name || "")).toLowerCase())
    .find((extension) => extension && /^[a-z0-9.]{2,12}$/.test(extension));
  if (fromName) return fromName;
  if (image.mimeType === "image/jpeg") return ".jpg";
  if (image.mimeType === "image/png") return ".png";
  if (image.mimeType === "image/gif") return ".gif";
  if (image.mimeType === "image/webp") return ".webp";
  if (image.mimeType === "image/svg+xml") return ".svg";
  return ".bin";
}

async function archiveImage(image) {
  const file = await fsp.readFile(path.join(uploadDir, image.filename));
  const { url: _url, ...metadata } = image;
  return {
    ...metadata,
    encoding: "base64",
    data: file.toString("base64")
  };
}

async function archiveContact(contact) {
  const { profileImage: _profileImage, images, profile, ...metadata } = contact;
  const archivedProfile = profile ? {
    contactId: profile.contactId,
    descriptor: profile.descriptor,
    backgroundImageId: profile.backgroundImageId,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    sections: profile.sections.map((section) => ({
      ...section,
      galleryItems: section.galleryItems.map(({ image: _image, ...item }) => item)
    }))
  } : null;
  return {
    ...metadata,
    profile: archivedProfile,
    images: await Promise.all(images.map(archiveImage))
  };
}

function decodeArchiveImageData(value, fieldName) {
  const raw = requiredText(value, fieldName);
  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.*)$/s);
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : null;
  const base64 = (dataUrlMatch ? dataUrlMatch[2] : raw).replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw badRequest(`${fieldName} must be base64 encoded image data.`);
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw badRequest(`${fieldName} is empty.`);
  return { buffer, mimeType };
}

function normalizeArchiveImage(rawImage, contactId, fieldName) {
  if (!plainObject(rawImage)) throw badRequest(`${fieldName} must be an object.`);
  const decoded = decodeArchiveImageData(rawImage.data, `${fieldName}.data`);
  const mimeType = optionalText(rawImage.mimeType) || decoded.mimeType || "application/octet-stream";
  if (!mimeType.startsWith("image/")) throw badRequest(`${fieldName}.mimeType must be an image MIME type.`);
  const image = {
    id: requiredText(rawImage.id, `${fieldName}.id`),
    contactId,
    originalName: optionalText(rawImage.originalName),
    mimeType,
    size: Number.isFinite(Number(rawImage.size)) ? Math.max(0, Math.round(Number(rawImage.size))) : decoded.buffer.length,
    kind: rawImage.kind === "profile" || rawImage.kind === "background" ? rawImage.kind : "additional",
    notes: optionalText(rawImage.notes),
    createdAt: optionalText(rawImage.createdAt),
    buffer: decoded.buffer
  };
  return {
    ...image,
    filename: `${Date.now()}-${randomUUID()}${safeImageExtension(image)}`
  };
}

function normalizeArchiveProfile(rawProfile, contactId, images, fieldName) {
  if (rawProfile === null || rawProfile === undefined) return null;
  if (!plainObject(rawProfile)) throw badRequest(`${fieldName} must be an object.`);
  const imageIds = new Set(images.map((image) => image.id));
  const backgroundImageId = optionalText(rawProfile.backgroundImageId);
  if (backgroundImageId && !imageIds.has(backgroundImageId)) {
    throw badRequest(`${fieldName}.backgroundImageId must reference an image in the same contact.`);
  }
  const descriptor = optionalText(rawProfile.descriptor);
  if (descriptor && descriptor.length > 160) throw badRequest(`${fieldName}.descriptor must be 160 characters or fewer.`);
  if (!Array.isArray(rawProfile.sections)) throw badRequest(`${fieldName}.sections must be an array.`);
  const sectionIds = new Set();
  const singletonTypes = new Set();
  const sections = rawProfile.sections.map((rawSection, sectionIndex) => {
    const sectionField = `${fieldName}.sections[${sectionIndex}]`;
    if (!plainObject(rawSection)) throw badRequest(`${sectionField} must be an object.`);
    const id = requiredText(rawSection.id, `${sectionField}.id`);
    if (sectionIds.has(id)) throw badRequest(`Duplicate profile section id: ${id}.`);
    sectionIds.add(id);
    const type = normalizeProfileSectionType(rawSection.type);
    if (!type) throw badRequest(`${sectionField}.type is unsupported.`);
    if (singletonProfileSectionTypes.has(type) && singletonTypes.has(type)) {
      throw badRequest(`${fieldName} contains more than one ${type} section.`);
    }
    if (singletonProfileSectionTypes.has(type)) singletonTypes.add(type);
    const galleryItemIds = new Set();
    const galleryImageIds = new Set();
    const galleryItems = type === "gallery"
      ? (Array.isArray(rawSection.galleryItems) ? rawSection.galleryItems : []).map((rawItem, itemIndex) => {
          const itemField = `${sectionField}.galleryItems[${itemIndex}]`;
          if (!plainObject(rawItem)) throw badRequest(`${itemField} must be an object.`);
          const itemId = requiredText(rawItem.id, `${itemField}.id`);
          const imageId = requiredText(rawItem.imageId, `${itemField}.imageId`);
          if (galleryItemIds.has(itemId)) throw badRequest(`Duplicate gallery item id: ${itemId}.`);
          if (galleryImageIds.has(imageId)) throw badRequest(`${sectionField} references image ${imageId} more than once.`);
          if (!imageIds.has(imageId)) throw badRequest(`${itemField}.imageId must reference an image in the same contact.`);
          galleryItemIds.add(itemId);
          galleryImageIds.add(imageId);
          return { id: itemId, sectionId: id, imageId, position: itemIndex, caption: optionalText(rawItem.caption) };
        })
      : [];
    return {
      id,
      contactId,
      type,
      title: optionalText(rawSection.title) || defaultSectionTitles[type],
      position: sectionIndex,
      content: normalizeProfileContent(type, rawSection.content),
      galleryItems,
      createdAt: optionalText(rawSection.createdAt),
      updatedAt: optionalText(rawSection.updatedAt)
    };
  });
  return {
    contactId,
    descriptor,
    backgroundImageId,
    sections,
    createdAt: optionalText(rawProfile.createdAt),
    updatedAt: optionalText(rawProfile.updatedAt)
  };
}

function normalizeArchiveContact(rawContact, index) {
  const fieldName = `contacts[${index}]`;
  if (!plainObject(rawContact)) throw badRequest(`${fieldName} must be an object.`);
  const id = requiredText(rawContact.id, `${fieldName}.id`);
  const input = normalizeContactInput(rawContact);
  if (!input.name) throw badRequest(`${fieldName}.name is required.`);
  const images = Array.isArray(rawContact.images)
    ? rawContact.images.map((image, imageIndex) => normalizeArchiveImage(image, id, `${fieldName}.images[${imageIndex}]`))
    : [];
  const imageIds = new Set(images.map((image) => image.id));
  const profileImageId = optionalText(rawContact.profileImageId);
  if (profileImageId && !imageIds.has(profileImageId)) {
    throw badRequest(`${fieldName}.profileImageId must reference an image in the same contact.`);
  }
  const profile = normalizeArchiveProfile(rawContact.profile, id, images, `${fieldName}.profile`);
  return {
    ...input,
    id,
    lastInteractionDate: optionalText(rawContact.lastInteractionDate),
    profileImageId,
    images,
    createdAt: optionalText(rawContact.createdAt),
    updatedAt: optionalText(rawContact.updatedAt),
    profile
  };
}

function relationshipPairKey(sourceContactId, targetContactId) {
  return [sourceContactId, targetContactId].sort().join("::");
}

function normalizeArchiveRelationship(rawRelationship, index, availableContactIds) {
  const fieldName = `relationships[${index}]`;
  if (!plainObject(rawRelationship)) throw badRequest(`${fieldName} must be an object.`);
  const input = normalizeRelationshipInput(rawRelationship);
  const relationship = {
    ...input,
    id: requiredText(rawRelationship.id, `${fieldName}.id`),
    lastInteractionDate: optionalText(rawRelationship.lastInteractionDate),
    createdAt: optionalText(rawRelationship.createdAt),
    updatedAt: optionalText(rawRelationship.updatedAt)
  };
  if (!relationship.sourceContactId || !relationship.targetContactId) {
    throw badRequest(`${fieldName} requires both sourceContactId and targetContactId.`);
  }
  if (relationship.sourceContactId === relationship.targetContactId) {
    throw badRequest(`${fieldName} cannot connect a contact to itself.`);
  }
  if (!availableContactIds.has(relationship.sourceContactId) || !availableContactIds.has(relationship.targetContactId)) {
    throw badRequest(`${fieldName} references a contact that does not exist.`);
  }
  return relationship;
}

function parseArchive(buffer) {
  let archive;
  try {
    archive = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw badRequest("Import file must be valid JSON.");
  }

  if (!plainObject(archive)) throw badRequest("Import file must contain an archive object.");
  if (archive.format !== archiveFormat || !supportedArchiveVersions.has(archive.version)) {
    throw badRequest("Import file is not a supported Rolodexian contacts archive.");
  }
  if (!Array.isArray(archive.contacts)) throw badRequest("Archive contacts must be an array.");
  if (!Array.isArray(archive.relationships)) throw badRequest("Archive relationships must be an array.");

  const contacts = archive.contacts.map(normalizeArchiveContact);
  const contactIds = new Set();
  const imageIds = new Set();
  for (const contact of contacts) {
    if (contactIds.has(contact.id)) throw badRequest(`Duplicate contact id in archive: ${contact.id}.`);
    contactIds.add(contact.id);
    for (const image of contact.images) {
      if (imageIds.has(image.id)) throw badRequest(`Duplicate image id in archive: ${image.id}.`);
      imageIds.add(image.id);
    }
  }

  const existingContactIds = new Set(db.prepare("SELECT id FROM contacts").all().map((row) => row.id));
  const availableContactIds = new Set([...existingContactIds, ...contactIds]);
  const relationships = archive.relationships.map((relationship, index) =>
    normalizeArchiveRelationship(relationship, index, availableContactIds)
  );
  const relationshipIds = new Set();
  const relationshipPairs = new Set();
  for (const relationship of relationships) {
    if (relationshipIds.has(relationship.id)) throw badRequest(`Duplicate relationship id in archive: ${relationship.id}.`);
    relationshipIds.add(relationship.id);
    const pairKey = relationshipPairKey(relationship.sourceContactId, relationship.targetContactId);
    if (relationshipPairs.has(pairKey)) {
      throw badRequest(`Duplicate relationship pair in archive: ${relationship.sourceContactId} and ${relationship.targetContactId}.`);
    }
    relationshipPairs.add(pairKey);
  }

  return { contacts, relationships };
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
    importantDates: normalizeImportantDates(parseJson(row.important_dates, [])),
    appearance: parseJson(row.appearance, {}),
    traits: parseJson(row.traits, []),
    preferences: normalizePreferences(parseJson(row.preferences, {})),
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
const profileSelect = db.prepare("SELECT * FROM contact_profiles WHERE contact_id = ?");
const profileSectionsSelect = db.prepare("SELECT * FROM profile_sections WHERE contact_id = ? ORDER BY position, created_at");
const galleryItemsSelect = db.prepare(`
  SELECT profile_section_images.*, images.contact_id, images.filename, images.original_name,
    images.mime_type, images.size, images.kind, images.notes, images.created_at
  FROM profile_section_images
  JOIN images ON images.id = profile_section_images.image_id
  WHERE profile_section_images.section_id = ?
  ORDER BY profile_section_images.position, profile_section_images.id
`);

function preferencesHaveData(preferences) {
  return Object.values(preferences || {}).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(optionalText(value))
  );
}

function initialProfileSections(contact) {
  const sections = [];
  const markdownParts = [contact.summary, contact.selfRelationshipNotes]
    .map(optionalText)
    .filter(Boolean);
  if (contact.traits?.length) markdownParts.push(`**Traits:** ${contact.traits.join(", ")}`);
  if (markdownParts.length) {
    sections.push({ type: "markdown", title: "About", content: { markdown: markdownParts.join("\n\n") } });
  }
  if (contact.images.some((image) => image.kind === "additional")) {
    sections.push({ type: "gallery", title: "Gallery", content: {} });
  }
  if (contact.importantDates.length) sections.push({ type: "importantDates", title: "Important Dates", content: {} });
  if (preferencesHaveData(contact.preferences)) sections.push({ type: "preferences", title: "Preferences", content: {} });
  if (contact.socialAccounts.length) sections.push({ type: "socialAccounts", title: "Social Accounts", content: {} });
  if (contact.interactions.length) sections.push({ type: "interactions", title: "Interaction History", content: {} });
  return sections;
}

function ensureContactProfile(contact) {
  if (profileSelect.get(contact.id)) return;
  const timestamp = nowIso();
  db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO contact_profiles (contact_id, descriptor, background_image_id, created_at, updated_at)
      VALUES (?, NULL, NULL, ?, ?)
    `).run(contact.id, timestamp, timestamp);
    const sections = initialProfileSections(contact);
    for (const [position, section] of sections.entries()) {
      const sectionId = randomUUID();
      db.prepare(`
        INSERT INTO profile_sections (id, contact_id, type, title, position, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sectionId, contact.id, section.type, section.title, position, jsonString(section.content, {}), timestamp, timestamp);
      if (section.type === "gallery") {
        contact.images
          .filter((image) => image.kind === "additional")
          .forEach((image, imagePosition) => {
            db.prepare(`
              INSERT INTO profile_section_images (id, section_id, image_id, position, caption)
              VALUES (?, ?, ?, ?, ?)
            `).run(randomUUID(), sectionId, image.id, imagePosition, image.notes || null);
          });
      }
    }
  })();
}

function mapGalleryItem(row) {
  return {
    id: row.id,
    sectionId: row.section_id,
    imageId: row.image_id,
    position: row.position,
    caption: row.caption,
    image: mapImage({
      id: row.image_id,
      contact_id: row.contact_id,
      filename: row.filename,
      original_name: row.original_name,
      mime_type: row.mime_type,
      size: row.size,
      kind: row.kind,
      notes: row.notes,
      created_at: row.created_at
    })
  };
}

function mapProfileSection(row) {
  return {
    id: row.id,
    contactId: row.contact_id,
    type: row.type,
    title: row.title,
    position: row.position,
    content: parseJson(row.content, {}),
    galleryItems: row.type === "gallery" ? galleryItemsSelect.all(row.id).map(mapGalleryItem) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getContactProfile(contactId, images) {
  const row = profileSelect.get(contactId);
  if (!row) return null;
  return {
    contactId,
    descriptor: row.descriptor,
    backgroundImageId: row.background_image_id,
    backgroundImage: images.find((image) => image.id === row.background_image_id) || null,
    sections: profileSectionsSelect.all(contactId).map(mapProfileSection),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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
  contact.lastInteractionDate = latestInteractionDate(contact.interactions, contact.lastInteractionDate);
  contact.images = imageSelect.all(id).map(mapImage);
  contact.profileImage = contact.images.find((image) => image.id === contact.profileImageId) || null;
  ensureContactProfile(contact);
  contact.profile = getContactProfile(id, contact.images);
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
      @relationshipStrength, NULL, @selfRelationshipNotes, @importantDates,
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

const insertImportedContact = db.prepare(`
  INSERT INTO contacts (
    id, name, nicknames, birthdate, relationship_type, custom_relationship_type,
    relationship_strength, last_interaction_date, self_relationship_notes, important_dates,
    appearance, traits, preferences, summary, custom_fields, profile_image_id, created_at, updated_at
  )
  VALUES (
    @id, @name, @nicknames, @birthdate, @relationshipType, @customRelationshipType,
    @relationshipStrength, @lastInteractionDate, @selfRelationshipNotes, @importantDates,
    @appearance, @traits, @preferences, @summary, @customFields, @profileImageId, @createdAt, @updatedAt
  )
`);

const updateImportedContact = db.prepare(`
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
    profile_image_id = @profileImageId,
    created_at = @createdAt,
    updated_at = @updatedAt
  WHERE id = @id
`);

const insertImportedImage = db.prepare(`
  INSERT INTO images (id, contact_id, filename, original_name, mime_type, size, kind, notes, created_at)
  VALUES (@id, @contactId, @filename, @originalName, @mimeType, @size, @kind, @notes, @createdAt)
`);

const relationshipRawById = db.prepare("SELECT * FROM relationships WHERE id = ?");
const relationshipRawByPair = db.prepare(`
  SELECT * FROM relationships
  WHERE (source_contact_id = ? AND target_contact_id = ?)
     OR (source_contact_id = ? AND target_contact_id = ?)
  LIMIT 1
`);

const insertImportedRelationship = db.prepare(`
  INSERT INTO relationships (
    id, source_contact_id, target_contact_id, relationship_type, custom_relationship_type,
    relationship_strength, notes, start_date, last_interaction_date, created_at, updated_at
  )
  VALUES (
    @id, @sourceContactId, @targetContactId, @relationshipType, @customRelationshipType,
    @relationshipStrength, @notes, @startDate, @lastInteractionDate, @createdAt, @updatedAt
  )
`);

const updateImportedRelationship = db.prepare(`
  UPDATE relationships SET
    source_contact_id = @sourceContactId,
    target_contact_id = @targetContactId,
    relationship_type = @relationshipType,
    custom_relationship_type = @customRelationshipType,
    relationship_strength = @relationshipStrength,
    notes = @notes,
    start_date = @startDate,
    last_interaction_date = @lastInteractionDate,
    created_at = @createdAt,
    updated_at = @updatedAt
  WHERE id = @id
`);

function importedContactParams(contact, timestamp) {
  return {
    id: contact.id,
    name: contact.name,
    nicknames: jsonString(contact.nicknames, []),
    birthdate: contact.birthdate,
    relationshipType: contact.relationshipType,
    customRelationshipType: contact.customRelationshipType,
    relationshipStrength: contact.relationshipStrength,
    lastInteractionDate: contact.lastInteractionDate,
    selfRelationshipNotes: contact.selfRelationshipNotes,
    importantDates: jsonString(contact.importantDates, []),
    appearance: jsonString(contact.appearance, {}),
    traits: jsonString(contact.traits, []),
    preferences: jsonString(contact.preferences, {}),
    summary: contact.summary,
    customFields: jsonString(contact.customFields, {}),
    profileImageId: contact.profileImageId,
    createdAt: contact.createdAt || timestamp,
    updatedAt: contact.updatedAt || timestamp
  };
}

function replaceImportedProfile(contact, timestamp) {
  db.prepare("DELETE FROM profile_sections WHERE contact_id = ?").run(contact.id);
  db.prepare("DELETE FROM contact_profiles WHERE contact_id = ?").run(contact.id);
  const profile = plainObject(contact.profile) ? contact.profile : null;
  if (!profile) return;

  const imageIds = new Set(contact.images.map((image) => image.id));
  const backgroundImageId = optionalText(profile.backgroundImageId);
  db.prepare(`
    INSERT INTO contact_profiles (contact_id, descriptor, background_image_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    contact.id,
    optionalText(profile.descriptor),
    backgroundImageId && imageIds.has(backgroundImageId) ? backgroundImageId : null,
    optionalText(profile.createdAt) || timestamp,
    optionalText(profile.updatedAt) || timestamp
  );

  const sections = Array.isArray(profile.sections) ? profile.sections : [];
  const seenSingletons = new Set();
  sections.forEach((rawSection, position) => {
    if (!plainObject(rawSection)) return;
    const type = normalizeProfileSectionType(rawSection.type);
    if (!type || (singletonProfileSectionTypes.has(type) && seenSingletons.has(type))) return;
    if (singletonProfileSectionTypes.has(type)) seenSingletons.add(type);
    const sectionId = optionalText(rawSection.id) || randomUUID();
    const createdAt = optionalText(rawSection.createdAt) || timestamp;
    const updatedAt = optionalText(rawSection.updatedAt) || timestamp;
    db.prepare(`
      INSERT INTO profile_sections (id, contact_id, type, title, position, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sectionId,
      contact.id,
      type,
      optionalText(rawSection.title) || defaultSectionTitles[type],
      position,
      jsonString(normalizeProfileContent(type, rawSection.content), {}),
      createdAt,
      updatedAt
    );
    if (type !== "gallery") return;
    const items = Array.isArray(rawSection.galleryItems) ? rawSection.galleryItems : [];
    items.forEach((rawItem, itemPosition) => {
      if (!plainObject(rawItem)) return;
      const imageId = optionalText(rawItem.imageId);
      if (!imageId || !imageIds.has(imageId)) return;
      db.prepare(`
        INSERT OR IGNORE INTO profile_section_images (id, section_id, image_id, position, caption)
        VALUES (?, ?, ?, ?, ?)
      `).run(optionalText(rawItem.id) || randomUUID(), sectionId, imageId, itemPosition, optionalText(rawItem.caption));
    });
  });
}

function importArchiveTx(archive) {
  return db.transaction((archivePayload) => {
    const timestamp = nowIso();
    const filesToDelete = new Set();
    const summary = {
      contacts: { created: 0, updated: 0 },
      relationships: { created: 0, updated: 0 },
      images: { created: 0, updated: 0, skipped: 0 },
      warnings: []
    };

    for (const contact of archivePayload.contacts) {
      const params = importedContactParams(contact, timestamp);
      if (contactSelect.get(contact.id)) {
        updateImportedContact.run(params);
        summary.contacts.updated += 1;
      } else {
        insertImportedContact.run(params);
        summary.contacts.created += 1;
      }

      replaceChildRows(contact.id, contact);

      const existingImages = db.prepare("SELECT id, filename FROM images WHERE contact_id = ?").all(contact.id);
      for (const image of existingImages) filesToDelete.add(image.filename);
      const existingImageById = new Map(
        contact.images.map((image) => [image.id, db.prepare("SELECT id, filename FROM images WHERE id = ?").get(image.id)])
      );

      db.prepare("DELETE FROM images WHERE contact_id = ?").run(contact.id);
      for (const image of contact.images) {
        const previous = existingImageById.get(image.id);
        if (previous?.filename) filesToDelete.add(previous.filename);
        db.prepare("DELETE FROM images WHERE id = ?").run(image.id);
        insertImportedImage.run({
          id: image.id,
          contactId: contact.id,
          filename: image.filename,
          originalName: image.originalName,
          mimeType: image.mimeType,
          size: image.size,
          kind: image.kind,
          notes: image.notes,
          createdAt: image.createdAt || timestamp
        });
        if (previous) {
          summary.images.updated += 1;
        } else {
          summary.images.created += 1;
        }
      }
      replaceImportedProfile(contact, timestamp);
    }

    for (const relationship of archivePayload.relationships) {
      const existingById = relationshipRawById.get(relationship.id);
      const existingPair = relationshipRawByPair.get(
        relationship.sourceContactId,
        relationship.targetContactId,
        relationship.targetContactId,
        relationship.sourceContactId
      );
      const targetId = existingPair?.id || relationship.id;
      if (existingPair && existingById && existingById.id !== existingPair.id) {
        db.prepare("DELETE FROM relationships WHERE id = ?").run(existingById.id);
        summary.warnings.push(`Merged relationship ${relationship.id} into existing pair ${existingPair.id}.`);
      }

      const params = {
        ...relationship,
        id: targetId,
        createdAt: relationship.createdAt || existingPair?.created_at || existingById?.created_at || timestamp,
        updatedAt: relationship.updatedAt || timestamp
      };

      if (existingPair || existingById) {
        updateImportedRelationship.run(params);
        summary.relationships.updated += 1;
      } else {
        insertImportedRelationship.run(params);
        summary.relationships.created += 1;
      }
    }

    return { summary, filesToDelete: [...filesToDelete] };
  })(archive);
}

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
    startDate: optionalText(body.startDate)
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

app.get("/api/contacts/export", async (_req, res, next) => {
  try {
    const archive = {
      format: archiveFormat,
      version: archiveVersion,
      exportedAt: nowIso(),
      contacts: await Promise.all(getAllContacts().map(archiveContact)),
      relationships: allRelationships()
    };
    const filename = `rolodexian-contacts-${archiveFileDate()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(archive, null, 2));
  } catch (error) {
    next(error);
  }
});

app.post("/api/contacts/import", archiveUpload.single("archive"), async (req, res, next) => {
  const writtenFiles = [];
  let committed = false;
  try {
    if (!req.file) throw badRequest("Archive file is required.");
    const archive = parseArchive(req.file.buffer);
    for (const contact of archive.contacts) {
      for (const image of contact.images) {
        const destination = path.join(uploadDir, image.filename);
        await fsp.writeFile(destination, image.buffer);
        writtenFiles.push(destination);
      }
    }

    let result;
    try {
      result = importArchiveTx(archive);
      committed = true;
    } catch (error) {
      await Promise.allSettled(writtenFiles.map((file) => fsp.unlink(file)));
      throw error;
    }

    await Promise.allSettled(
      result.filesToDelete.map((filename) => fsp.unlink(path.join(uploadDir, filename)))
    );
    res.json({ summary: result.summary });
  } catch (error) {
    if (!committed) {
      await Promise.allSettled(writtenFiles.map((file) => fsp.unlink(file)));
    }
    next(error);
  }
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
        JSON.stringify(contact.socialAccounts),
        contact.profile?.descriptor,
        JSON.stringify(contact.profile?.sections?.filter((section) => section.type === "markdown").map((section) => section.content))
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

function getProfileSection(id) {
  const row = db.prepare("SELECT * FROM profile_sections WHERE id = ?").get(id);
  return row ? mapProfileSection(row) : null;
}

function getGalleryItem(id) {
  const row = db.prepare(`
    SELECT profile_section_images.*, images.contact_id, images.filename, images.original_name,
      images.mime_type, images.size, images.kind, images.notes, images.created_at
    FROM profile_section_images
    JOIN images ON images.id = profile_section_images.image_id
    WHERE profile_section_images.id = ?
  `).get(id);
  return row ? mapGalleryItem(row) : null;
}

app.patch("/api/contacts/:id/profile", (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  const descriptor = optionalText(req.body.descriptor);
  if (descriptor && descriptor.length > 160) {
    return res.status(400).json({ error: "Profile descriptor must be 160 characters or fewer." });
  }
  db.prepare("UPDATE contact_profiles SET descriptor = ?, updated_at = ? WHERE contact_id = ?")
    .run(descriptor, nowIso(), req.params.id);
  res.json({ contact: getFullContact(req.params.id) });
});

app.post("/api/contacts/:id/profile/background", upload.single("image"), async (req, res, next) => {
  let previousFilename = null;
  try {
    const contact = getFullContact(req.params.id);
    if (!contact) {
      if (req.file) await fsp.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Contact not found." });
    }
    if (!req.file) return res.status(400).json({ error: "Background image is required." });
    const previous = contact.profile?.backgroundImage;
    previousFilename = previous?.filename || null;
    const id = randomUUID();
    const timestamp = nowIso();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO images (id, contact_id, filename, original_name, mime_type, size, kind, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'background', NULL, ?)
      `).run(id, req.params.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, timestamp);
      db.prepare("UPDATE contact_profiles SET background_image_id = ?, updated_at = ? WHERE contact_id = ?")
        .run(id, timestamp, req.params.id);
      if (previous?.id) db.prepare("DELETE FROM images WHERE id = ?").run(previous.id);
    })();
    if (previousFilename) await fsp.unlink(path.join(uploadDir, previousFilename)).catch(() => {});
    res.status(201).json({ contact: getFullContact(req.params.id) });
  } catch (error) {
    if (req.file) await fsp.unlink(req.file.path).catch(() => {});
    next(error);
  }
});

app.delete("/api/contacts/:id/profile/background", async (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  const background = contact.profile?.backgroundImage;
  if (background) {
    db.prepare("DELETE FROM images WHERE id = ?").run(background.id);
    await fsp.unlink(path.join(uploadDir, background.filename)).catch(() => {});
  }
  res.json({ contact: getFullContact(req.params.id) });
});

app.post("/api/contacts/:id/profile/sections", (req, res) => {
  const contact = getFullContact(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found." });
  const type = normalizeProfileSectionType(req.body.type);
  if (!type) return res.status(400).json({ error: "Unsupported profile section type." });
  if (singletonProfileSectionTypes.has(type)) {
    const existing = db.prepare("SELECT id FROM profile_sections WHERE contact_id = ? AND type = ?").get(req.params.id, type);
    if (existing) return res.status(409).json({ error: "That profile section is already visible." });
  }
  const position = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM profile_sections WHERE contact_id = ?")
    .get(req.params.id).position;
  const id = randomUUID();
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO profile_sections (id, contact_id, type, title, position, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.params.id,
    type,
    optionalText(req.body.title) || defaultSectionTitles[type],
    position,
    jsonString(normalizeProfileContent(type, req.body.content), {}),
    timestamp,
    timestamp
  );
  res.status(201).json({ section: getProfileSection(id) });
});

app.patch("/api/profile-sections/:id", (req, res) => {
  const section = getProfileSection(req.params.id);
  if (!section) return res.status(404).json({ error: "Profile section not found." });
  const title = Object.hasOwn(req.body, "title") ? optionalText(req.body.title) : section.title;
  const content = Object.hasOwn(req.body, "content")
    ? normalizeProfileContent(section.type, req.body.content)
    : section.content;
  db.prepare("UPDATE profile_sections SET title = ?, content = ?, updated_at = ? WHERE id = ?")
    .run(title || defaultSectionTitles[section.type], jsonString(content, {}), nowIso(), req.params.id);
  res.json({ section: getProfileSection(req.params.id) });
});

app.delete("/api/profile-sections/:id", (req, res) => {
  const result = db.prepare("DELETE FROM profile_sections WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Profile section not found." });
  res.status(204).end();
});

app.put("/api/contacts/:id/profile/sections/order", (req, res) => {
  const rows = profileSectionsSelect.all(req.params.id);
  if (!profileSelect.get(req.params.id)) return res.status(404).json({ error: "Contact profile not found." });
  const sectionIds = Array.isArray(req.body.sectionIds) ? req.body.sectionIds.map(String) : [];
  const expected = new Set(rows.map((row) => row.id));
  if (sectionIds.length !== rows.length || new Set(sectionIds).size !== rows.length || sectionIds.some((id) => !expected.has(id))) {
    return res.status(400).json({ error: "Section order must contain every profile section exactly once." });
  }
  const timestamp = nowIso();
  db.transaction(() => {
    const update = db.prepare("UPDATE profile_sections SET position = ?, updated_at = ? WHERE id = ? AND contact_id = ?");
    sectionIds.forEach((id, position) => update.run(position, timestamp, id, req.params.id));
  })();
  res.json({ sections: profileSectionsSelect.all(req.params.id).map(mapProfileSection) });
});

app.post("/api/profile-sections/:id/images", upload.array("images", 20), async (req, res, next) => {
  const files = req.files || [];
  try {
    const section = getProfileSection(req.params.id);
    if (!section) throw Object.assign(new Error("Profile section not found."), { status: 404 });
    if (section.type !== "gallery") throw badRequest("Images can only be added to gallery sections.");
    if (!files.length) throw badRequest("At least one gallery image is required.");
    const startPosition = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM profile_section_images WHERE section_id = ?")
      .get(req.params.id).position;
    const timestamp = nowIso();
    const itemIds = [];
    db.transaction(() => {
      files.forEach((file, index) => {
        const imageId = randomUUID();
        const itemId = randomUUID();
        db.prepare(`
          INSERT INTO images (id, contact_id, filename, original_name, mime_type, size, kind, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'additional', NULL, ?)
        `).run(imageId, section.contactId, file.filename, file.originalname, file.mimetype, file.size, timestamp);
        db.prepare(`
          INSERT INTO profile_section_images (id, section_id, image_id, position, caption)
          VALUES (?, ?, ?, ?, NULL)
        `).run(itemId, req.params.id, imageId, startPosition + index);
        itemIds.push(itemId);
      });
    })();
    res.status(201).json({ items: itemIds.map(getGalleryItem) });
  } catch (error) {
    await Promise.allSettled(files.map((file) => fsp.unlink(file.path)));
    next(error);
  }
});

app.patch("/api/profile-section-images/:id", (req, res) => {
  const item = getGalleryItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Gallery item not found." });
  const caption = Object.hasOwn(req.body, "caption") ? optionalText(req.body.caption) : item.caption;
  db.prepare("UPDATE profile_section_images SET caption = ? WHERE id = ?").run(caption, req.params.id);
  res.json({ item: getGalleryItem(req.params.id) });
});

app.delete("/api/profile-section-images/:id", (req, res) => {
  const result = db.prepare("DELETE FROM profile_section_images WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Gallery item not found." });
  res.status(204).end();
});

app.put("/api/profile-sections/:id/images/order", (req, res) => {
  const section = getProfileSection(req.params.id);
  if (!section) return res.status(404).json({ error: "Profile section not found." });
  if (section.type !== "gallery") return res.status(400).json({ error: "Only gallery items can be reordered." });
  const rows = galleryItemsSelect.all(req.params.id);
  const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds.map(String) : [];
  const expected = new Set(rows.map((row) => row.id));
  if (itemIds.length !== rows.length || new Set(itemIds).size !== rows.length || itemIds.some((id) => !expected.has(id))) {
    return res.status(400).json({ error: "Gallery order must contain every item exactly once." });
  }
  db.transaction(() => {
    const update = db.prepare("UPDATE profile_section_images SET position = ? WHERE id = ? AND section_id = ?");
    itemIds.forEach((id, position) => update.run(position, id, req.params.id));
  })();
  res.json({ items: galleryItemsSelect.all(req.params.id).map(mapGalleryItem) });
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
      @relationshipStrength, @notes, @startDate, NULL, @createdAt, @updatedAt
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
      strength: relationship.relationshipStrength
    }))
  ];

  res.json({ nodes, edges });
});

if (isProduction && fs.existsSync(steamDistDir)) {
  if (fs.existsSync(retroDistDir)) {
    app.use("/retro", express.static(retroDistDir));
    app.get("/retro/*", (_req, res) => {
      res.sendFile(path.join(retroDistDir, "index.html"));
    });
  }
  app.use(express.static(steamDistDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(steamDistDir, "index.html"));
  });
} else if (!isProduction) {
  app.get(/^\/retro(?:\/|$).*/, (req, res) => {
    res.redirect(307, new URL(req.originalUrl, devRetroWebUrl).toString());
  });
  app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (req, res) => {
    res.redirect(307, new URL(req.originalUrl, devSteamWebUrl).toString());
  });
}

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

if (isProduction && !fs.existsSync(steamDistDir)) {
  console.warn("Steam client build not found. Run `npm run build` before `npm start`.");
}

app.listen(port, () => {
  console.log(`Rolodexian server listening on http://localhost:${port}`);
  if (!isProduction) {
    console.log(`Steam client development server: ${devSteamWebUrl}`);
    console.log(`Retro client development server: ${devRetroWebUrl}/retro/`);
  }
});
