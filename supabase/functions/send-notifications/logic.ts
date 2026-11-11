/** Plantillas puras para los avisos. Las entradas se escapan antes de insertarse en HTML. */
export interface Notice {
  kind: string;
  title: string;
  message: string;
  prize?: { title: string; benefit?: string | null; kind: "physical" | "digital"; redeem_code?: string | null; redeem_deadline?: string | null } | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));

export function formatDeadline(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("invalid_deadline");
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function renderNotice(notice: Notice): { subject: string; html: string; text: string } {
  const prize = notice.prize;
  const lines = [notice.message];
  if (prize) {
    lines.push([prize.title, prize.benefit].filter(Boolean).join(" - "));
    if (prize.redeem_deadline) lines.push(`Resgate até ${formatDeadline(prize.redeem_deadline)}.`);
    if (prize.kind === "physical") lines.push("Mostre o QR no app no estabelecimento.");
    else if (prize.redeem_code) lines.push(`Código de desconto: ${prize.redeem_code}`);
  }
  const url = notice.kind === "premium_expiring"
    ? "https://www.3buk.com/app/perfil/saldo"
    : notice.kind.startsWith("shop_")
      ? "https://www.3buk.com/app/loja/pedidos"
      : "https://www.3buk.com/app/sorteios";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><strong>3buk</strong><h1>${escapeHtml(notice.title)}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}${prize?.kind === "digital" && prize.redeem_code ? `<p style="font-size:28px;font-weight:bold;letter-spacing:2px">${escapeHtml(prize.redeem_code)}</p>` : ""}<p><a href="${url}" style="display:inline-block;background:#39ff14;color:#111;padding:12px 20px;border-radius:8px">Abrir no app</a></p></div>`;
  return { subject: notice.title, html, text: `${notice.title}\n\n${lines.join("\n")}\n\n${url}` };
}
