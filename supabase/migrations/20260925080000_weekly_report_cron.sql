-- Monday's email. pg_cron calls the weekly-report function through pg_net.
--
-- The shared secret is made here, inside the database, and never leaves it: the
-- cron job reads it from Vault to send, and the function asks
-- cron_secret_ok() to check. Nobody ever has to copy it anywhere.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'weekly_report_cron'
)
where not exists (select 1 from vault.secrets where name = 'weekly_report_cron');

create or replace function public.cron_secret_ok(p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'weekly_report_cron' and decrypted_secret = p_secret
  )
$$;
revoke execute on function public.cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text) to service_role;

-- ponytail: 06:00 UTC is 07:00 in winter and 08:00 in summer in Maastricht.
-- Run hourly with an Amsterdam-hour check in the function if the hour matters.
select cron.schedule(
  'weekly-report',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := 'https://tpxazvmtzwvqddgqckry.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_report_cron')
    ),
    body := '{}'::jsonb
  )
  $$
);
