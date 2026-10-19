# Premium anual con Mercado Pago (R$ 50, pago único, tarjeta y Pix)

Funciones: `create-premium-checkout` (verify_jwt activado) y `mercadopago-webhook` (`--no-verify-jwt`).
La activación vive en SQL: `payments` y `apply_premium_payment` (pasos 5 y 6 de la Fase 1, ya aplicados).

Secrets en Supabase (Edge Functions > Secrets): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y, opcional, `SITE_URL`.

Despliegue:
    supabase functions deploy create-premium-checkout --project-ref ljizlialjsonmmvppoqh
    supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref ljizlialjsonmmvppoqh

Webhook en el panel de Mercado Pago (evento "Pagos"):
    https://ljizlialjsonmmvppoqh.supabase.co/functions/v1/mercadopago-webhook

Reglas: renovar suma 12 meses desde el vencimiento; reembolsos/contracargos se registran pero no
quitan el Premium solos. El Premium incluye 100 créditos por pago (SQL 13, app_settings.premium_credits_grant).
