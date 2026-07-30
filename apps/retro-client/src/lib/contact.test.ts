import { describe, expect, it } from "vitest";
import { sortImportantDates } from "./contact";

describe("sortImportantDates", () => {
  it("orders upcoming dates first, then past dates, then undated entries", () => {
    const values = [
      { date: "2026-06-01", description: "Recent past" },
      { date: "", description: "Legacy note" },
      { date: "2026-12-01", description: "Later future" },
      { date: "2026-07-27", description: "Today" },
      { date: "2025-01-01", description: "Older past" },
      { date: "2026-08-01", description: "Soon future" }
    ];

    expect(sortImportantDates(values, "2026-07-27").map((value) => value.description)).toEqual([
      "Today",
      "Soon future",
      "Later future",
      "Recent past",
      "Older past",
      "Legacy note"
    ]);
  });

  it("does not mutate the source array and preserves tie order", () => {
    const values = [
      { date: "2026-08-01", description: "First" },
      { date: "2026-08-01", description: "Second" }
    ];
    const result = sortImportantDates(values, "2026-07-27");

    expect(result.map((value) => value.description)).toEqual(["First", "Second"]);
    expect(result).not.toBe(values);
    expect(values[0].description).toBe("First");
  });
});
