import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { useBukyProfile, useCity, useSummary } from "../lib/hooks";
import ShareSheet from "./ShareSheet";
import type { StickerData } from "./stickerCanvas";

export default function ShareButton({ data }: { data: Omit<StickerData, "total"> }) {
  const [open, setOpen] = useState(false);
  const { data: summary, isError, refetch } = useSummary();
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { date, bukys, shape, distance, duration, speed } = data;
  const place =
    data.city && city?.name.toLocaleLowerCase("pt-BR") === data.city.toLocaleLowerCase("pt-BR")
      ? `${data.city}, ${city.uf}`
      : data.city;
  const sticker = useMemo(
    () => ({ date, bukys, shape, distance, duration, speed, city: place, total: summary?.found_total ?? 0 }),
    [date, bukys, shape, distance, duration, speed, place, summary?.found_total],
  );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isError) void refetch();
          else setOpen(true);
        }}
        disabled={!summary && !isError}
        className="mt-3 flex items-center justify-center gap-2 rounded-full border border-[var(--buky-line)] px-4 py-2 text-sm"
      >
        <Share2 size={16} /> {isError ? "Tentar carregar total" : "Compartilhar"}
      </button>
      <ShareSheet open={open} onClose={() => setOpen(false)} data={sticker} />
    </>
  );
}
