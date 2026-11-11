import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { pt } from "../i18n";
import type { City } from "../lib/api";
import { searchCatalog } from "../lib/citySearch";
import { useAllCities, useStates } from "../lib/hooks";

/**
 * Ciudad del catálogo oficial (IBGE) con buscador inteligente: la lista se abre al tocar el
 * campo, tolera acentos y errores de tipeo, y acepta "cidade uf". El Estado filtra la lista y
 * se completa solo al elegir la ciudad.
 */
export default function CityPicker({
  value,
  onChange,
  invalid,
}: {
  value: City | null;
  onChange: (c: City | null) => void;
  invalid?: boolean;
}) {
  const { data: states = [] } = useStates();
  const { data: cities = [], isLoading } = useAllCities();
  const [stateCode, setStateCode] = useState<number | null>(value?.state_code ?? null);
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setText(value?.name ?? "");
    if (value) setStateCode(value.state_code);
  }, [value?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Con una ciudad ya elegida y el texto intacto, la lista muestra las del mismo estado
  const query = value && text === value.name ? "" : text;
  const options = useMemo(() => searchCatalog(cities, query, stateCode, 40), [cities, query, stateCode]);

  useEffect(() => setActive(0), [query, stateCode]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (c: City) => {
    onChange(c);
    setText(c.name);
    setStateCode(c.state_code);
    setOpen(false);
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="relative">
        <label className="buky-field" data-invalid={invalid ? "true" : undefined}>
          <span>{pt.cadastro.cidade}</span>
          <div className="flex items-center gap-2">
            <Search size={16} className="shrink-0 text-[var(--buky-faint)]" />
            <input
              value={text}
              placeholder={pt.cadastro.cidadePh}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
                setOpen(true);
                if (value) onChange(null);
              }}
              onFocus={(e) => {
                setOpen(true);
                e.currentTarget.select();
              }}
              onClick={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => Math.min(a + 1, options.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && open && options[active]) {
                  e.preventDefault();
                  pick(options[active]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
            <button type="button" tabIndex={-1} aria-hidden="true" onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}>
              <ChevronDown size={16} className="shrink-0 text-[var(--buky-muted)]" />
            </button>
          </div>
        </label>
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--buky-line)] bg-[#111] py-1 shadow-xl"
          >
            {isLoading ? (
              <li className="px-3 py-3 text-sm text-[var(--buky-faint)]">{pt.comum.carregando}</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--buky-faint)]">{pt.cadastro.nenhumaCidade}</li>
            ) : (
              <>
                {!query && (
                  <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[var(--buky-faint)]">
                    {stateCode ? pt.cadastro.cidadesDoEstado : pt.cadastro.capitais}
                  </li>
                )}
                {options.map((c, i) => (
                  <li
                    key={c.code}
                    data-i={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer justify-between gap-3 px-3 py-2.5 text-[15px] ${i === active ? "bg-[#1d1d1d]" : ""} ${value?.code === c.code ? "text-[var(--buky-neon)]" : ""}`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-[var(--buky-faint)]">{c.uf}</span>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
      <label className="buky-field">
        <span>{pt.cadastro.estado}</span>
        <div className="flex items-center">
          <select
            value={stateCode ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setStateCode(v);
              if (value && value.state_code !== v) onChange(null);
            }}
            className="appearance-none"
            aria-label={pt.cadastro.estado}
          >
            <option value="" className="bg-[#111]">
              {pt.cadastro.todos}
            </option>
            {states.map((s) => (
              <option key={s.code} value={s.code} className="bg-[#111]">
                {s.uf} · {s.name}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none -ml-4 shrink-0 text-[var(--buky-muted)]" />
        </div>
      </label>
    </div>
  );
}
