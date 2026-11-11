import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { btnPrimary, card, inputCls } from "./ui";

type Discount = {
  id: string;
  sponsor_id: string | null;
  brand_name: string;
  title: string;
  description: string;
  conditions: string;
  code: string | null;
  link_url: string | null;
  image_url: string | null;
  valid_until: string | null;
  active: boolean;
};
const empty = {
  sponsor_id: "",
  brand_name: "",
  title: "",
  description: "",
  conditions: "",
  code: "",
  link_url: "",
  image_url: "",
  valid_until: "",
  active: false,
};
export default function AdminDescontosLoja() {
  const [draft, setDraft] = useState(empty);
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const discounts = useQuery({
    queryKey: ["admin-shop-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_discounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Discount[];
    },
  });
  const sponsors = useQuery({
    queryKey: ["admin-shop-sponsors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buky_sponsors")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  const edit = (d: Discount) => {
    setId(d.id);
    setDraft({
      sponsor_id: d.sponsor_id ?? "",
      brand_name: d.brand_name,
      title: d.title,
      description: d.description,
      conditions: d.conditions,
      code: d.code ?? "",
      link_url: d.link_url ?? "",
      image_url: d.image_url ?? "",
      valid_until: d.valid_until ? d.valid_until.slice(0, 10) : "",
      active: d.active,
    });
  };
  const remove = async () => {
    if (!id || !window.confirm("Excluir este desconto?")) return;
    const { error } = await supabase
      .from("shop_discounts")
      .delete()
      .eq("id", id);
    if (error)
      toast.error("Não foi possível excluir; desative descontos já revelados.");
    else {
      setId(null);
      setDraft(empty);
      await discounts.refetch();
    }
  };
  const save = async () => {
    setBusy(true);
    const fields = {
      ...draft,
      sponsor_id: draft.sponsor_id || null,
      code: draft.code || null,
      link_url: draft.link_url || null,
      image_url: draft.image_url || null,
      valid_until: draft.valid_until
        ? `${draft.valid_until}T23:59:59-03:00`
        : null,
    };
    const result = id
      ? await supabase.from("shop_discounts").update(fields).eq("id", id)
      : await supabase.from("shop_discounts").insert(fields);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Desconto salvo");
      setId(null);
      setDraft(empty);
      await discounts.refetch();
    }
    setBusy(false);
  };
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold">Descontos</h3>
      <button
        className={btnPrimary}
        onClick={() => {
          setId(null);
          setDraft(empty);
        }}
      >
        Novo desconto
      </button>
      <div className="flex flex-wrap gap-2">
        {discounts.data?.map((d) => (
          <button className={btnPrimary} key={d.id} onClick={() => edit(d)}>
            {d.brand_name} ? {d.title}
          </button>
        ))}
      </div>
      <div className={`${card} space-y-3 p-4`}>
        <label className="block">
          Patrocinador
          <select
            className={inputCls}
            value={draft.sponsor_id}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sponsor_id: e.target.value }))
            }
          >
            <option value="">Sem patrocinador</option>
            {sponsors.data?.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["brand_name", "Marca"],
            ["title", "Título"],
            ["description", "Descrição"],
            ["conditions", "Condições"],
            ["code", "Código"],
            ["link_url", "Link"],
            ["image_url", "URL da imagem"],
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
        <label className="block">
          Válido até
          <input
            className={inputCls}
            type="date"
            value={draft.valid_until}
            onChange={(e) =>
              setDraft((d) => ({ ...d, valid_until: e.target.value }))
            }
          />
        </label>
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
        <button
          className={btnPrimary}
          disabled={busy || !draft.brand_name || !draft.title}
          onClick={() => void save()}
        >
          Salvar desconto
        </button>
        {id && (
          <button className={btnPrimary} onClick={() => void remove()}>
            Excluir desconto
          </button>
        )}
      </div>
    </section>
  );
}
