import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/hooks/useConfirm";
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
  users: { name: string; email: string } | null;
  shop_order_items: Item[];
  freight_cents: number | null;
  freight_carrier: string | null;
  freight_note: string | null;
  freight_payment_method: string | null;
  freight_due_at: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
};
const statuses = [
  "pending_payment",
  "paid",
  "awaiting_freight",
  "freight_pending",
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
  awaiting_freight: "Aguardando frete",
  freight_pending: "Frete aguardando pagamento",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  exchange_requested: "Troca solicitada",
  exchanged: "Troca concluída",
};
export default function AdminLoja() {
  const [confirm, confirmDialog] = useConfirm();
  const [freight, setFreight] = useState("");
  const [carrier, setCarrier] = useState("");
  const [freightNote, setFreightNote] = useState("");
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
        .select("*,shop_order_items(*),users(name,email)")
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
  const mode = useQuery({
    queryKey: ["shop-shipping-mode-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_shipping_mode");
      if (error) throw error;
      return data as string;
    },
  });
  const o = orders.data?.find((x) => x.id === selected);
  const update = async (status: string) => {
    if (!o) return;
    if (
      status === "cancelled" &&
      (o.payment_method === "mercadopago" ||
        o.freight_payment_method === "mercadopago") &&
      !(await confirm({
        description:
          "O reembolso deve ser feito no Mercado Pago. Cancelar o pedido?",
      }))
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
  const requestFreight = async () => {
    if (!o) return;
    const cents = Math.round(Number(freight.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0 || !carrier.trim()) {
      toast.error("Informe um valor e uma transportadora válidos.");
      return;
    }
    if (
      !(await confirm({
        description: `Enviar cobrança de ${brl(cents)} via ${carrier}?`,
      }))
    )
      return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_shop_request_freight", {
      p_order_id: o.id,
      p_freight_cents: cents,
      p_carrier: carrier,
      p_note: freightNote,
    });
    if (error) toast.error(`Não foi possível enviar: ${error.message}`);
    else {
      toast.success("Cobrança enviada");
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
      {confirmDialog}
      <h2 className="text-xl font-bold">Loja</h2>
      <label>
        Modo de frete
        <select
          className={inputCls}
          value={mode.data ?? ""}
          onChange={async (e) => {
            const { error } = await supabase.rpc(
              "admin_shop_set_shipping_mode",
              { p_mode: e.target.value },
            );
            if (error) toast.error("Não foi possível alterar o modo de frete.");
            else await mode.refetch();
          }}
        >
          <option value="arrange">A combinar</option>
          <option value="quote">Cotação automática (Melhor Envio)</option>
        </select>
      </label>
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
              onClick={() => {
                setSelected(x.id);
                setFreight(
                  x.freight_cents
                    ? (x.freight_cents / 100).toFixed(2).replace(".", ",")
                    : "",
                );
                setCarrier(x.freight_carrier ?? "");
                setFreightNote(x.freight_note ?? "");
              }}
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
          {o.status === "awaiting_freight" && (
            <p>
              {o.users?.name} · {o.users?.email} · Contato:{" "}
              <a
                href={`https://wa.me/${(o.address.phone ?? "").replace(/\D/g, "")}`}
              >
                WhatsApp
              </a>{" "}
              · <a href={`tel:${o.address.phone}`}>{o.address.phone}</a>
            </p>
          )}
          {["awaiting_freight", "freight_pending"].includes(o.status) && (
            <div className="space-y-2">
              {o.status === "freight_pending" && (
                <p>
                  Frete: {brl(o.freight_cents ?? 0)} · {o.freight_carrier} ·
                  vencimento{" "}
                  {o.freight_due_at &&
                    new Date(o.freight_due_at).toLocaleDateString("pt-BR")}
                </p>
              )}
              <input
                className={inputCls}
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
                placeholder="Valor do frete (R$)"
              />
              <input
                className={inputCls}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Transportadora"
              />
              <input
                className={inputCls}
                value={freightNote}
                onChange={(e) => setFreightNote(e.target.value)}
                placeholder="Observação"
              />
              <button
                className={btnPrimary}
                disabled={busy}
                onClick={() => void requestFreight()}
              >
                {o.status === "freight_pending"
                  ? "Reenviar aviso"
                  : "Enviar cobrança do frete"}
              </button>
            </div>
          )}
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
          {[
            "pending_payment",
            "paid",
            "awaiting_freight",
            "freight_pending",
            "preparing",
          ].includes(o.status) && (
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
