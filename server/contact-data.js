function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizePreferences(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const legacyColor = cleanText(raw.favoriteColor);
  const canonicalColors = Array.isArray(raw.favoriteColors)
    ? raw.favoriteColors.map(cleanText).filter(Boolean)
    : [];
  const colorValues = canonicalColors.length ? canonicalColors : legacyColor ? [legacyColor] : [];
  const normalized = {
    ...raw,
    favoriteColors: uniqueStrings(colorValues)
  };
  delete normalized.favoriteColor;
  return normalized;
}

function normalizeImportantDateEntry(value) {
  if (typeof value === "string") {
    const original = value.trim();
    if (!original) return null;
    const possibleDate = original.slice(0, 10);
    if (isValidCalendarDate(possibleDate)) {
      return {
        date: possibleDate,
        description: original.slice(10).replace(/^[\s:–—-]+/, "").trim()
      };
    }
    return { date: "", description: original };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rawDate = cleanText(value.date);
  const description = cleanText(value.description);
  if (!rawDate && !description) return null;
  if (rawDate && !isValidCalendarDate(rawDate)) {
    return {
      date: "",
      description: description ? `${rawDate} — ${description}` : rawDate
    };
  }
  return { date: rawDate, description };
}

export function normalizeImportantDates(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeImportantDateEntry).filter(Boolean);
}
