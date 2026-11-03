// Prueba de contrato: la Edge Function y el SQL hablan el mismo idioma.
// Genera con buildFinalize (el mismo código de buky-close-session) la llamada a
// buky_finalize_session para un trote real sobre la ruta oficial de test_16 y la imprime como SQL.
import { buildFinalize, parseCloseRequest, rulesFromSettings, toEnginePoints } from "../../functions/buky-close-session/logic.ts";

const SID = "5e000000-0000-0000-0000-0000000000c1";
const USER = "aaaaaaaa-0000-0000-0000-000000000001";
const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);
const M = 1 / 111_320;
// Trote a 10 km/h hacia el sur desde -22.9040 hasta pasar -22.9160 (los 3 puntos de la ruta)
const readings: number[][] = [];
for (let s = 0; s * (10 / 3.6) < 1_450; s++) {
  readings.push([s, T0 + s * 1000, T0 + s * 1000 + 250, -22.904 - (s * (10 / 3.6)) * M, -43.11, 5, 0]);
}
const points = toEnginePoints([
  { id: "0f000000-0000-0000-0000-0000000000a1", label: "P1", lat: -22.905, lon: -43.11, radius_m: 50 },
  { id: "0f000000-0000-0000-0000-0000000000a2", label: "P2", lat: -22.91, lon: -43.11, radius_m: 50 },
  { id: "0f000000-0000-0000-0000-0000000000a3", label: "P3", lat: -22.915, lon: -43.11, radius_m: 50 },
]);
const parsed = parseCloseRequest({ session_id: SID, readings });
const { params } = buildFinalize({
  sessionId: SID, userId: USER, startedAt: T0, now: T0 + 3_600_000, points,
  readings: parsed.readings, rules: rulesFromSettings([]), trackPath: `${USER}/${SID}.json.gz`,
});
const lit = (v: unknown) => (v === null ? "NULL" : `'${String(typeof v === "object" ? JSON.stringify(v) : v).replaceAll("'", "''")}'`);
console.log(`INSERT INTO public.buky_sessions (id, user_id, route_id, started_at)
VALUES ('${SID}', '${USER}', '0f000000-0000-0000-0000-000000000001', '${new Date(T0).toISOString()}');
DO $$
DECLARE r jsonb := public.buky_finalize_session(${lit(params.p_session_id)}::uuid, ${lit(params.p_user_id)}::uuid,
  ${lit(params.p_status)}, ${lit(params.p_reason)}, ${lit(params.p_stats)}::jsonb, ${lit(params.p_passes)}::jsonb, ${lit(params.p_track_path)});
BEGIN
  RAISE NOTICE 'contrato Edge Function → SQL: %', r;
  IF (r ->> 'bukys')::int <> 3 THEN RAISE EXCEPTION 'esperaba 3 Bukys: %', r; END IF;
  IF (SELECT distance_m FROM public.buky_sessions WHERE id = '${SID}') NOT BETWEEN 1400 AND 1500 THEN
    RAISE EXCEPTION 'distancia no guardada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buky_passes WHERE session_id = '${SID}' AND (speed_kmh < 9 OR speed_kmh > 11)) THEN
    RAISE EXCEPTION 'velocidad de las pasadas mal guardada';
  END IF;
END $$;`);
