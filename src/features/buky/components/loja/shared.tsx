import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ShoppingCart, ClipboardList } from "lucide-react";
import { pt } from "../../i18n";
export type Variant = {
  id: string;
  color: string;
  size: string;
  stock: number;
  active: boolean;
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price_cents: number;
  shop_variants: Variant[];
};
export type CartItem = {
  variant_id: string;
  image?: string;
  product: string;
  color: string;
  size: string;
  unit_cents: number;
  qty: number;
};
export type Option = {
  id: string;
  company: string;
  service: string;
  price_cents: number;
  days: number;
};
export type Order = {
  address?: Record<string, string> | null;
  shipping_service?: string | null;
  id: string;
  status: string;
  total_cents: number;
  shipping_cents: number;
  freight_cents: number | null;
  freight_carrier: string | null;
  freight_due_at: string | null;
  created_at: string;
  delivered_at: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shop_order_items: (CartItem & { product_name: string })[];
};
export const input =
  "w-full rounded-xl border border-[var(--buky-line)] bg-[#111] p-3 text-white";
export const button =
  "rounded-full bg-[var(--buky-neon)] px-5 py-3 font-semibold text-black disabled:opacity-40";
export const panel =
  "rounded-2xl border border-[var(--buky-line)] bg-[#111] p-4";
export const itemsPayload = (items: CartItem[]) =>
  items.map(({ variant_id, qty }) => ({ variant_id, qty }));
export const readCart = (): CartItem[] => {
  try {
    const x = JSON.parse(localStorage.getItem("buky.shop.cart") ?? "[]");
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};
export const saveCart = (cart: CartItem[]) => {
  try {
    localStorage.setItem("buky.shop.cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("buky-cart-updated"));
  } catch {
    toast.error(pt.loja.erroSalvar);
  }
};

export function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    window.addEventListener("buky-cart-updated", update);
    return () => window.removeEventListener("buky-cart-updated", update);
  }, []);
  const home = location.pathname === "/app/loja";
  const title = home
    ? pt.loja.titulo
    : location.pathname.includes("carrinho")
      ? pt.loja.carrinho
      : location.pathname.includes("pedidos")
        ? pt.loja.pedidos
        : location.pathname.includes("pedido/")
          ? pt.loja.pedido
          : pt.loja.produto;
  const count = readCart().reduce((sum, item) => sum + item.qty, 0);
  return (
    <main className="space-y-5 px-6 pb-10 pt-[calc(env(safe-area-inset-top,0px)+20px)]">
      <header className="flex min-h-11 items-center gap-2">
        {!home && (
          <Link
            to={
              location.pathname.includes("pedido/")
                ? "/app/loja/pedidos"
                : "/app/loja"
            }
            aria-label={pt.loja.voltar}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--buky-line)]"
          >
            <ArrowLeft size={20} />
          </Link>
        )}
        <h1 className="font-buky flex-1 text-3xl">{title}</h1>
        {home && (
          <Link
            to="/app/loja/pedidos"
            aria-label={pt.loja.pedidos}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--buky-line)]"
          >
            <ClipboardList size={21} />
          </Link>
        )}
        <Link
          to="/app/loja/carrinho"
          aria-label={`${pt.loja.carrinho}, ${count} ${pt.loja.unidades}`}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--buky-line)]"
        >
          <ShoppingCart size={21} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[var(--buky-neon)] px-1.5 text-xs font-bold text-black">
              {count}
            </span>
          )}
        </Link>
      </header>
      {children}
    </main>
  );
}
function useShopEnabled() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["shop-enabled", isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_is_enabled");
      if (error) throw error;
      return data === true;
    },
  });
}
export function Gate({ children }: { children: React.ReactNode }) {
  const enabled = useShopEnabled();
  if (enabled.isLoading) return <Shell>{pt.loja.carregar}</Shell>;
  if (enabled.isError) return <Shell>{pt.loja.erroLoja}</Shell>;
  if (!enabled.data)
    return (
      <Shell>
        <h1 className="font-buky text-3xl">{pt.loja.lojaEmBreve}</h1>
      </Shell>
    );
  return <Shell>{children}</Shell>;
}
export function useProducts() {
  return useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*,shop_variants(*)")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
}
