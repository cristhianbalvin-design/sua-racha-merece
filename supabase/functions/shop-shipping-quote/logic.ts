export type PackageItem = {
  weight_kg: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  qty: number;
};
export function buildPackage(items: PackageItem[]) {
  if (
    !items.length ||
    items.some(
      (i) =>
        !Number.isInteger(i.qty) ||
        i.qty < 1 ||
        [i.weight_kg, i.width_cm, i.height_cm, i.length_cm].some(
          (n) => !Number.isFinite(n) || n <= 0,
        ),
    )
  )
    throw new Error("invalid_items");
  return {
    weight: items.reduce((sum, i) => sum + i.weight_kg * i.qty, 0),
    width: Math.max(...items.map((i) => i.width_cm)),
    height: Math.max(...items.map((i) => i.height_cm)),
    length: Math.max(...items.map((i) => i.length_cm)),
  };
}
export function mapOptions(
  data: unknown,
): {
  id: string;
  company: string;
  service: string;
  price_cents: number;
  days: number;
}[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const price = Number(item.price);
    const days = Number(item.delivery_time);
    if (
      item.error ||
      item.price == null ||
      String(item.price).trim() === "" ||
      item.id == null ||
      !item.name ||
      !item.company?.name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(days) ||
      days < 0
    )
      return [];
    return [
      {
        id: String(item.id),
        company: String(item.company.name),
        service: String(item.name),
        price_cents: Math.round(price * 100),
        days,
      },
    ];
  });
}
