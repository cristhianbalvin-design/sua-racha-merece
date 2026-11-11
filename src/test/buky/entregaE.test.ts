import { describe, expect, it } from "vitest";
import { initials, isValidNickname, maskPhone, normalizePhone } from "../../features/buky/lib/validation";

describe("perfil da entrega E", () => {
  it("usa as iniciais do primeiro e último nome", () => {
    expect(initials("Jesús Eddgar Balvin")).toBe("JB");
    expect(initials("ana")).toBe("A");
    expect(initials("  ")).toBe("");
  });
  it("valida apelidos opcionais e rejeita ofensas", () => {
    expect(isValidNickname("Capitão 10")).toBe(true);
    expect(isValidNickname("")).toBe(true);
    expect(isValidNickname("x")).toBe(false);
    expect(isValidNickname("Porra")).toBe(false);
    expect(isValidNickname("nome!" )).toBe(false);
  });
  it("formata e normaliza números brasileiros", () => {
    expect(maskPhone("+5521999999999")).toBe("(21) 99999-9999");
    expect(maskPhone("2133334444")).toBe("(21) 3333-4444");
    expect(normalizePhone("(21) 99999-9999")).toBe("+5521999999999");
    expect(normalizePhone("123")).toBeNull();
  });
});
