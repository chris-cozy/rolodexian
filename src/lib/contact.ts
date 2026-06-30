import type { Contact } from "../types";

export const relationshipOptions = [
  "Friend",
  "Family",
  "Coworker",
  "Romantic partner",
  "Acquaintance",
  "Custom"
];

export function emptyContact(): Contact {
  return {
    name: "",
    nicknames: [],
    birthdate: "",
    relationshipType: "Acquaintance",
    customRelationshipType: "",
    relationshipStrength: 50,
    lastInteractionDate: "",
    selfRelationshipNotes: "",
    importantDates: [],
    appearance: {
      race: "",
      sex: "",
      details: "",
      descriptors: ""
    },
    traits: [],
    preferences: {
      favoriteColor: "",
      favoriteFoods: [],
      interests: [],
      likes: [],
      dislikes: [],
      other: ""
    },
    summary: "",
    customFields: {},
    socialAccounts: [],
    interactions: [],
    images: [],
    profileImage: null
  };
}

export function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatList(value: string[] | undefined): string {
  return (value || []).join(", ");
}

export function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatLines(value: string[] | undefined): string {
  return (value || []).join("\n");
}

export function parseKeyValueLines(value: string): Record<string, string> {
  return value.split("\n").reduce<Record<string, string>>((result, line) => {
    const trimmed = line.trim();
    if (!trimmed) return result;
    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      result[trimmed] = "";
      return result;
    }
    const key = trimmed.slice(0, separator).trim();
    if (!key) return result;
    result[key] = trimmed.slice(separator + 1).trim();
    return result;
  }, {});
}

export function formatKeyValueLines(value: Record<string, string> | undefined): string {
  return Object.entries(value || {})
    .map(([key, fieldValue]) => `${key}: ${fieldValue}`)
    .join("\n");
}

export function displayRelationship(contact: Contact): string {
  if (contact.relationshipType === "Custom") {
    return contact.customRelationshipType || "Custom";
  }
  return contact.relationshipType;
}

export function displayDate(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function imageSrc(url?: string | null): string | undefined {
  return url || undefined;
}
