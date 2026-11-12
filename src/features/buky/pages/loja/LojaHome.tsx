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
    if (error) toast.error(T.erroCodigo);
    else setRevealed((v) => ({ ...v, [id]: data }));
  };
  return (
    <Gate>
      <div className="flex min-h-32 items-center justify-between overflow-hidden rounded-3xl border border-[var(--buky-line)] bg-[#111] px-5">
        <div>
          <p className="buky-label text-[var(--buky-neon)]">3BUK</p>
          <p className="font-buky mt-2 text-3xl">{T.titulo}</p>
        </div>
        <img src={mascote} alt="Buky" className="h-32 w-auto object-contain" />
      </div>
      <div
        className="grid grid-cols-2 rounded-full border border-[var(--buky-line)] bg-[#111] p-1"
        role="group"
        aria-label={T.titulo}
      >
        {(
          [
            ["products", T.produtos],
            ["discounts", T.descontos],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-full font-semibold ${tab === id ? "bg-[var(--buky-neon)] text-black" : "text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "products" ? (
        <>
          {products.isError && <p>{T.erroProdutos}</p>}
          {products.isLoading && (
            <div className="grid grid-cols-2 gap-3" aria-label={T.carregar}>
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-60 animate-pulse rounded-2xl bg-[#171717]"
                />
              ))}
            </div>
          )}
          {!products.isLoading &&
            !products.isError &&
            !products.data?.length && (
              <p className={`${panel} text-center text-[var(--buky-muted)]`}>
                {T.novidades}
              </p>
            )}
          <div className="grid grid-cols-2 gap-3">
            {products.data?.map((p) => {
              const colors = [
                ...new Set(
                  p.shop_variants.filter((v) => v.active).map((v) => v.color),
                ),
              ];
              const soldOut = !p.shop_variants.some(
                (v) => v.active && v.stock > 0,
              );
              return (
                <Link
                  className="min-w-0 rounded-2xl border border-[var(--buky-line)] bg-[#111] p-2.5"
                  to={`/app/loja/produto/${p.slug}`}
                  key={p.id}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[#ddd]">
                    {p.images?.[0] ? (
                      <img
                        className="h-full w-full object-cover"
                        src={p.images[0]}
                        alt={p.name}
                      />
                    ) : (
                      <Package className="m-auto h-full text-[#777]" />
                    )}
                    {soldOut && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-1 text-xs font-bold">
                        {T.esgotado}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 line-clamp-2 min-h-10 font-semibold leading-5">
                    {p.name}
                  </h2>
                  <p className="mt-1 text-lg font-bold">{brl(p.price_cents)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {colors.map((c) => (
                      <span
                        key={c}
                        title={c}
                        aria-label={c}
                        className="h-3 w-3 rounded-full border border-white/30"
                        style={{ backgroundColor: colorValue(c) }}
                      />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {discounts.data?.map((d) => (
            <article className={`${panel} space-y-3`} key={d.id}>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#222] text-xl font-bold text-[var(--buky-neon)]">
                  {d.image_url ? (
                    <img
                      src={d.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    d.brand_name.charAt(0)
                  )}
                </div>
                <div>
                  <p className="text-sm text-[var(--buky-muted)]">
                    {d.brand_name}
                  </p>
                  <h2 className="text-lg font-bold">{d.title}</h2>
                </div>
              </div>
              {d.valid_until && (
                <span className="inline-block rounded-full bg-[#222] px-3 py-1 text-xs">
                  {T.validade}{" "}
                  {new Date(d.valid_until).toLocaleDateString("pt-BR")}
                </span>
              )}
              <details>
                <summary className="cursor-pointer py-3 text-sm text-[var(--buky-muted)]">
                  {T.condicoes}
                </summary>
                <p>{d.conditions}</p>
              </details>
              {!user && (
                <p className="text-sm text-[var(--buky-muted)]">
                  {T.entrarDesconto}{" "}
                  <Link
                    className="text-[var(--buky-neon)]"
                    to="/login"
                    state={{ redirectTo: "/app/loja" }}
                  >
                    {T.entrar}
                  </Link>
                </p>
              )}
              {revealed[d.id] ? (
                <div className="space-y-2">
                  {revealed[d.id].code && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--buky-neon)] p-3">
                      <strong className="break-all text-xl">
                        {revealed[d.id].code}
                      </strong>
                      <button
                        className="min-h-11 px-3 text-[var(--buky-neon)]"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            revealed[d.id].code ?? "",
                          );
                          toast.success(T.copiado);
                        }}
                      >
                        <Copy size={18} aria-hidden /> {T.copiar}
                      </button>
                    </div>
                  )}
                  {revealed[d.id].link_url && (
                    <a
                      className={`${button} inline-flex items-center`}
                      href={revealed[d.id].link_url ?? ""}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {T.abrirSite}
                    </a>
                  )}
                </div>
              ) : (
                <button className={button} onClick={() => void reveal(d.id)}>
                  {T.verCodigo}
                </button>
              )}
            </article>
          ))}
          {!discounts.isLoading && !discounts.data?.length && (
            <p className={panel}>{T.semDescontos}</p>
          )}
        </div>
      )}
    </Gate>
  );
}

function colorValue(color: string) {
  const colors: Record<string, string> = {
    preto: "#171717",
    branco: "#fff",
    cinza: "#888",
    verde: "#39ff14",
    azul: "#2563eb",
    vermelho: "#dc2626",
    rosa: "#ec4899",
    amarelo: "#eab308",
  };
  return colors[color.toLowerCase()] ?? color;
}
