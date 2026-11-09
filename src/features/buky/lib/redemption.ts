/** Extrae el token de una URL de validación de 3buk o conserva un código manual. */
export function redemptionValue(input: string): string {
  const value = input.trim();
  try {
    const url = new URL(value);
    if (url.origin !== "https://www.3buk.com") return value;
    const match = /^\/patrocinador\/validar\/([^/]+)\/?$/.exec(url.pathname);
    return match ? decodeURIComponent(match[1]) : value;
  } catch {
    return value;
  }
}

type PrizeStatus = "pending" | "notified" | "delivered" | "unclaimed" | "standby" | "expired";

/** El plazo es inclusivo, igual que en la validación del servidor. */
export function redemptionStatus(
  prize: { delivery_status: PrizeStatus; redeem_deadline?: string | null },
  now = Date.now(),
): "available" | "redeemed" | "expired" | "inactive" {
  if (prize.delivery_status === "delivered") return "redeemed";
  if (prize.delivery_status === "expired") return "expired";
  if (prize.delivery_status !== "pending" && prize.delivery_status !== "notified") return "inactive";
  const deadline = prize.redeem_deadline ? Date.parse(prize.redeem_deadline) : NaN;
  return Number.isFinite(deadline) && now > deadline ? "expired" : "available";
}
