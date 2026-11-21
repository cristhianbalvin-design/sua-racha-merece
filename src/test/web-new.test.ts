import { describe, expect, it } from "vitest";
import { postLoginDestination } from "@/lib/postLogin";
import { appDeepLink } from "@/config/appLinks";
import { deepLinkPath } from "@/features/buky/components/NativeDeepLinks";

describe("navegação do aplicativo", () => {
  it("usa o destino padrão e respeita o retorno interno", () => {
    expect(postLoginDestination(null)).toBe("/app");
    expect(postLoginDestination("/app/fotos")).toBe("/app/fotos");
    expect(postLoginDestination("//example.com")).toBe("/app");
    expect(postLoginDestination("")).toBe("/app");
    expect(postLoginDestination("https://example.com/app")).toBe("/app");
    expect(postLoginDestination("/app/treino?voltar=1")).toBe("/app/treino?voltar=1");
  });
  it("aceita apenas links do aplicativo", () => {
    expect(appDeepLink("/app/treino")).toBe("tresbuk://app/treino");
    expect(deepLinkPath("tresbuk://app/treino")).toBe("/app/treino");
    expect(deepLinkPath("tresbuk://app")).toBe("/app");
    expect(deepLinkPath("https://example.com/app")).toBeNull();
    expect(deepLinkPath("tresbuk://other/treino")).toBeNull();
    expect(deepLinkPath("tresbuk://app/treino?origem=web#inicio")).toBe("/app/treino?origem=web#inicio");
    expect(deepLinkPath("tresbuk://app.evil/treino")).toBeNull();
    expect(deepLinkPath("tresbuk://user@app/treino")).toBeNull();
    expect(deepLinkPath("tresbuk://app:99/treino")).toBeNull();
    expect(deepLinkPath("tresbuk://app2/app")).toBeNull();
  });
});
