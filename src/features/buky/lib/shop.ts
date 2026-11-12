export const maskCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
};
export const cartTotal = (
  items: { unit_cents: number; qty: number }[],
  shippingCents = 0,
) =>
  items.reduce(
    (total, item) => total + item.unit_cents * item.qty,
    shippingCents,
  );
export const shopOrderTimeline =
  "Pagamento → Frete → Preparando → Enviado → Entregue";
export const shopStatusLabels: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  awaiting_freight: "Aguardando frete",
  freight_pending: "Frete aguardando pagamento",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  exchange_requested: "Troca solicitada",
  exchanged: "Troca concluída",
};
export const exchangeAvailable = (
  status: string,
  deliveredAt: string | null,
  now: number,
  days = 7,
) =>
  status === "delivered" &&
  deliveredAt !== null &&
  now <= new Date(deliveredAt).getTime() + days * 86400000;

// Solo presentación: el estado del pedido sigue siendo la fuente de verdad.
export function shopStep(status: string, arrange: boolean): number {
  if (status === "pending_payment" || status === "cancelled") return 0;
  if (
    arrange &&
    (status === "awaiting_freight" || status === "freight_pending")
  )
    return 1;
  if (status === "shipped") return arrange ? 3 : 2;
  if (["delivered", "exchange_requested", "exchanged"].includes(status))
    return arrange ? 4 : 3;
  return arrange ? 2 : 1;
}
export const variantAvailable = (
  variants: { active: boolean; color: string; size: string; stock: number }[],
  color: string,
  size?: string,
) =>
  variants.some(
    (v) =>
      v.active &&
      v.color === color &&
      (!size || v.size === size) &&
      v.stock > 0,
  );
