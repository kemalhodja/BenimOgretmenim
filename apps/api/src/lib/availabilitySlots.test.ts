import { describe, expect, it } from "vitest";
import { generateSlotsFromAvailability } from "./availabilitySlots.js";

describe("generateSlotsFromAvailability", () => {
  it("returns empty array for invalid availability shapes", () => {
    expect(generateSlotsFromAvailability(null)).toEqual([]);
    expect(generateSlotsFromAvailability([])).toEqual([]);
    expect(generateSlotsFromAvailability("monday")).toEqual([]);
    expect(generateSlotsFromAvailability({})).toEqual([]);
  });

  it("generates hourly slots from weekday evening ranges", () => {
    const now = new Date("2026-06-17T08:00:00.000Z");
    const slots = generateSlotsFromAvailability(
      {
        monday: ["19:00-22:00"],
        tuesday: ["19:00-21:00"],
      },
      { daysAhead: 7, slotMinutes: 60, now },
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.start && s.end && s.label)).toBe(true);
    for (const slot of slots) {
      expect(new Date(slot.end).getTime() - new Date(slot.start).getTime()).toBe(60 * 60 * 1000);
    }
  });

  it("skips slots within 30 minutes of now", () => {
    const now = new Date("2026-06-17T18:45:00");
    const day = now.getDay();
    const key = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day];
    const slots = generateSlotsFromAvailability(
      { [key]: ["19:00-22:00"] },
      { daysAhead: 1, slotMinutes: 60, now },
    );
    const tooSoon = slots.filter((s) => new Date(s.start).getTime() <= now.getTime() + 30 * 60 * 1000);
    expect(tooSoon).toHaveLength(0);
  });

  it("caps output at 48 slots", () => {
    const now = new Date("2026-01-01T08:00:00.000Z");
    const heavy: Record<string, string[]> = {};
    for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
      heavy[day] = ["08:00-22:00"];
    }
    const slots = generateSlotsFromAvailability(heavy, { daysAhead: 21, slotMinutes: 60, now });
    expect(slots.length).toBeLessThanOrEqual(48);
  });

  it("ignores malformed time range strings", () => {
    const now = new Date("2026-06-17T08:00:00.000Z");
    const slots = generateSlotsFromAvailability(
      { monday: ["invalid", "19:00-22:00", "25:99-30:00"] },
      { daysAhead: 14, now },
    );
    expect(slots.length).toBeGreaterThan(0);
  });
});
