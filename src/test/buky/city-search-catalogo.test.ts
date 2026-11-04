import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchCatalog, type CatalogCity } from "@/features/buky/lib/citySearch";
import { normalizeName } from "@/features/buky/lib/validation";

// Catálogo real: el mismo que carga el paso 15 en producción
const sql = readFileSync("supabase/manual-sql/buky/15_catalogo_ibge_y_perfil.sql", "utf8");
const ufs = new Map([...sql.matchAll(/\((\d{2}), '([A-Z]{2})', '/g)].map((m) => [Number(m[1]), m[2]]));
const cities: CatalogCity[] = [...sql.matchAll(/\((\d{7}), '((?:[^']|'')+)', (\d{2}), (-?[\d.]+), (-?[\d.]+), (true|false)\)/g)].map((m) => ({
  code: Number(m[1]),
  name: m[2].replace(/''/g, "'"),
  state_code: Number(m[3]),
  uf: ufs.get(Number(m[3])) ?? "",
  lat: Number(m[4]),
  lon: Number(m[5]),
  is_capital: m[6] === "true",
  norm: normalizeName(m[2].replace(/''/g, "'")),
}));
const first = (q: string, st?: number) => searchCatalog(cities, q, st)[0];

describe("buscador con el catálogo real del IBGE", () => {
  it("tiene las 5.571 ciudades y 27 capitales", () => {
    expect(cities).toHaveLength(5571);
    expect(searchCatalog(cities, "")).toHaveLength(27);
  });
  it("casos reales de los perfiles de 3BUK", () => {
    expect(`${first("Niteori").name}/${first("Niteori").uf}`).toBe("Niterói/RJ");
    expect(first("Niterói, rj").name).toBe("Niterói");
    expect(first("sao goncalo").name).toBe("São Gonçalo");
    expect(first("Assis chateaunbriand").name).toBe("Assis Chateaubriand");
    expect(first("itaborai").name).toBe("Itaboraí");
    expect(first("marica").name).toBe("Maricá");
    expect(first("campos rj").name).toBe("Campos dos Goytacazes");
    expect(first("rio de janeiro").name).toBe("Rio de Janeiro");
  });
  it("responde rápido en el dispositivo", () => {
    const t = performance.now();
    for (const q of ["n", "ni", "nit", "nite", "niter", "nitero", "niteroi", "s", "sa", "sao", "sao g", "sao go", "sao gon"]) searchCatalog(cities, q);
    const ms = (performance.now() - t) / 13;
    console.log(`promedio por tecla: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(40);
  });
});
