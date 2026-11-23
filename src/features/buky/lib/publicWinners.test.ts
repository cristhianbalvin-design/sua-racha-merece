import { describe, expect, it } from "vitest";
import { publicWinnerLabel } from "./publicWinners";

describe("identidad pública del ganador", () => {
  it("muestra sólo iniciales y apodo aunque el objeto tenga datos privados", () => {
    const winner = {
      initials: "JE",
      nickname: "capitan",
      name: "João Exemplo",
      email: "joao@example.test",
      phone: "+55 21 99999 9999",
    };
    expect(publicWinnerLabel(winner)).toBe("JE · @capitan");
  });

  it("mantiene las iniciales cuando no hay apodo", () => {
    expect(publicWinnerLabel({ initials: "AL", nickname: null })).toBe("AL");
  });
});
