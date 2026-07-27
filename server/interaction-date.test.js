import { describe, expect, it } from "vitest";
import { latestInteractionDate } from "./interaction-date.js";

describe("latestInteractionDate", () => {
  it("returns the latest valid dated interaction", () => {
    expect(
      latestInteractionDate([
        { occurredOn: "2026-03-12" },
        { occurredOn: null },
        { occurredOn: "2026-07-26" },
        { occurredOn: "not-a-date" }
      ])
    ).toBe("2026-07-26");
  });

  it("uses a valid legacy value only when there are no dated interactions", () => {
    expect(latestInteractionDate([{ occurredOn: null }], "2025-11-08")).toBe("2025-11-08");
    expect(latestInteractionDate([{ occurredOn: "2026-01-10" }], "2026-07-01")).toBe("2026-01-10");
  });

  it("returns null when neither events nor fallback contain a valid date", () => {
    expect(latestInteractionDate([], null)).toBeNull();
    expect(latestInteractionDate([{ occurredOn: "2026-02-30" }], "invalid")).toBeNull();
  });
});
