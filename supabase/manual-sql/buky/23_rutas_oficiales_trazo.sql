-- Paso 23 · Rutas oficiales (admin) también como trazo con Bukys automáticos.
-- El admin dibuja el recorrido y define cada cuántos metros va un Buky; ese valor se guarda en la
-- ruta para que al editarla más tarde los Bukys no cambien de lugar. NULL = el valor general de
-- Configurações (buky_athlete_route_min_point_gap_m). Idempotente.
BEGIN;
ALTER TABLE public.buky_routes ADD COLUMN IF NOT EXISTS buky_every_m integer
  CHECK (buky_every_m IS NULL OR buky_every_m BETWEEN 50 AND 5000);
COMMIT;
