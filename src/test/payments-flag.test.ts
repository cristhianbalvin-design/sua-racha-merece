import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@/lib/platform");
  vi.resetModules();
});

describe("PAYMENTS_ENABLED", () => {
  it.each([[false, true], [true, false]])("native=%s => payments=%s", async (native, expected) => {
    vi.resetModules();
    vi.doMock("@/lib/platform", () => ({ IS_NATIVE: native }));
    const { PAYMENTS_ENABLED } = await import("@/config/features");
    expect(PAYMENTS_ENABLED).toBe(expected);
  });
});
