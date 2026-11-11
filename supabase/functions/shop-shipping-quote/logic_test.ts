import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPackage, mapOptions } from "./logic.ts";
Deno.test("paquete suma pesos y toma medidas máximas", () => {
  assertEquals(
    buildPackage([
      { weight_kg: 0.5, width_cm: 25, height_cm: 5, length_cm: 30, qty: 2 },
      { weight_kg: 1, width_cm: 30, height_cm: 4, length_cm: 20, qty: 1 },
    ]),
    { weight: 2, width: 30, height: 5, length: 30 },
  );
  assertThrows(() => buildPackage([]));
});
Deno.test("opciones excluyen errores y convierten reales", () => {
  assertEquals(
    mapOptions([
      {
        id: 1,
        name: "PAC",
        company: { name: "Correios" },
        price: "12.34",
        delivery_time: 4,
      },
      { id: 2, error: "indisponível" },
    ]),
    [
      {
        id: "1",
        company: "Correios",
        service: "PAC",
        price_cents: 1234,
        days: 4,
      },
    ],
  );
});
