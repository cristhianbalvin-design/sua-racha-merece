import { useState } from "react";
import "../theme.css";
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
} from "../lib/shop";

type Variant = {
  id: string;
  color: string;
  size: string;
  stock: number;
  active: boolean;
};
type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price_cents: number;
  shop_variants: Variant[];
};
type CartItem = {
  variant_id: string;
  product: string;
  color: string;
  size: string;
  unit_cents: number;
  qty: number;
};
type Option = {
  id: string;
  company: string;
  service: string;
  price_cents: number;
  days: number;
};
type Order = {
  id: string;
  status: string;
  total_cents: number;
  shipping_cents: number;
  created_at: string;
  delivered_at: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shop_order_items: (CartItem & { product_name: string })[];
};
const input =
  "w-full rounded-xl border border-[var(--buky-line)] bg-[#111] p-3 text-white";
const button =
  "rounded-full bg-[var(--buky-neon)] px-5 py-3 font-semibold text-black disabled:opacity-40";
const panel = "rounded-2xl border border-[var(--buky-line)] bg-[#111] p-4";
const itemsPayload = (items: CartItem[]) =>
  items.map(({ variant_id, qty }) => ({ variant_id, qty }));
const readCart = (): CartItem[] => {
  try {
    const x = JSON.parse(localStorage.getItem("buky.shop.cart") ?? "[]");
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};
const saveCart = (cart: CartItem[]) => {
  try {
    localStorage.setItem("buky.shop.cart", JSON.stringify(cart));
  } catch {
    toast.error("Não foi possível salvar o carrinho neste aparelho.");
  }
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 px-6 pb-10 pt-[calc(env(safe-area-inset-top,0px)+20px)]">
      <div className="flex flex-wrap gap-4 text-sm text-[var(--buky-neon)]">
        <Link to="/app/loja">Loja 3buk</Link>
        <Link to="/app/loja/carrinho">Carrinho</Link>
        <Link to="/app/loja/pedidos">Meus pedidos</Link>
      </div>
      {children}
    </div>
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
function Gate({ children }: { children: React.ReactNode }) {
  const enabled = useShopEnabled();
  if (enabled.isLoading) return <Shell>Carregando...</Shell>;
  if (enabled.isError) return <Shell>Não foi possível carregar a loja.</Shell>;
  if (!enabled.data)
    return (
      <Shell>
        <h1 className="font-buky text-3xl">A loja abre em breve</h1>
      </Shell>
    );
  return <Shell>{children}</Shell>;
}
function useProducts() {
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
export function Loja() {
  const [tab, setTab] = useState<"products" | "discounts">("products");
  const products = useProducts();
  const { user } = useAuth();
  const navigate = useNavigate();
  const discounts = useQuery({
    queryKey: ["shop-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_public_discounts");
      if (error) throw error;
      return data as {
        id: string;
        brand_name: string;
        title: string;
        conditions: string;
        valid_until: string | null;
        image_url: string | null;
      }[];
    },
  });
  const [revealed, setRevealed] = useState<
    Record<string, { code: string | null; link_url: string | null }>
  >({});
  const reveal = async (id: string) => {
    if (!user) {
      navigate("/login", { state: { redirectTo: "/app/loja" } });
      return;
    }
    const { data, error } = await supabase.rpc("shop_reveal_discount", {
      p_id: id,
    });
    if (error) toast.error("Não foi possível revelar o código.");
    else setRevealed((v) => ({ ...v, [id]: data }));
  };
  return (
    <Gate>
      <h1 className="font-buky text-4xl">Loja 3buk</h1>
      <div className="flex gap-3">
        {(
          [
            ["products", "Produtos"],
            ["discounts", "Descontos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={
              tab === id
                ? button
                : "rounded-full border border-[var(--buky-line)] px-5 py-3 font-semibold text-white"
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "products" ? (
        <div className="grid grid-cols-2 gap-3">
          {products.isError && <p>Não foi possível carregar os produtos.</p>}
          {products.data?.map((p) => (
            <Link
              className={panel}
              to={`/app/loja/produto/${p.slug}`}
              key={p.id}
            >
              {p.images?.[0] && (
                <img
                  className="aspect-square w-full rounded-xl object-cover"
                  src={p.images[0]}
                  alt=""
                />
              )}
              <h2 className="mt-2 font-semibold">{p.name}</h2>
              <p>{brl(p.price_cents)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.data?.map((d) => (
            <article className={panel} key={d.id}>
              {d.image_url && (
                <img
                  className="mb-3 h-32 w-full object-cover"
                  src={d.image_url}
                  alt=""
                />
              )}
              <p>{d.brand_name}</p>
              <h2 className="text-xl font-semibold">{d.title}</h2>
              <p>{d.conditions}</p>
              {d.valid_until && (
                <p>
                  Válido até{" "}
                  {new Date(d.valid_until).toLocaleDateString("pt-BR")}
                </p>
              )}
              {revealed[d.id] ? (
                <div>
                  <strong className="text-2xl">{revealed[d.id].code}</strong>
                  {revealed[d.id].code && (
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          revealed[d.id].code ?? "",
                        )
                      }
                    >
                      {" "}
                      Copiar
                    </button>
                  )}
                  {revealed[d.id].link_url && (
                    <a
                      className="block text-[var(--buky-neon)]"
                      href={revealed[d.id].link_url ?? ""}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Usar desconto
                    </a>
                  )}
                </div>
              ) : (
                <button className={button} onClick={() => void reveal(d.id)}>
                  Ver código
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </Gate>
  );
}
export function Produto() {
  const { slug } = useParams();
  const products = useProducts();
  const p = products.data?.find((x) => x.slug === slug);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const colors = [
    ...new Set(
      p?.shop_variants.filter((v) => v.active).map((v) => v.color) ?? [],
    ),
  ];
  const sizes = [
    ...new Set(
      p?.shop_variants
        .filter((v) => v.active && v.color === color)
        .map((v) => v.size) ?? [],
    ),
  ];
  const variant = p?.shop_variants.find(
    (v) => v.active && v.color === color && v.size === size,
  );
  const add = () => {
    if (!p || !variant || qty < 1 || qty > variant.stock) return;
    const cart = readCart();
    const old = cart.find((i) => i.variant_id === variant.id);
    if ((old?.qty ?? 0) + qty > variant.stock) {
      toast.error("Quantidade acima do estoque disponível.");
      return;
    }
    if (old) old.qty += qty;
    else
      cart.push({
        variant_id: variant.id,
        product: p.name,
        color,
        size,
        unit_cents: p.price_cents,
        qty,
      });
    saveCart(cart);
    toast.success("Adicionado ao carrinho");
  };
  return (
    <Gate>
      {products.isLoading ? (
        <p>Carregando...</p>
      ) : !p ? (
        <p>Produto não encontrado.</p>
      ) : (
        <>
          <h1 className="font-buky text-4xl">{p.name}</h1>
          <div className="flex gap-2 overflow-x-auto">
            {p.images?.map((url) => (
              <img
                key={url}
                src={url}
                alt={p.name}
                className="h-64 rounded-xl"
              />
            ))}
          </div>
          <p>{p.description}</p>
          <p className="text-2xl">{brl(p.price_cents)}</p>
          <label>
            Cor
            <select
              className={input}
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setSize("");
              }}
            >
              <option value="">Selecione</option>
              {colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Tamanho
            <select
              className={input}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="">Selecione</option>
              {sizes.map((s) => (
                <option
                  key={s}
                  disabled={
                    !p.shop_variants.some(
                      (v) =>
                        v.color === color &&
                        v.size === s &&
                        v.stock > 0 &&
                        v.active,
                    )
                  }
                >
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <input
              className={input}
              type="number"
              min="1"
              max={variant?.stock ?? 1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
          <button
            className={button}
            disabled={!variant || variant.stock < qty || qty < 1}
            onClick={add}
          >
            Adicionar ao carrinho
          </button>
        </>
      )}
    </Gate>
  );
}
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
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet });
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
      toast.error("Informe um CEP válido.");
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
      toast.error("Não foi possível consultar o CEP.");
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
      toast.error("Envio indisponível no momento");
    } finally {
      setBusy(false);
    }
  };
  const pay = async (method: "wallet" | "mercadopago") => {
    if (!quote || !selected || busy) return;
    setBusy(true);
    try {
      const { data: id, error } = await supabase.rpc("shop_create_order", {
        p_items: itemsPayload(cart),
        p_address: address,
        p_shipping: { quote_id: quote.quote_id, option_id: selected.id },
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
      toast.error(
        "Não foi possível concluir o pagamento. Confira seus pedidos.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Gate>
      <h1 className="font-buky text-4xl">Carrinho</h1>
      {cart.map((i) => (
        <div className={panel} key={i.variant_id}>
          <p>
            {i.product} · {i.color} · {i.size}
          </p>
          <p>
            {brl(i.unit_cents)} × {i.qty}
          </p>
          <button
            onClick={() =>
              updateCart(cart.filter((x) => x.variant_id !== i.variant_id))
            }
          >
            Remover
          </button>
        </div>
      ))}
      {cart.length === 0 ? (
        <p>Seu carrinho está vazio.</p>
      ) : (
        <>
          <label>
            CEP
            <input
              className={input}
              value={address.cep}
              onChange={(e) => setField("cep", maskCep(e.target.value))}
              onBlur={() => void lookup()}
            />
          </label>
          <button
            className={button}
            disabled={busy || address.cep.replace(/\D/g, "").length !== 8}
            onClick={() => void shipping()}
          >
            Calcular frete
          </button>
          {quote?.options.map((o) => (
            <label className="block" key={o.id}>
              <input
                type="radio"
                checked={option === o.id}
                onChange={() => setOption(o.id)}
              />{" "}
              {o.company} · {o.service} · {brl(o.price_cents)} · {o.days} dias
            </label>
          ))}
          {(
            [
              ["recipient", "Destinatário"],
              ["phone", "Celular +55"],
              ["street", "Rua"],
              ["number", "Número"],
              ["complement", "Complemento"],
              ["district", "Bairro"],
              ["city", "Cidade"],
              ["uf", "UF"],
            ] as const
          ).map(([key, label]) => (
            <label className="block" key={key}>
              {label}
              <input
                className={input}
                value={address[key]}
                onChange={(e) => setField(key, e.target.value)}
              />
            </label>
          ))}
          <p>
            Produtos: {brl(subtotal)} · Frete:{" "}
            {selected ? brl(selected.price_cents) : "—"}
          </p>
          <p className="text-xl">Total: {brl(total)}</p>
          <p className="text-sm">
            Envio para todo o Brasil. Troca de tamanho até 7 dias após a
            entrega; envio de volta por conta do comprador.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={!selected || busy}
              onClick={() => void pay("mercadopago")}
            >
              Pagar com Mercado Pago
            </button>
            <button
              className={button}
              disabled={
                !selected || busy || (wallet.data?.balance_cents ?? 0) < total
              }
              onClick={() => void pay("wallet")}
            >
              Usar saldo
            </button>
          </div>
        </>
      )}
    </Gate>
  );
}
export function Pedidos() {
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
      <h1 className="font-buky text-4xl">Meus pedidos</h1>
      {orders.isError && <p>Não foi possível carregar os pedidos.</p>}
      {orders.data?.map((o) => (
        <Link
          className={`${panel} block`}
          key={o.id}
          to={`/app/loja/pedido/${o.id}`}
        >
          <p>
            {new Date(o.created_at).toLocaleDateString("pt-BR")} ·{" "}
            {brl(o.total_cents)}
          </p>
          <p>{orderLabels[o.status] ?? o.status}</p>
        </Link>
      ))}
    </Gate>
  );
}
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
  const retry = async (method: "wallet" | "mercadopago") => {
    setBusy(true);
    try {
      if (method === "wallet") {
        const r = await supabase.rpc("shop_pay_with_wallet", {
          p_order_id: id,
        });
        if (r.error) throw r.error;
        await order.refetch();
      } else {
        const r = await supabase.functions.invoke("create-shop-checkout", {
          body: { order_id: id },
        });
        if (r.error || !r.data?.checkout_url) throw r.error ?? new Error();
        window.location.assign(r.data.checkout_url);
      }
    } catch {
      toast.error("Pagamento indisponível para este pedido.");
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
    if (error) toast.error("Não foi possível solicitar a troca.");
    else {
      toast.success("Troca solicitada");
      await order.refetch();
    }
    setBusy(false);
  };
  return (
    <Gate>
      <h1 className="font-buky text-4xl">Pedido</h1>
      {order.isError && <p>Pedido não encontrado.</p>}
      {o && (
        <>
          <p>{orderLabels[o.status] ?? o.status}</p>
          <p>Pagamento → Preparando → Enviado → Entregue</p>
          {o.shop_order_items.map((i) => (
            <p key={i.variant_id}>
              {i.product_name} · {i.color} · {i.size} · {i.qty}×
            </p>
          ))}
          <p>Total: {brl(o.total_cents)}</p>
          {o.status === "pending_payment" && (
            <div className="flex gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => void retry("mercadopago")}
              >
                Pagar com Mercado Pago
              </button>
              <button
                className={button}
                disabled={
                  busy || (wallet.data?.balance_cents ?? 0) < o.total_cents
                }
                onClick={() => void retry("wallet")}
              >
                Usar saldo
              </button>
            </div>
          )}
          {o.tracking_code && (
            <p>
              Rastreio:{" "}
              {o.tracking_url ? (
                <a href={o.tracking_url} target="_blank" rel="noreferrer">
                  {o.tracking_code}
                </a>
              ) : (
                o.tracking_code
              )}
            </p>
          )}
          {canExchange && (
            <>
              <textarea
                className={input}
                placeholder="Conte qual tamanho precisa"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className={button}
                disabled={busy}
                onClick={() => void exchange()}
              >
                Solicitar troca de tamanho
              </button>
              <p>O envio de volta fica por conta do comprador.</p>
            </>
          )}
        </>
      )}
    </Gate>
  );
}
