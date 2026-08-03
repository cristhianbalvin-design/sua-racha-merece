BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.close_expired_campaigns()
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  updated_campaigns integer;
BEGIN
  UPDATE public.campaigns
  SET status = 'Concluído'
  WHERE status = 'Aberto'
    AND end_date < CURRENT_DATE;

  GET DIAGNOSTICS updated_campaigns = ROW_COUNT;
  RETURN updated_campaigns;
END;
$function$;

COMMENT ON FUNCTION public.close_expired_campaigns() IS
  'Closes campaigns whose end date has passed while leaving decided statuses unchanged.';

SELECT cron.schedule(
  'close-expired-campaigns',
  '5 3 * * *',
  $command$SELECT public.close_expired_campaigns();$command$
);

COMMIT;
