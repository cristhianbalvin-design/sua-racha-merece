import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/libraryApi", () => ({ apiRegisterDownload: vi.fn() }));
import { blockedMessage, buildEvents } from "@/features/buky/lib/fotos";

const row = (o: Record<string, string | null>) => ({ region_id: "r1", region_name: "Rio de Janeiro", sport_id: "s1", sport_name: "Corrida de rua", event_date: "2026-10-19", city_name: "Niterói", ...o });

describe("Fotos · eventos", () => {
  it("un evento por deporte+región+fecha+ciudad, sin duplicar por fotógrafo, más reciente primero", () => {
    const ev = buildEvents([row({}), row({}), row({ event_date: "2026-08-16" }), row({ city_name: "Icaraí" }), row({ sport_id: null })]);
    expect(ev.map((e) => [e.title, e.date])).toEqual([
      ["Corrida de rua · Icaraí", "2026-10-19"],
      ["Corrida de rua · Niterói", "2026-10-19"],
      ["Corrida de rua · Niterói", "2026-08-16"],
    ]);
    expect(ev[1].subtitle).toBe("19/10/2026 · Rio de Janeiro");
  });
  it("evento sin ciudad", () => {
    const [e] = buildEvents([row({ city_name: null })]);
    expect(e.city).toBeNull();
    expect(e.title).toBe("Corrida de rua");
  });
});

describe("Fotos · mensajes de descarga", () => {
  it("no menciona Premium (todo gratis por ahora)", () => {
    const m = blockedMessage({ allowed: false, reason: "free_quota_exhausted" });
    expect(m).toContain("3 fotos grátis");
    expect(m).not.toMatch(/premium/i);
  });
  it("sin participación devuelve null (se ofrece el Kit 3buk)", () => {
    expect(blockedMessage({ allowed: false, reason: "participation_required" })).toBeNull();
  });
});
