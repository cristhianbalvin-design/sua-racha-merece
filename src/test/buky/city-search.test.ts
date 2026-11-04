import { describe, expect, it } from "vitest";
import { editDistance, searchCatalog, type CatalogCity } from "@/features/buky/lib/citySearch";
import { normalizeName } from "@/features/buky/lib/validation";

const C = (code: number, name: string, uf: string, state_code: number, is_capital = false): CatalogCity => ({ code, name, uf, state_code, lat: 0, lon: 0, is_capital, norm: normalizeName(name) });
const cities = [
  C(3303302, "Niterói", "RJ", 33),
  C(3304557, "Rio de Janeiro", "RJ", 33, true),
  C(3304904, "São Gonçalo", "RJ", 33),
  C(3301009, "Campos dos Goytacazes", "RJ", 33),
  C(3550308, "São Paulo", "SP", 35, true),
  C(3548906, "São Carlos", "SP", 35),
  C(2611606, "Recife", "PE", 26, true),
  C(1501402, "Belém", "PA", 15, true),
  C(2601706, "Belém de Maria", "PE", 26),
  C(4102000, "Assis Chateaubriand", "PR", 41),
];
const names = (q: string, st?: number | null) => searchCatalog(cities, q, st).map((c) => c.name);

describe("buscador de ciudades", () => {
  it("sin texto muestra capitales; con estado, las del estado", () => {
    expect(names("")).toEqual(["Belém", "Recife", "Rio de Janeiro", "São Paulo"]);
    expect(names("", 33)[0]).toBe("Rio de Janeiro");
    expect(names("", 33)).toHaveLength(4);
  });
  it("ignora acentos y mayúsculas", () => {
    expect(names("NITEROI")[0]).toBe("Niterói");
    expect(names("sao goncalo")[0]).toBe("São Gonçalo");
  });
  it("tolera errores de tipeo", () => {
    expect(names("niteori")[0]).toBe("Niterói");
    expect(names("assis chateaunbriand")[0]).toBe("Assis Chateaubriand");
    expect(names("sao pualo")[0]).toBe("São Paulo");
  });
  it("encuentra por cualquier palabra y acepta la sigla del estado", () => {
    expect(names("goytacazes")).toEqual(["Campos dos Goytacazes"]);
    expect(names("niteroi rj")[0]).toBe("Niterói");
    expect(names("belem pe")).toEqual(["Belém de Maria"]);
    expect(names("sao", 35)).toEqual(["São Paulo", "São Carlos"]);
  });
  it("respeta el estado elegido", () => {
    expect(names("belem", 15)).toEqual(["Belém"]);
    expect(names("niteroi", 35)).toEqual([]);
  });
  it("distancia de edición", () => {
    expect(editDistance("niteori", "niteroi")).toBe(2);
    expect(editDistance("abc", "abc")).toBe(0);
  });
});
