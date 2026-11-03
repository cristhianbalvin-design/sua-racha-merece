import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { pt } from "../i18n";
import { searchCities, type City } from "../lib/api";
import { useStates } from "../lib/hooks";

/**
 * Ciudad desde el catálogo oficial (IBGE) con autocompletado, y Estado vinculado:
 * el estado filtra la búsqueda y se completa solo al elegir la ciudad.
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
  const [stateCode, setStateCode] = useState<number | null>(value?.state_code ?? null);
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    setText(value?.name ?? "");
    if (value) setStateCode(value.state_code);
  }, [value?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || text.trim().length < 2 || text === value?.name) {
      setOptions([]);
      return;
    }
    const mine = ++seq.current;
    const t = window.setTimeout(() => {
      searchCities(text, stateCode)
        .then((r) => {
          if (mine === seq.current) {
            setOptions(r);
            setActive(0);
          }
        })
        .catch(() => setOptions([]));
    }, 180);
    return () => window.clearTimeout(t);
  }, [text, stateCode, open, value?.name]);

  const pick = (c: City) => {
    onChange(c);
    setText(c.name);
    setStateCode(c.state_code);
    setOpen(false);
  };

  return (
    <div className="grid grid-cols-[1fr_96px] gap-5">
      <div className="relative">
        <label className="buky-field" data-invalid={invalid ? "true" : undefined}>
          <span>{pt.cadastro.cidade}</span>
          <div className="flex items-center">
            <input
              value={text}
              placeholder={pt.cadastro.cidadePh}
              role="combobox"
              aria-expanded={open && options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
                setOpen(true);
                if (value) onChange(null);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (!options.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, options.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  pick(options[active]);
                }
              }}
            />
            <ChevronDown size={16} className="shrink-0 text-[var(--buky-muted)]" />
          </div>
        </label>
        {open && options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-[var(--buky-line)] bg-[#111] py-1 shadow-xl"
          >
            {options.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                className={`flex cursor-pointer justify-between px-3 py-2.5 text-[15px] ${i === active ? "bg-[#1d1d1d]" : ""}`}
              >
                <span>{c.name}</span>
                <span className="text-[var(--buky-faint)]">{c.uf}</span>
              </li>
            ))}
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
              UF
            </option>
            {states.map((s) => (
              <option key={s.code} value={s.code} className="bg-[#111]">
                {s.uf}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none -ml-4 shrink-0 text-[var(--buky-muted)]" />
        </div>
      </label>
    </div>
  );
}
