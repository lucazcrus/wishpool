-- 2026-05-23 Price tracking cron schedule
-- Enables pg_cron + pg_net and schedules a daily job that calls
-- the refresh-stale-prices Edge Function via HTTP. Requires that
-- app.settings.functions_url and app.settings.service_role_key are
-- already set at the database level (see deployment notes).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Wrap the HTTP call in a function so the cron command stays readable.
create or replace function public.cron_refresh_stale_prices()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.settings.functions_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
begin
  if v_url is null or v_key is null then
    raise notice 'cron_refresh_stale_prices: missing app.settings; skipping';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/refresh-stale-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Schedule at 04:00 UTC daily. Use replace-or-insert pattern.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-stale-prices') then
    perform cron.unschedule('refresh-stale-prices');
  end if;
  perform cron.schedule(
    'refresh-stale-prices',
    '0 4 * * *',
    $cron$ select public.cron_refresh_stale_prices(); $cron$
  );
end $$;
