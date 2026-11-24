import { describe, expect, it } from "vitest";
import { mapsLink, whatsappLink } from "./sponsorContact";

describe("links de contato do patrocinador", () => {
  it("remove o sinal + do wa.me e codifica a mensagem", () => {
    expect(whatsappLink("+5521999999999", "Tênis 20%"))
      .toBe("https://wa.me/5521999999999?text=Ol%C3%A1!%20Ganhei%20o%20cupom%20T%C3%AAnis%2020%25%20na%203BUK%20e%20gostaria%20de%20saber%20como%20resgatar.");
    expect(whatsappLink("55 (21) 99999", "X")).toBeNull();
  });

  it("prioriza o URL de mapas e usa a busca quando há só endereço", () => {
    expect(mapsLink("https://maps.google.com/a", "Rua A"))
      .toBe("https://maps.google.com/a");
    expect(mapsLink(null, "Rua São João, 5"))
      .toBe("https://www.google.com/maps/search/?api=1&query=Rua%20S%C3%A3o%20Jo%C3%A3o%2C%205");
    expect(mapsLink("javascript:alert(1)", null)).toBeNull();
  });
});
