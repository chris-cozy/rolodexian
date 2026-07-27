import { describe, expect, it } from "vitest";
import {
  isValidCalendarDate,
  normalizeImportantDates,
  normalizePreferences
} from "./contact-data.js";

describe("contact data normalization", () => {
  it("converts a legacy favorite color and canonicalizes color arrays", () => {
    expect(normalizePreferences({ favoriteColor: " Deep teal ", likes: ["Tea"] })).toEqual({
      favoriteColors: ["Deep teal"],
      likes: ["Tea"]
    });
    expect(normalizePreferences({ favoriteColors: ["Olive green", "olive GREEN", "", " Cobalt "] })).toEqual({
      favoriteColors: ["Olive green", "Cobalt"]
    });
    expect(normalizePreferences({ favoriteColors: [], favoriteColor: "Sea glass" })).toEqual({
      favoriteColors: ["Sea glass"]
    });
  });

  it("validates full calendar dates", () => {
    expect(isValidCalendarDate("2026-02-28")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });

  it("normalizes legacy strings and structured important dates without losing invalid entries", () => {
    expect(
      normalizeImportantDates([
        "2026-11-03 - Birthday",
        "Remember graduation season",
        { date: "2026-08-29", description: "Birthday" },
        { date: "", description: "Needs research" },
        { date: "2026-02-30", description: "Bad source date" },
        { date: "", description: "" },
        " "
      ])
    ).toEqual([
      { date: "2026-11-03", description: "Birthday" },
      { date: "", description: "Remember graduation season" },
      { date: "2026-08-29", description: "Birthday" },
      { date: "", description: "Needs research" },
      { date: "", description: "2026-02-30 — Bad source date" }
    ]);
  });

  it("preserves date-only and description-only entries", () => {
    expect(normalizeImportantDates(["2026-07-27", { date: "", description: "Anniversary" }])).toEqual([
      { date: "2026-07-27", description: "" },
      { date: "", description: "Anniversary" }
    ]);
  });
});
