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
export function Carrinho() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCart);
  const [address, setAddress] = useState({
    recipient: "",
    phone: "+55 ",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
  });
  const [quote, setQuote] = useState<{
    quote_id: string;
    options: Option[];
  } | null>(null);
  const [option, setOption] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"wallet" | "mercadopago">("mercadopago");
  const [submitted, setSubmitted] = useState(false);
  const products = useProducts();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet });
  const mode = useQuery({
    queryKey: ["shop-shipping-mode"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_shipping_mode");
      if (error) throw error;
      return data as "arrange" | "quote";
    },
  });
  const arrange = mode.data === "arrange";
  const subtotal = cartTotal(cart);
  const selected = quote?.options.find((o) => o.id === option);
  const total = subtotal + (selected?.price_cents ?? 0);
  const setField = (key: keyof typeof address, value: string) => {
    setAddress((a) => ({ ...a, [key]: value }));
    if (key === "cep") {
      setQuote(null);
      setOption("");
    }
  };
  const updateCart = (next: CartItem[]) => {
    setCart(next);
    saveCart(next);
    setQuote(null);
    setOption("");
  };
  const lookup = async () => {
    const cep = address.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error(T.cepInvalido);
      return;
    }
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!r.ok || d.erro) throw new Error();
      setAddress((a) => ({
        ...a,
        street: d.logradouro ?? "",
        district: d.bairro ?? "",
        city: d.localidade ?? "",
        uf: d.uf ?? "",
      }));
    } catch {
      toast.error(T.erroCep);
    }
  };
  const shipping = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "shop-shipping-quote",
        { body: { cep: address.cep, items: itemsPayload(cart) } },
      );
      if (error || !data?.options?.length) throw new Error();
      setQuote(data);
      setOption("");
    } catch {
      setQuote(null);
      toast.error(T.erroFrete);
    } finally {
      setBusy(false);
    }
  };
  const pay = async (method: "wallet" | "mercadopago") => {
    if (busy || !mode.data || (!arrange && (!quote || !selected))) return;
    setBusy(true);
    try {
      const { data: id, error } = await supabase.rpc("shop_create_order", {
        p_items: itemsPayload(cart),
        p_address: address,
        p_shipping: arrange
          ? null
          : { quote_id: quote!.quote_id, option_id: selected!.id },
      });
      if (error || !id) throw error ?? new Error();
      updateCart([]);
      if (method === "wallet") {
        const result = await supabase.rpc("shop_pay_with_wallet", {
          p_order_id: id,
        });
        if (result.error) {
          navigate(`/app/loja/pedido/${id}`);
          throw result.error;
        }
        navigate(`/app/loja/pedido/${id}`);
      } else {
        const result = await supabase.functions.invoke("create-shop-checkout", {
          body: { order_id: id },
        });
        if (result.error || !result.data?.checkout_url) {
          navigate(`/app/loja/pedido/${id}`);
          throw result.error ?? new Error();
        }
        window.location.assign(result.data.checkout_url);
      }
    } catch {
      toast.error(T.erroFinalizar);
    } finally {
      setBusy(false);
    }
  };
  const fields = [
    ["recipient", T.destinatario],
    ["phone", T.celular],
    ["cep", T.cep],
    ["street", T.rua],
    ["number", T.numero],
    ["complement", T.complemento],
    ["district", T.bairro],
    ["city", T.cidade],
    ["uf", T.uf],
  ] as const;
  const invalid = (key: keyof typeof address) =>
    key === "cep"
      ? address.cep.replace(/\D/g, "").length !== 8
      : key !== "complement" && !address[key].trim();
  const finish = () => {
    setSubmitted(true);
    if (fields.some(([key]) => invalid(key))) return;
    void pay(method);
  };
  return (
    <Gate>
      {cart.length === 0 ? (
        <div
          className={`${panel} flex flex-col items-center gap-4 py-10 text-center`}
        >
          <ShoppingCart size={42} className="text-[var(--buky-neon)]" />
          <p>{T.vazio}</p>
          <Link to="/app/loja" className={button}>
            {T.verProdutos}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((i) => {
              const product = products.data?.find((p) =>
                p.shop_variants.some((v) => v.id === i.variant_id),
              );
              const stock = product?.shop_variants.find(
                (v) => v.id === i.variant_id,
              )?.stock;
              const image = i.image ?? product?.images?.[0];
              return (
                <article className={`${panel} flex gap-3`} key={i.variant_id}>
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
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <h2 className="font-bold">{i.product}</h2>
                      <button
                        aria-label={`${T.remover} ${i.product}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--buky-muted)]"
                        onClick={() =>
                          updateCart(
                            cart.filter((x) => x.variant_id !== i.variant_id),
                          )
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <p className="text-sm text-[var(--buky-muted)]">
                      {i.color} · {i.size}
                    </p>
                    <p className="mt-1 font-semibold">{brl(i.unit_cents)}</p>
                    <div className="mt-2 inline-flex items-center rounded-full border border-[var(--buky-line)]">
                      <button
                        aria-label={T.diminuir}
                        disabled={i.qty <= 1}
                        className="flex h-11 w-11 items-center justify-center disabled:opacity-35"
                        onClick={() =>
                          updateCart(
                            cart.map((x) =>
                              x.variant_id === i.variant_id
                                ? { ...x, qty: x.qty - 1 }
                                : x,
                            ),
                          )
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <span>{i.qty}</span>
                      <button
                        aria-label={T.aumentar}
                        disabled={stock === undefined || i.qty >= stock}
                        className="flex h-11 w-11 items-center justify-center disabled:opacity-35"
                        onClick={() =>
                          updateCart(
                            cart.map((x) =>
                              x.variant_id === i.variant_id
                                ? { ...x, qty: x.qty + 1 }
                                : x,
                            ),
                          )
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <section className={`${panel} space-y-4`}>
            <h2 className="text-lg font-bold">{T.endereco}</h2>
            <div className="grid grid-cols-2 gap-3">
              {fields.map(([key, label]) => (
                <label
                  key={key}
                  className={`${["number", "complement", "city", "uf"].includes(key) ? "col-span-1" : "col-span-2"} text-sm`}
                >
                  {label}
                  <input
                    className={`${input} mt-1 min-h-11`}
                    value={address[key]}
                    aria-invalid={submitted && invalid(key)}
                    onChange={(e) =>
                      setField(
                        key,
                        key === "cep"
                          ? maskCep(e.target.value)
                          : e.target.value,
                      )
                    }
                    onBlur={
                      key === "cep"
                        ? () => {
                            if (address.cep.replace(/\D/g, "").length === 8)
                              void lookup();
                          }
                        : undefined
                    }
                  />
                  {submitted && invalid(key) && (
                    <span className="mt-1 block text-xs text-red-400">
                      {key === "cep" ? T.cepInvalido : T.campoObrigatorio}
                    </span>
                  )}
                </label>
              ))}
            </div>
            {arrange ? (
              <p className="text-sm text-[var(--buky-muted)]">
                {T.freteCombinar}
              </p>
            ) : (
              <button
                className={button}
                disabled={busy || address.cep.replace(/\D/g, "").length !== 8}
                onClick={() => void shipping()}
              >
                {T.calcularFrete}
              </button>
            )}
            {quote?.options.map((o) => (
              <label className="flex min-h-11 items-center gap-2" key={o.id}>
                <input
                  type="radio"
                  checked={option === o.id}
                  onChange={() => setOption(o.id)}
                />
                {o.company} · {o.service} · {brl(o.price_cents)} · {o.days} dias
              </label>
            ))}
          </section>
          <section className={`${panel} space-y-3`}>
            <h2 className="text-lg font-bold">{T.pagamento}</h2>
            {(["wallet", "mercadopago"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                disabled={
                  m === "wallet" && (wallet.data?.balance_cents ?? 0) < total
                }
                onClick={() => setMethod(m)}
                className={`w-full rounded-xl border p-4 text-left disabled:opacity-40 ${method === m ? "border-[var(--buky-neon)] bg-[rgba(57,255,20,0.06)]" : "border-[var(--buky-line)]"}`}
              >
                <span className="font-semibold">
                  {m === "wallet" ? T.saldo : T.mercadoPago}
                </span>
                {m === "wallet" && (
                  <span className="mt-1 block text-sm text-[var(--buky-muted)]">
                    {T.saldoDisponivel}: {brl(wallet.data?.balance_cents ?? 0)}
                  </span>
                )}
              </button>
            ))}
          </section>
          <section className={`${panel} space-y-2`}>
            <div className="flex justify-between">
              <span>{T.produtos}</span>
              <span>{brl(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{T.frete}</span>
              <span>
                {arrange
                  ? T.combinar
                  : selected
                    ? brl(selected.price_cents)
                    : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t border-[var(--buky-line)] pt-3 text-xl font-bold">
              <span>{T.total}</span>
              <span>{brl(total)}</span>
            </div>
            <p className="text-xs text-[var(--buky-muted)]">{T.envioNota}</p>
            <button
              className={`${button} mt-3 w-full`}
              disabled={
                !mode.data ||
                (!arrange && !selected) ||
                busy ||
                (method === "wallet" &&
                  (wallet.data?.balance_cents ?? 0) < total)
              }
              onClick={finish}
            >
              {T.finalizar}
            </button>
          </section>
        </>
      )}
    </Gate>
  );
}
