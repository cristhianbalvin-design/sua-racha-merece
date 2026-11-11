import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/walletApi";
import AdminDescontosLoja from "./AdminDescontosLoja";
import AdminProdutosLoja from "./AdminProdutosLoja";
import { btnPrimary, card, inputCls } from "./ui";

type Item = {
  product_name: string;
  color: string;
  size: string;
  qty: number;
  unit_cents: number;
};
type Order = {
  id: string;
  status: string;
  total_cents: number;
  payment_method: string;
  created_at: string;
  address: Record<string, string>;
  shop_order_items: Item[];
  tracking_code: string | null;
  tracking_url: string | null;
};
const statuses = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "exchange_requested",
  "exchanged",
];
const labels: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  exchange_requested: "Troca solicitada",
  exchanged: "Troca concluída",
};
export default function AdminLoja() {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const orders = useQuery({
    queryKey: ["admin-shop-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*,shop_order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
  const setting = useQuery({
    queryKey: ["shop-enabled-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "shop_enabled")
        .single();
      if (error) throw error;
      return data.value === true;
    },
  });
  const o = orders.data?.find((x) => x.id === selected);
  const update = async (status: string) => {
    if (!o) return;
    if (
      status === "cancelled" &&
      o.payment_method === "mercadopago" &&
      !window.confirm(
        "O reembolso deve ser feito no Mercado Pago. Cancelar o pedido?",
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_shop_update_order", {
      p_order_id: o.id,
      p_status: status,
      p_tracking_code: status === "shipped" ? code : null,
      p_tracking_url: status === "shipped" ? url : null,
      p_note: null,
    });
    if (error) toast.error(`Não foi possível atualizar: ${error.message}`);
    else {
      toast.success("Pedido atualizado");
      await orders.refetch();
    }
    setBusy(false);
  };
  const toggle = async (enabled: boolean) => {
    const { error } = await supabase.rpc("admin_shop_set_enabled", {
      p_enabled: enabled,
    });
    if (error) toast.error("Não foi possível atualizar a loja.");
    else await setting.refetch();
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Loja</h2>
      <label>
        <input
          type="checkbox"
          checked={setting.data ?? false}
          disabled={setting.isLoading}
          onChange={(e) => void toggle(e.target.checked)}
        />{" "}
        Loja habilitada
      </label>
      <AdminProdutosLoja />
      <AdminDescontosLoja />
      <h3 className="font-bold">Pedidos</h3>
      <select
        className={inputCls}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="">Todos os estados</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {labels[s]}
          </option>
        ))}
      </select>
      {orders.isError && <p>Erro ao carregar pedidos.</p>}
      <div className="grid gap-2">
        {orders.data
          ?.filter((x) => !filter || x.status === filter)
          .map((x) => (
            <button
              key={x.id}
              className={`${card} p-4 text-left`}
              onClick={() => setSelected(x.id)}
            >
              {new Date(x.created_at).toLocaleDateString("pt-BR")} ·{" "}
              {labels[x.status]} · {brl(x.total_cents)} · {x.id.slice(0, 8)}
            </button>
          ))}
      </div>
      {o && (
        <section className={`${card} space-y-3 p-4`}>
          <h3 className="font-bold">Pedido {o.id}</h3>
          <p>
            {labels[o.status]} · {brl(o.total_cents)} · {o.payment_method}
          </p>
          <p>{Object.values(o.address).filter(Boolean).join(" · ")}</p>
          {o.shop_order_items.map((i, n) => (
            <p key={n}>
              {i.product_name} · {i.color} · {i.size} · {i.qty}× ·{" "}
              {brl(i.unit_cents)}
            </p>
          ))}
          {o.status === "paid" && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => void update("preparing")}
            >
              Preparando
            </button>
          )}
          {o.status === "preparing" && (
            <div className="space-y-2">
              <input
                className={inputCls}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código de rastreio"
              />
              <input
                className={inputCls}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Link de rastreio"
              />
              <button
                className={btnPrimary}
                disabled={busy || !code || !url}
                onClick={() => void update("shipped")}
              >
                Enviado
              </button>
            </div>
          )}
          {o.status === "shipped" && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => void update("delivered")}
            >
              Entregue
            </button>
          )}
          {o.status === "exchange_requested" && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => void update("exchanged")}
            >
              Troca concluída
            </button>
          )}
          {["pending_payment", "paid", "preparing"].includes(o.status) && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => void update("cancelled")}
            >
              Cancelar
            </button>
          )}
        </section>
      )}
    </div>
  );
}
