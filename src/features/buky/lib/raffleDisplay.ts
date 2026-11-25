export function countCouponKinds(coupons: readonly { kind: "physical" | "digital" }[]) {
  return coupons.reduce((counts, coupon) => {
    counts[coupon.kind] += 1;
    return counts;
  }, { physical: 0, digital: 0 });
}

export function participationLabel(ticketCount: number) {
  return ticketCount > 0 ? `Participando ? ${ticketCount} ${ticketCount === 1 ? "ticket" : "tickets"}` : "Voc? ainda n?o participa";
}
