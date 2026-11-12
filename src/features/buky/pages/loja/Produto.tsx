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
  variantAvailable,
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
export function Produto() {
  const { slug } = useParams();
  const products = useProducts();
  const p = products.data?.find((x) => x.slug === slug);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const mode = useQuery({
    queryKey: ["shop-shipping-mode"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_shipping_mode");
      if (error) throw error;
      return data as "arrange" | "quote";
    },
  });
  const colors = [
    ...new Set(
      p?.shop_variants.filter((v) => v.active).map((v) => v.color) ?? [],
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
      toast.error(T.erroEstoque);
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
        image: p.images?.[0],
        qty,
      });
    saveCart(cart);
    toast.success(T.adicionado);
  };
  return (
    <Gate>
      {products.isLoading ? (
        <p>{T.carregar}</p>
      ) : !p ? (
        <p>{T.produtoNaoEncontrado}</p>
      ) : (
        <>
          <div className="relative">
            <div
              className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl bg-[#ddd]"
              onScroll={(e) => {
                const el = e.currentTarget;
                setPhoto(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {p.images?.length ? (
                p.images.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt={p.name}
                    className="aspect-square w-full shrink-0 snap-center object-cover"
                  />
                ))
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-[#777]">
                  <Package size={48} />
                </div>
              )}
            </div>
            {p.images?.length > 1 && (
              <div className="mt-3 flex justify-center gap-2">
                {p.images.map((url, i) => (
                  <span
                    key={url}
                    aria-label={`${T.selecionarImagem} ${i + 1}`}
                    className={`h-2 w-2 rounded-full ${photo === i ? "bg-[var(--buky-neon)]" : "bg-[#666]"}`}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-buky text-3xl">{p.name}</h2>
            <p className="mt-2 text-3xl font-bold">{brl(p.price_cents)}</p>
          </div>
          <fieldset>
            <legend className="mb-2 font-semibold">{T.cor}</legend>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c}
                  disabled={!variantAvailable(p.shop_variants, c)}
                  aria-pressed={color === c}
                  onClick={() => {
                    setColor(c);
                    setSize("");
                    setQty(1);
                  }}
                  className={`min-h-11 rounded-full border px-4 disabled:opacity-35 ${color === c ? "border-[var(--buky-neon)] bg-[var(--buky-neon)] text-black" : "border-[var(--buky-line)]"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{T.tamanho}</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ...new Set(
                  p.shop_variants.filter((v) => v.active).map((v) => v.size),
                ),
              ].map((sz) => (
                <button
                  type="button"
                  key={sz}
                  disabled={
                    !color || !variantAvailable(p.shop_variants, color, sz)
                  }
                  aria-pressed={size === sz}
                  onClick={() => {
                    setSize(sz);
                    setQty(1);
                  }}
                  className={`min-h-11 min-w-11 rounded-full border px-4 disabled:opacity-35 ${size === sz ? "border-[var(--buky-neon)] bg-[var(--buky-neon)] text-black" : "border-[var(--buky-line)]"}`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </fieldset>
          {variant && variant.stock > 0 && variant.stock <= 3 && (
            <p className="text-sm text-amber-400">{T.ultimas(variant.stock)}</p>
          )}
          <div>
            <p className="mb-2 font-semibold">{T.quantidade}</p>
            <div className="inline-flex items-center rounded-full border border-[var(--buky-line)]">
              <button
                aria-label={T.diminuir}
                className="flex h-11 w-11 items-center justify-center"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={18} />
              </button>
              <span className="w-8 text-center">{qty}</span>
              <button
                aria-label={T.aumentar}
                className="flex h-11 w-11 items-center justify-center disabled:opacity-35"
                disabled={!variant || qty >= variant.stock}
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold">{T.descricao}</h3>
            <p className="mt-2 text-[var(--buky-muted)]">{p.description}</p>
          </div>
          <div className={`${panel} flex gap-3 text-sm`}>
            <Truck className="shrink-0 text-[var(--buky-neon)]" size={20} />
            <p>{mode.data === "quote" ? T.freteCotado : T.freteCombinar}</p>
          </div>
          {/* Espacio para que el botón fijo no tape el final del contenido */}
          <div className="h-28" aria-hidden />
          <div
            className="fixed inset-x-0 z-30 mx-auto max-w-[480px] bg-gradient-to-t from-black via-black to-transparent px-6 pb-2 pt-4"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
          >
            <button
              className={`${button} w-full`}
              disabled={!variant || variant.stock < qty || qty < 1}
              onClick={add}
            >
              {T.adicionar} · {brl(p.price_cents * qty)}
            </button>
          </div>
          <div className="h-16" aria-hidden />
        </>
      )}
    </Gate>
  );
}
