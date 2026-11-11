import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { btnPrimary, card, inputCls } from "./ui";

type Variant = {
  id: string;
  product_id: string;
  color: string;
  size: string;
  sku: string;
  stock: number;
  active: boolean;
};
type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  images: string[];
  active: boolean;
  weight_kg: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  shop_variants: Variant[];
};
const blank = {
  slug: "",
  name: "",
  description: "",
  price_cents: 0,
  images: [] as string[],
  active: false,
  weight_kg: 0.5,
  width_cm: 25,
  height_cm: 5,
  length_cm: 30,
};
export default function AdminProdutosLoja() {
  const [draft, setDraft] = useState(blank);
  const [id, setId] = useState<string | null>(null);
  const [variant, setVariant] = useState({
    id: "",
    color: "",
    size: "",
    sku: "",
    stock: 0,
    active: true,
  });
  const [busy, setBusy] = useState(false);
  const products = useQuery({
    queryKey: ["admin-shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*,shop_variants(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
  const edit = (p: Product) => {
    setId(p.id);
    setDraft({
      slug: p.slug,
      name: p.name,
      description: p.description,
      price_cents: p.price_cents,
      images: p.images,
      active: p.active,
      weight_kg: p.weight_kg,
      width_cm: p.width_cm,
      height_cm: p.height_cm,
      length_cm: p.length_cm,
    });
    setVariant({
      id: "",
      color: "",
      size: "",
      sku: "",
      stock: 0,
      active: true,
    });
  };
  const save = async () => {
    setBusy(true);
    const result = id
      ? await supabase
          .from("shop_products")
          .update(draft)
          .eq("id", id)
          .select("id")
          .single()
      : await supabase
          .from("shop_products")
          .insert(draft)
          .select("id")
          .single();
    if (result.error) toast.error(result.error.message);
    else {
      setId(result.data.id);
      toast.success("Produto salvo");
      await products.refetch();
    }
    setBusy(false);
  };
  const saveVariant = async () => {
    if (!id) return;
    setBusy(true);
    const { id: vid, ...fields } = variant;
    const result = vid
      ? await supabase.from("shop_variants").update(fields).eq("id", vid)
      : await supabase
          .from("shop_variants")
          .insert({ ...fields, product_id: id });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Variante salva");
      setVariant({
        id: "",
        color: "",
        size: "",
        sku: "",
        stock: 0,
        active: true,
      });
      await products.refetch();
    }
    setBusy(false);
  };
  const remove = async (
    table: "shop_products" | "shop_variants",
    target: string,
  ) => {
    if (
      !window.confirm(
        "Excluir este registro? Registros usados em pedidos devem ser desativados.",
      )
    )
      return;
    const { error } = await supabase.from(table).delete().eq("id", target);
    if (error)
      toast.error(
        "Não foi possível excluir. Desative registros vinculados a pedidos.",
      );
    else {
      if (table === "shop_products") {
        setId(null);
        setDraft(blank);
      } else
        setVariant({
          id: "",
          color: "",
          size: "",
          sku: "",
          stock: 0,
          active: true,
        });
      await products.refetch();
    }
  };
  const upload = async (file: File) => {
    setBusy(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("shop-images")
      .upload(path, file);
    if (error) toast.error(error.message);
    else {
      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      setDraft((d) => ({ ...d, images: [...d.images, data.publicUrl] }));
    }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Produtos</h3>
      <button
        className={btnPrimary}
        onClick={() => {
          setId(null);
          setDraft(blank);
        }}
      >
        Novo produto
      </button>
      <div className="flex flex-wrap gap-2">
        {products.data?.map((p) => (
          <button className={btnPrimary} key={p.id} onClick={() => edit(p)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className={`${card} space-y-3 p-4`}>
        {(
          [
            ["name", "Nome"],
            ["slug", "Slug"],
            ["description", "Descrição"],
          ] as const
        ).map(([k, label]) => (
          <label className="block" key={k}>
            {label}
            <input
              className={inputCls}
              value={draft[k]}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            />
          </label>
        ))}
        {(
          [
            ["price_cents", "Preço em centavos"],
            ["weight_kg", "Peso (kg)"],
            ["width_cm", "Largura (cm)"],
            ["height_cm", "Altura (cm)"],
            ["length_cm", "Comprimento (cm)"],
          ] as const
        ).map(([k, label]) => (
          <label className="block" key={k}>
            {label}
            <input
              className={inputCls}
              type="number"
              min="0"
              step="any"
              value={draft[k]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) =>
              setDraft((d) => ({ ...d, active: e.target.checked }))
            }
          />{" "}
          Ativo
        </label>
        <label className="block">
          Imagens
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
        </label>
        {draft.images.map((url) => (
          <div key={url}>
            <img src={url} alt="" className="h-20" />
            <button
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  images: d.images.filter((x) => x !== url),
                }))
              }
            >
              Remover imagem
            </button>
          </div>
        ))}
        <button
          className={btnPrimary}
          disabled={
            busy || !draft.name || !draft.slug || draft.price_cents <= 0
          }
          onClick={() => void save()}
        >
          Salvar produto
        </button>
        {id && (
          <button
            className={btnPrimary}
            onClick={() => void remove("shop_products", id)}
          >
            Excluir produto
          </button>
        )}
      </div>
      {id && (
        <div className={`${card} space-y-3 p-4`}>
          <h4 className="font-bold">Variantes</h4>
          {products.data
            ?.find((p) => p.id === id)
            ?.shop_variants.map((v) => (
              <button
                className="mr-2"
                key={v.id}
                onClick={() =>
                  setVariant({
                    id: v.id,
                    color: v.color,
                    size: v.size,
                    sku: v.sku,
                    stock: v.stock,
                    active: v.active,
                  })
                }
              >
                {v.color} / {v.size} ({v.stock})
              </button>
            ))}
          {(
            [
              ["color", "Cor"],
              ["size", "Tamanho"],
              ["sku", "SKU"],
            ] as const
          ).map(([k, label]) => (
            <label className="block" key={k}>
              {label}
              <input
                className={inputCls}
                value={variant[k]}
                onChange={(e) =>
                  setVariant((v) => ({ ...v, [k]: e.target.value }))
                }
              />
            </label>
          ))}
          <label className="block">
            Estoque
            <input
              className={inputCls}
              type="number"
              min="0"
              value={variant.stock}
              onChange={(e) =>
                setVariant((v) => ({ ...v, stock: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={variant.active}
              onChange={(e) =>
                setVariant((v) => ({ ...v, active: e.target.checked }))
              }
            />{" "}
            Ativa
          </label>
          <button
            className={btnPrimary}
            disabled={busy || !variant.color || !variant.size || !variant.sku}
            onClick={() => void saveVariant()}
          >
            Salvar variante
          </button>
          {variant.id && (
            <button
              className={btnPrimary}
              onClick={() => void remove("shop_variants", variant.id)}
            >
              Excluir variante
            </button>
          )}
        </div>
      )}
    </div>
  );
}
