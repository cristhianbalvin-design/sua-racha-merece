-- Paso 33 (11/11/2026): fin de la transición del paso 31. match-face ya guarda las coincidencias, así que
-- para descargar una foto se exige que el sistema la haya reconocido para ese usuario (la inscripción en el
-- evento ya no basta). Decisión de 3buk: opción 1, aplicar desde ya. Re-ejecutable.
UPDATE public.app_settings
SET value = '1', updated_at = now()
WHERE key = 'photo_require_face_match';
