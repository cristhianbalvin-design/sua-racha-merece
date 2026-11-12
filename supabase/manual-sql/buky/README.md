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
| 23 | `23_rutas_oficiales_trazo.sql` | `buky_routes.buky_every_m`: distancia entre Bukys de cada ruta oficial dibujada por el admin |
| 24 | `24_recoleccion_bicicleta.sql` | 2 Bukys por punto y día con 3 min entre ellos (todas las rutas), ciudad de inicio del entrenamiento, límite de 1 h, avisos de bicicleta y bloqueo diario, `buky_my_status()` (progreso 200/300 de la Fase 1) |
| 25 | `25_sorteos_v2.sql` | Varios sorteos a la vez por ciudad o grupo, envío según la ubicación y con reglamento aceptado, % de descuento (de mayor a menor), ganador + suplente, mínimo de participantes con decisión del admin (sortear o unir), plazo de canje con paso al suplente y republicación |
| 26 | `26_ronda3_inicio.sql` | Ronda 3: tope de 12 Bukys por día (todas las rutas), bloqueo por bicicleta desde el 1.er corte (una sola vez), solo la app instalada inicia entrenamientos; ranking de la ciudad y ganadores de patrocinio para Início |
| 27 | `27_saldo_fotos_premium.sql` | Saldo en R$ (sin créditos): Premium acredita R$50, recargas de R$20/30/50, foto a R$10 del saldo con confirmación, fotos gratis por año (Premium 3, Freemium 1 con 300 Bukys), devoluciones (webhook y admin), aviso de vencimiento del Premium |
| 28 | `28_patrocinadores_avisos.sql` | Equipo de patrocinadores, canje y cola de avisos. Los premios son transaccionales y se envían aunque se desactiven los avisos por e-mail; los demás respetan la preferencia. |
| 29 | `29_reenvio_acceso.sql` | Límite atómico de tres reenvíos de acceso por correo y hora. |
| 30 | `30_entrega_e.sql` | Privacidad del ranking, contacto y contador de sorteos |
| 31 | `31_limites_ranking_fotos.sql` | Límites por plan, ranking mensual y CPF privado para descargas reconocidas |
| 32 | `32_marketplace.sql` | Tienda, reservas, pagos (saldo o Mercado Pago, pago tardío), envío con Melhor Envio y descuentos de marcas. Tienda apagada (`shop_enabled`). |
| 34 | `34_frete_a_combinar.sql` | Frete a combinar, cobro y recordatorios. |
| 35 | `35_activar_tienda.sql` | Abre la tienda una sola vez (frete a combinar); después se controla desde el admin. |
| 33 | `33_descargas_solo_reconocidas.sql` | Fin de la transición: solo se descargan fotos reconocidas para el usuario |

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
| `buky_vehicle_window_s` | 60 | Obsoleto desde el paso 24 (ya no anula el entrenamiento) |
| `buky_point_max_per_day` / `buky_point_min_gap_min` | 2 / 3 | Bukys por punto y día, y minutos entre ellos (paso 24) |
| `buky_session_max_min` | 60 | Duración máxima del entrenamiento (paso 24) |
| `buky_bike_speed_kmh` / `buky_bike_window_s` / `buky_bike_window_nosteps_s` | 25 / 30 / 60 | Aviso de bicicleta: velocidad y segundos seguidos sin pasos (o sin podómetro) |
| `buky_bike_warnings_to_stop` / `buky_bike_stops_to_block` | 3 / 2 | Avisos que cortan el entrenamiento; cortes en el día que bloquean hasta mañana |
| `buky_sponsorship_min_found` / `buky_free_photo_min_found` | 200 / 300 | Bukys recogidos corriendo para patrocinio y foto gratis (Fase 1) |
| `buky_raffle_min_participants` / `buky_redeem_days` | 30 / 15 | Valores iniciales de cada sorteo nuevo (paso 25) |
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

