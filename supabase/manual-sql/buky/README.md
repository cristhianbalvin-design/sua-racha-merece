# Buky dentro de 3BUK · Fase 1 (servidor y datos)

Scripts para correr **a mano en el SQL Editor de Supabase**, en orden y uno por vez. Cada uno va dentro de
`BEGIN … COMMIT` y es idempotente: si se corre dos veces no rompe ni duplica nada (lo comprueba `run.sh`).

| Paso | Archivo | Qué crea |
|---|---|---|
| 15 | `15_catalogo_ibge_y_perfil.sql` | Catálogo IBGE (27 estados y 5.571 ciudades), perfil del atleta con ciudad/estado por código, Instagram y barrio; vista previa y aplicación de la normalización de las ciudades escritas a mano |
| 16 | `16_buky_nucleo.sql` | Rutas oficiales y del atleta, puntos, entrenamientos, pasadas, libro de Bukys inmutable, saldos, bucket privado `buky-tracks`, parámetros `buky_*` en `app_settings` |
| 17 | `17_buky_sorteos.sql` | Patrocinadores, periodos de sorteo, cupones por alcance, envío del saldo, sorteo auditable, cancelación con devolución y tarea `pg_cron` `buky-raffle-tick` (cada 5 min) |
| 19 | `19_testadores_rutas.sql` | Testadores de rutas: el admin marca atletas que pueden crear rutas fuera de su ciudad (pruebas fuera de Brasil). Va siempre **después** del 16, porque reemplaza `buky_create_athlete_route` |
| 20 | `20_sorteios_atleta.sql` | `buky_my_raffles()`: pantalla Sorteios del atleta (atual, próximos, resultados anónimos por ciudad y mis premios) |
| 21 | `21_rutas_por_trazo.sql` | Rutas del atleta como trazo libre (`buky_routes.path`); los Bukys se ubican solos cada N m. Va **después** del 19 |
| 22 | `22_historico_recorridos.sql` | Cada atleta puede leer el recorrido GPS de sus propios entrenamientos (bucket `buky-tracks`) para el historial |

Después de los SQL se despliega la Edge Function (verify_jwt activado; no necesita secrets nuevos):

    supabase functions deploy buky-close-session --project-ref <ref del proyecto 3BUK>

## Después del paso 15: normalizar las ciudades existentes

Los usuarios actuales tienen la ciudad escrita a mano. Primero revisar, luego aplicar solo las coincidencias seguras:

    SELECT status, count(*) FROM public.buky_match_user_cities() GROUP BY status;   -- ok / ambigua / no_encontrada / sin_ciudad
    SELECT * FROM public.buky_match_user_cities() WHERE status <> 'ok';               -- casos para revisar a mano
    SELECT public.buky_apply_user_city_matches();                                     -- aplica solo las 'ok'

Quien quede sin ciudad la elige en la app (es obligatoria para enviar Bukys al sorteo).

## Reglas configurables (`app_settings`, sin desplegar)

| Clave | Valor inicial | Uso |
|---|---|---|
| `buky_speed_min_kmh` / `buky_speed_max_kmh` | 6 / 25 | Rango de velocidad para que una pasada cuente (**por confirmar con el cliente**) |
| `buky_vehicle_window_s` | 60 | Segundos seguidos sobre la máxima que anulan el entrenamiento |
| `buky_speed_window_s` | 30 | Ventana para medir la velocidad al cruzar un punto |
| `buky_max_accuracy_m` | 25 | Precisión GPS mínima aceptada |
| `buky_mock_max_ratio` | 0.05 | Proporción de lecturas con ubicación falsa que anula el entrenamiento |
| `buky_point_radius_default_m` | 50 | Radio de los puntos de las rutas del atleta |
| `buky_athlete_route_*` | 200 m, 1.000 m, 3–30 puntos, 10 rutas, 10 Bukys/día, 60 km | Límites de las rutas propias (opción C) |
| `buky_timezone` | America/Sao_Paulo | Define "por día" para los topes |

## Cómo funciona (resumen)

- **Entrenamiento**: la app llama `buky_start_session`, manda latidos con `buky_heartbeat` y al terminar sube el
  recorrido a la Edge Function `buky-close-session`. Esta recalcula las pasadas con el **mismo motor** de la app
  (`supabase/functions/_shared/buky/engine.ts`), aplica velocidad mínima/máxima, vehículo y ubicación falsa, guarda el
  recorrido comprimido y llama `buky_finalize_session`, que acredita los Bukys en un solo movimiento. Solo el servidor
  acredita; reintentar no duplica.
- **Rutas del atleta**: `buky_create_athlete_route` valida distancia entre puntos, largo mínimo y cercanía a su ciudad.
  Dan como máximo 1 Buky por punto por día y 10 Bukys por día en total.
- **Sorteos**: el atleta envía todo su saldo al periodo abierto (`buky_send_to_raffle`) y recibe un ticket. El admin
  carga los cupones antes de que empiece el periodo; después ya no se cambian las reglas. Al cerrar, el reloj sortea
  cupón por cupón con azar criptográfico, con ganadores distintos en el mismo periodo, guarda la lista de candidatos con
  su hash para auditoría, asigna el código de canje y avisa al ganador. Abre el siguiente periodo solo.
- **Admin**: `admin_buky_gift`, `admin_buky_invalidate_session`, `admin_buky_draw_period`, `admin_buky_cancel_period`; las
  tablas de configuración (rutas oficiales, patrocinadores, periodos, cupones, códigos) se editan con permisos de admin.

## Supuestos por confirmar con el cliente

1. Los Bukys enviados cuentan a la vez en **todos** los cupones de la zona del atleta (no se reparten).
2. Los Bukys enviados valen **solo para ese periodo**.
3. La zona del atleta es la ciudad de su perfil **en el momento del envío**.
4. Valores de velocidad mínima y máxima.

Cambiar 1–3 solo toca `buky_draw_period_internal` / `buky_send_to_raffle`; 4 es un valor en `app_settings`.

## Pruebas locales

    supabase/tests/buky/run.sh        # Postgres temporal que simula Supabase: pasos + pruebas + contrato + re-ejecución
    npx vitest run src/test/buky      # motor y evaluación del entrenamiento
    cd supabase/functions && deno test buky-close-session/

## Reversión

Los pasos 16 y 17 solo agregan objetos nuevos (`buky_*`). Antes del lanzamiento se revierten con
`DROP TABLE … CASCADE` de las tablas `buky_*`, `DROP FUNCTION` de las funciones `buky_*`/`admin_buky_*` y
`SELECT cron.unschedule('buky-raffle-tick')`. El paso 15 agrega columnas nuevas a `users` sin tocar las existentes.
