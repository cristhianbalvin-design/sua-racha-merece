import assert from "node:assert/strict";
import { formatDeadline, renderNotice } from "./logic.ts";

Deno.test("formatea el plazo en São Paulo", () => {
  assert.match(formatDeadline("2026-11-09T15:00:00Z"), /12:00/);
  assert.throws(() => formatDeadline("bad"), /invalid_deadline/);
});
Deno.test("escapa datos y muestra el código digital", () => {
  const mail = renderNotice({ kind: "buky_raffle_won", title: "<premio>", message: "Olá & bom dia", prize: { title: "X", kind: "digital", redeem_code: "<ABC>" } });
  assert.ok(mail.html.includes("&lt;ABC&gt;"));
  assert.ok(!mail.html.includes("<premio>"));
  assert.ok(mail.text.includes("Código de desconto: <ABC>"));
});
Deno.test("incluye instrucciones físicas y enlace Premium", () => {
  assert.ok(renderNotice({ kind: "buky_raffle_won", title: "Prêmio", message: "Ganhou", prize: { title: "X", kind: "physical" } }).text.includes("Mostre o QR"));
  assert.ok(renderNotice({ kind: "premium_expiring", title: "Premium", message: "Vence" }).text.includes("/app/perfil/saldo"));
});
