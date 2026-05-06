import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatExpiry } from "./expiry";

describe("formatExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when there is no expiry", () => {
    expect(formatExpiry(null)).toBeNull();
  });

  it("returns 'Expired' for a past timestamp", () => {
    expect(formatExpiry("2025-12-25T00:00:00.000Z")).toBe("Expired");
  });

  it("returns 'Expired' for exactly now", () => {
    expect(formatExpiry("2026-01-01T00:00:00.000Z")).toBe("Expired");
  });

  it("returns 'Expires today' for a same-day expiry within 24h", () => {
    expect(formatExpiry("2026-01-01T18:00:00.000Z")).toBe("Expires today");
  });

  it("returns 'Expires in N days' for a future expiry", () => {
    expect(formatExpiry("2026-01-08T00:00:00.000Z")).toBe("Expires in 7 days");
    expect(formatExpiry("2026-01-15T00:00:00.000Z")).toBe("Expires in 14 days");
    expect(formatExpiry("2026-01-31T00:00:00.000Z")).toBe("Expires in 30 days");
  });

  it("rounds partial days up so a 1.5-day expiry reads as 2 days", () => {
    expect(formatExpiry("2026-01-02T12:00:00.000Z")).toBe("Expires in 2 days");
  });
});
