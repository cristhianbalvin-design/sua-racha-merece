import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import { isPremiumActive } from "@/components/PlanBadge";

describe("premium expiration", () => {
  it("requires an active, unexpired plan", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(isPremiumActive(true, "2026-02-01T00:00:00Z", now)).toBe(true);
    expect(isPremiumActive(true, "2025-12-31T00:00:00Z", now)).toBe(false);
    expect(isPremiumActive(false, "2026-02-01T00:00:00Z", now)).toBe(false);
  });
});
