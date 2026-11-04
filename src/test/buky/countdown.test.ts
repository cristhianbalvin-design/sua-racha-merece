import { describe, expect, it } from "vitest";
import { fmtCountdown } from "@/features/buky/lib/countdown";

describe("cuenta regresiva del sorteio", () => {
  const now = Date.parse("2026-11-04T06:00:00Z");
  it("días y horas", () => expect(fmtCountdown("2026-11-06T20:30:00Z", now)).toBe("2d 14h"));
  it("horas y minutos", () => expect(fmtCountdown("2026-11-04T11:20:00Z", now)).toBe("5h 20min"));
  it("minutos", () => expect(fmtCountdown("2026-11-04T06:12:30Z", now)).toBe("12 min"));
  it("ya vencido", () => expect(fmtCountdown("2026-11-04T05:00:00Z", now)).toBe("menos de 1 min"));
});
