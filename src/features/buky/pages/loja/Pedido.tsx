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
  shopStep,
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
export function Pedido() {
  const { id } = useParams();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet });
  const order = useQuery({
    queryKey: ["shop-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*,shop_order_items(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Order;
    },
  });
  const o = order.data;
  const canExchange =
    o && exchangeAvailable(o.status, o.delivered_at, Date.now());
  const retry = async (method: "wallet" | "mercadopago", freight = false) => {
    setBusy(true);
    try {
      if (method === "wallet") {
        const r = await supabase.rpc(
          freight ? "shop_pay_freight_with_wallet" : "shop_pay_with_wallet",
          {
            p_order_id: id,
          },
        );
        if (r.error) throw r.error;
        await order.refetch();
      } else {
        const r = await supabase.functions.invoke("create-shop-checkout", {
          body: { order_id: id, kind: freight ? "freight" : "order" },
        });
        if (r.error || !r.data?.checkout_url) throw r.error ?? new Error();
        window.location.assign(r.data.checkout_url);
      }
    } catch {
      toast.error(T.erroPagamento);
    } finally {
      setBusy(false);
    }
  };
  const exchange = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("shop_request_exchange", {
      p_order_id: id,
      p_note: note,
    });
    if (error) toast.error(T.erroTroca);
    else {
      toast.success(T.trocaSolicitada);
      await order.refetch();
    }
    setBusy(false);
  };
  return (
    <Gate>
      {order.isLoading && <p>{T.carregar}</p>}
      {order.isError && <p>{T.pedidoNaoEncontrado}</p>}
      {o && (
        <>
          <div>
            <p className="text-sm text-[var(--buky-muted)]">
              #{o.id.slice(0, 8).toUpperCase()} ·{" "}
              {new Date(o.created_at).toLocaleDateString("pt-BR")}
            </p>
            <p className="mt-1 text-xl font-bold">
              {orderLabels[o.status] ?? o.status}
            </p>
          </div>
          <div className={`${panel} space-y-0`}>
            {(o.shipping_service === "A combinar"
              ? [
                  T.pagamentoEtapa,
                  T.freteEtapa,
                  T.preparando,
                  T.enviado,
                  T.entregue,
                ]
              : [T.pagamentoEtapa, T.preparando, T.enviado, T.entregue]
            ).map((step, i, steps) => {
              const current = shopStep(
                o.status,
                o.shipping_service === "A combinar",
              );
              return (
                <div key={step} className="flex gap-3">
                  <div className="flex w-4 flex-col items-center">
                    <span
                      className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${i <= current && o.status !== "cancelled" ? "border-[var(--buky-neon)] bg-[var(--buky-neon)]" : "border-[#666]"}`}
                    />
                    {i < steps.length - 1 && (
                      <span
                        className={`min-h-7 w-px flex-1 ${i < current && o.status !== "cancelled" ? "bg-[var(--buky-neon)]" : "bg-[#555]"}`}
                      />
                    )}
                  </div>
                  <span
                    className={`pb-4 ${i === current && o.status !== "cancelled" ? "font-bold text-[var(--buky-neon)]" : "text-[var(--buky-muted)]"}`}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
          {o.status === "freight_pending" && (
            <section className={`${panel} space-y-3 border-[var(--buky-neon)]`}>
              <h2 className="font-bold">{T.fretePendente}</h2>
              <p className="text-xl font-bold">{brl(o.freight_cents ?? 0)}</p>
              <p>
                {o.freight_carrier}
                {o.freight_due_at &&
                  ` · ${T.prazo} ${new Date(o.freight_due_at).toLocaleDateString("pt-BR")}`}
              </p>
              <button
                className={`${button} w-full`}
                disabled={
                  busy ||
                  (wallet.data?.balance_cents ?? 0) < (o.freight_cents ?? 0)
                }
                onClick={() => void retry("wallet", true)}
              >
                {T.pagarSaldo}
              </button>
              <button
                className="min-h-11 w-full rounded-full border border-[var(--buky-line)]"
                disabled={busy}
                onClick={() => void retry("mercadopago", true)}
              >
                {T.pagarMP}
              </button>
            </section>
          )}
          {o.status === "pending_payment" && (
            <div className="space-y-2">
              <button
                className={`${button} w-full`}
                disabled={busy}
                onClick={() => void retry("mercadopago")}
              >
                {T.pagarMP}
              </button>
              <button
                className="min-h-11 w-full rounded-full border border-[var(--buky-line)]"
                disabled={
                  busy || (wallet.data?.balance_cents ?? 0) < o.total_cents
                }
                onClick={() => void retry("wallet")}
              >
                {T.pagarSaldo}
              </button>
            </div>
          )}
          {o.tracking_code && (
            <section className={`${panel} space-y-2`}>
              <h2 className="font-bold">{T.rastreio}</h2>
              <div className="flex items-center justify-between gap-2">
                <span className="break-all">{o.tracking_code}</span>
                <button
                  className="flex min-h-11 items-center gap-2 text-[var(--buky-neon)]"
                  onClick={() => {
                    void navigator.clipboard.writeText(o.tracking_code ?? "");
                    toast.success(T.copiado);
                  }}
                >
                  <Copy size={18} />
                  {T.copiar}
                </button>
              </div>
              {o.tracking_url && (
                <a
                  className="inline-flex min-h-11 items-center text-[var(--buky-neon)]"
                  href={o.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {T.acompanhar} →
                </a>
              )}
            </section>
          )}
          <section className={`${panel} space-y-3`}>
            <h2 className="font-bold">{T.itens}</h2>
            {o.shop_order_items.map((i) => (
              <div key={i.variant_id} className="flex justify-between gap-2">
                <div>
                  <p>{i.product_name}</p>
                  <p className="text-sm text-[var(--buky-muted)]">
                    {i.color} · {i.size} · {i.qty}×
                  </p>
                </div>
                <span>{brl(i.unit_cents * i.qty)}</span>
              </div>
            ))}
            <p className="border-t border-[var(--buky-line)] pt-3 font-bold">
              {T.total}: {brl(o.total_cents)}
            </p>
          </section>
          {o.address && (
            <section className={`${panel} space-y-1`}>
              <h2 className="font-bold">{T.endereco}</h2>
              <p>{o.address.recipient}</p>
              <p>
                {o.address.street}, {o.address.number} {o.address.complement}
              </p>
              <p>
                {o.address.district} · {o.address.city}/{o.address.uf} ·{" "}
                {o.address.cep}
              </p>
            </section>
          )}
          {canExchange && (
            <section className="space-y-2">
              <textarea
                className={input}
                placeholder={T.trocaPlaceholder}
                aria-label={T.trocaPlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className={button}
                disabled={busy}
                onClick={() => void exchange()}
              >
                {T.troca}
              </button>
              <p className="text-sm text-[var(--buky-muted)]">{T.trocaNota}</p>
            </section>
          )}
        </>
      )}
    </Gate>
  );
}
