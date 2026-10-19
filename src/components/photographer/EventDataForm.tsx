import type { ReactNode } from 'react';
import type { EventUploadFields } from '@/lib/upload/edgeUpload';
import { todayIso } from '@/lib/photoStatus';

interface Props {
  value: EventUploadFields;
  onChange: (next: EventUploadFields) => void;
  disabled: boolean;
  regions: { id: string; name: string }[];
  sports: { id: string; name: string }[];
  cities: string[];
  errors: Partial<Record<keyof EventUploadFields, string>>;
  subtitle: string;
  children?: ReactNode;
}

const fieldClass =
  'w-full bg-input text-foreground rounded-lg px-3 py-2.5 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all disabled:opacity-60';

const EventDataForm = ({ value, onChange, disabled, regions, sports, cities, errors, subtitle, children }: Props) => {
  const set = (k: keyof EventUploadFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="bg-card rounded-2xl card-shadow p-5 space-y-4">
      <div>
        <h2 className="font-bold text-foreground">Dados do evento</h2>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div>
        <label htmlFor="ev-region" className="text-ui text-xs text-muted-foreground block mb-1.5">REGIÃO *</label>
        <select id="ev-region" className={fieldClass} value={value.region_id} onChange={set('region_id')} disabled={disabled}>
          <option value="">Selecione…</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {errors.region_id && <p className="text-destructive text-xs mt-1">{errors.region_id}</p>}
      </div>

      <div>
        <label htmlFor="ev-sport" className="text-ui text-xs text-muted-foreground block mb-1.5">ESPORTE *</label>
        <select id="ev-sport" className={fieldClass} value={value.sport_id} onChange={set('sport_id')} disabled={disabled}>
          <option value="">Selecione…</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {errors.sport_id && <p className="text-destructive text-xs mt-1">{errors.sport_id}</p>}
      </div>

      <div>
        <label htmlFor="ev-city" className="text-ui text-xs text-muted-foreground block mb-1.5">CIDADE *</label>
        <input id="ev-city" type="text" list="ev-cities" className={fieldClass} placeholder="Ex.: São Paulo" value={value.city} onChange={set('city')} disabled={disabled} />
        <datalist id="ev-cities">
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
        {errors.city && <p className="text-destructive text-xs mt-1">{errors.city}</p>}
      </div>

      <div>
        <label htmlFor="ev-date" className="text-ui text-xs text-muted-foreground block mb-1.5">DATA DO EVENTO *</label>
        <input id="ev-date" type="date" className={fieldClass} max={todayIso()} value={value.event_date} onChange={set('event_date')} disabled={disabled} />
        {errors.event_date && <p className="text-destructive text-xs mt-1">{errors.event_date}</p>}
      </div>

      {children}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        As fotos entram como pendentes e só aparecem na busca facial depois de aprovadas pela equipe 3BUK.
      </p>
    </div>
  );
};

export default EventDataForm;
