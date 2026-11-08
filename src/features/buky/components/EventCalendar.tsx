import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { pt } from "../i18n";
import type { FotoEvent } from "../lib/fotos";

const F = pt.fotos;
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Buscar el evento por fecha (observación 2 del 7/11): calendario del mes con los días que tienen
 * fotos marcados; al tocar un día aparecen sus eventos. Abre en el mes del evento más reciente.
 */
export default function EventCalendar({
  events,
  selectedKey,
  onPick,
}: {
  events: FotoEvent[];
  selectedKey?: string | null;
  onPick: (ev: FotoEvent) => void;
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, FotoEvent[]>();
    for (const ev of events) m.set(ev.date, [...(m.get(ev.date) ?? []), ev]);
    return m;
  }, [events]);
  const latest = useMemo(() => [...byDay.keys()].sort().at(-1) ?? null, [byDay]);
  const selectedEvent = events.find((e) => e.key === selectedKey) ?? null;
  const start = selectedEvent?.date ?? latest ?? ymd(new Date().getFullYear(), new Date().getMonth(), 1);
  const [cursor, setCursor] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const [day, setDay] = useState<string | null>(selectedEvent?.date ?? latest);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const monthLabel = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const inMonth = [...byDay.keys()].filter((d) => d.startsWith(ymd(cursor.y, cursor.m, 1).slice(0, 7))).length;
  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const list = day ? byDay.get(day) ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} aria-label={F.mesAnterior} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--buky-line)]">
          <ChevronLeft size={18} />
        </button>
        <p className="text-center">
          <span className="block text-[16px] font-semibold capitalize">{monthLabel}</span>
          <span className="block text-[12px] text-[var(--buky-muted)]">{F.diasComFotos(inMonth)}</span>
        </p>
        <button type="button" onClick={() => move(1)} aria-label={F.mesSeguinte} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--buky-line)]">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={monthLabel}>
        {WEEK.map((w, i) => (
          <span key={i} className="pb-1 text-[11px] font-semibold text-[var(--buky-faint)]">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const key = ymd(cursor.y, cursor.m, d);
          const has = byDay.has(key);
          const sel = key === day;
          return (
            <button
              key={i}
              type="button"
              disabled={!has}
              onClick={() => setDay(key)}
              aria-pressed={sel}
              aria-label={has ? `${d} · ${F.eventosNoDia(byDay.get(key)!.length)}` : String(d)}
              className={`relative flex h-10 items-center justify-center rounded-full text-[14px] ${
                sel ? "bg-[var(--buky-neon)] font-bold text-[#050505]" : has ? "font-semibold text-white hover:bg-[#1c1c1c]" : "text-[#4a4a4a]"
              }`}
            >
              {d}
              {has && !sel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--buky-neon)]" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[var(--buky-line)] pt-3">
        {!day ? (
          <p className="py-3 text-sm text-[var(--buky-faint)]">{F.escolhaDia}</p>
        ) : (
          <>
            <p className="buky-label text-[var(--buky-muted)]">
              {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <ul className="-mx-2 mt-1">
              {list.map((ev) => (
                <li key={ev.key}>
                  <button type="button" onClick={() => onPick(ev)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#161616]">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold">{ev.title}</span>
                      <span className="block text-[13px] text-[var(--buky-muted)]">{ev.subtitle}</span>
                    </span>
                    {selectedKey === ev.key && <Check size={18} className="shrink-0 text-[var(--buky-neon)]" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
