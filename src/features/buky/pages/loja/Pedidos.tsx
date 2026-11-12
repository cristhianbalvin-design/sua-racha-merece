import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { apiGetMyWallet, brl } from "@/lib/walletApi";
import {
  cartTotal,
  exchangeAvailable,
  maskCep,
  shopStatusLabels as orderLabels,
} from "../../lib/shop";
import {
  Gate,
  input,
  button,
  panel,
  itemsPayload,
  readCart,
  saveCart,
  useProducts,
  type CartItem,
  type Option,
  type Order,
} from "../../components/loja/shared";
import {
  ArrowLeft,
  ShoppingCart,
  ClipboardList,
  Package,
  Trash2,
  Minus,
  Plus,
  Copy,
  Truck,
} from "lucide-react";
import { pt } from "../../i18n";
import mascote from "../../assets/buky-mascote.webp";
const T = pt.loja;
export function Pedidos() {
  const products = useProducts();
  const orders = useQuery({
    queryKey: ["shop-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*,shop_order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
  return (
    <Gate>
      {orders.isLoading && <p>{T.carregar}</p>}
      {orders.isError && <p>{T.erroPedidos}</p>}
      {!orders.isLoading && !orders.isError && !orders.data?.length && (
        <div className={`${panel} py-10 text-center`}>
          <Package size={40} className="mx-auto mb-4 text-[var(--buky-neon)]" />
          <p>{T.semPedidos}</p>
          <Link className={`${button} mt-4 inline-block`} to="/app/loja">
            {T.verProdutos}
          </Link>
        </div>
      )}
      {orders.data?.map((o) => {
        const first = o.shop_order_items[0];
        const image = products.data?.find((p) =>
          p.shop_variants.some((v) => v.id === first?.variant_id),
        )?.images?.[0];
        const tone =
          o.status === "delivered"
            ? "bg-green-950 text-green-400"
            : ["shipped", "preparing", "paid"].includes(o.status)
              ? "bg-blue-950 text-blue-300"
              : o.status === "cancelled"
                ? "bg-red-950 text-red-300"
                : "bg-yellow-950 text-yellow-300";
        return (
          <Link
            className={`${panel} flex items-center gap-3`}
            key={o.id}
            to={`/app/loja/pedido/${o.id}`}
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#ddd]">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="m-auto h-full text-[#777]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold">#{o.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-sm text-[var(--buky-muted)]">
                {new Date(o.created_at).toLocaleDateString("pt-BR")} ·{" "}
                {brl(o.total_cents)}
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-1 text-xs ${tone}`}
              >
                {orderLabels[o.status] ?? o.status}
              </span>
            </div>
          </Link>
        );
      })}
    </Gate>
  );
}
