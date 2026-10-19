# Premium anual con Mercado Pago (R$ 50, pago único, tarjeta y Pix)

Funciones: `create-premium-checkout` y `sync-premium-payment` (verify_jwt activado) y `mercadopago-webhook` (`--no-verify-jwt`).
`sync-premium-payment` es el respaldo del webhook: Meus Créditos la llama al abrirse y verifica con Mercado Pago los pagos pendientes.
La activación vive en SQL: `payments` y `apply_premium_payment` (pasos 5 y 6 de la Fase 1, ya aplicados).

Secrets en Supabase (Edge Functions > Secrets): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y, opcional, `SITE_URL`.

Despliegue:
    supabase functions deploy create-premium-checkout --project-ref ljizlialjsonmmvppoqh
    supabase functions deploy sync-premium-payment --project-ref ljizlialjsonmmvppoqh
    supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref ljizlialjsonmmvppoqh

Webhook en el panel de Mercado Pago (evento "Pagos"):
    https://ljizlialjsonmmvppoqh.supabase.co/functions/v1/mercadopago-webhook

Reglas: renovar suma 12 meses desde el vencimiento; un reembolso/contracargo total cancela ese año de Premium
y retira los créditos no usados (SQL 14, revoke_premium_payment; los créditos ya gastados no se recuperan). El Premium incluye 100 créditos por pago (SQL 13, app_settings.premium_credits_grant).
