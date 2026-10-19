# Fase 2 — SQL manual

| Paso | Archivo | Qué hace |
|------|---------|----------|
| 12 | `12_descarga_cupo_y_creditos.sql` | Cupo gratis Freemium (3 fotos / 3 meses) y cobro de créditos Premium (10 por foto) en `check_and_register_download`; nueva `get_my_download_status()`. |
| 13 | `13_premium_incluye_100_creditos.sql` | El Premium anual acredita 100 créditos por pago. |
| 14 | `14_premium_reembolso_automatico.sql` | Reembolso/contracargo: cancela el año de Premium y retira los créditos no usados. |

**Orden de despliegue:** primero el front (PR), después correr el paso 12 en el SQL Editor. El front ya entiende los motivos
`free_quota_exhausted` e `insufficient_credits`; con el SQL anterior simplemente no aparecen.

Parámetros editables sin desplegar (`app_settings`): `free_download_quota`, `free_download_window_months`, `photo_credit_cost`.

Nota: el bucket `event-photos` es público; cupo y cobro se aplican en el flujo de la app, no impiden abrir la URL directa de la imagen.
Cerrarlo del todo requiere URLs firmadas o previews con marca de agua.
