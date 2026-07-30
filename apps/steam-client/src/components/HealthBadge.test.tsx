import { describe, expect, it } from "vitest";
import { healthBand } from "./HealthBadge";

describe("healthBand", () => {
  it("uses the shared relationship-health thresholds", () => {
    expect(healthBand(75)).toBe("strong");
    expect(healthBand(74)).toBe("steady");
    expect(healthBand(40)).toBe("steady");
    expect(healthBand(39)).toBe("fragile");
  });
});
