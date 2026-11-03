import { useEffect, useState, type ReactNode } from "react";
import { searchCities, type City } from "../lib/api";

// Estilos del admin actual de 3BUK (tarjetas, campos y botones).
export const inputCls =
  "w-full bg-input text-foreground rounded-lg px-3 py-2.5 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none disabled:opacity-60";
export const btnPrimary =
  "bg-primary text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl btn-shadow inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none";
export const btnGhost =
  "bg-muted text-foreground text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 hover:bg-muted/80 disabled:opacity-50 disabled:pointer-events-none";
export const btnDanger =
  "bg-destructive/15 text-destructive text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 hover:bg-destructive/25 disabled:opacity-50";
export const card = "bg-card rounded-2xl card-shadow";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "green" | "yellow" | "red" | "blue" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    green: "bg-primary/15 text-primary",
    yellow: "bg-yellow-500/15 text-yellow-400",
    red: "bg-destructive/15 text-destructive",
    blue: "bg-blue-500/15 text-blue-400",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

/** Selector de ciudad del catálogo IBGE (estilo admin). */
export function AdminCityPicker({ value, onChange, placeholder = "Buscar cidade…" }: { value: City | null; onChange: (c: City | null) => void; placeholder?: string }) {
  const [text, setText] = useState(value ? `${value.name} · ${value.uf}` : "");
  const [opts, setOpts] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => setText(value ? `${value.name} · ${value.uf}` : ""), [value?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || text.trim().length < 2 || (value && text === `${value.name} · ${value.uf}`)) return setOpts([]);
    const t = window.setTimeout(() => searchCities(text).then(setOpts).catch(() => setOpts([])), 200);
    return () => window.clearTimeout(t);
  }, [text, open, value]);
  return (
    <div className="relative">
      <input
        className={inputCls}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && opts.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-xl">
          {opts.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                  setOpen(false);
                }}
              >
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dt = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "—";

/** ISO → valor de <input type="datetime-local"> en hora de Brasil. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return parts.replace(" ", "T");
}

/** <input type="datetime-local"> en hora de Brasil (UTC−3, sin horario de verano) → ISO. */
export function fromLocalInput(v: string): string {
  return new Date(`${v}:00-03:00`).toISOString();
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
