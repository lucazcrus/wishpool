-- 2026-05-23 Price tracking pipeline
-- Adds currency + check telemetry to links, currency to history,
-- a recording RPC, and an AFTER INSERT trigger that creates alerts
-- and refreshes the price cache.

alter table public.links
  add column if not exists currency text not null default 'BRL',
  add column if not exists last_check_at timestamptz,
  add column if not exists last_check_status text;

alter table public.link_price_history
  add column if not exists currency text not null default 'BRL';

create index if not exists idx_links_last_check_at
  on public.links(last_check_at nulls first);

create index if not exists idx_link_price_history_link_currency_captured
  on public.link_price_history(link_id, currency, captured_at desc);

-- RPC: client-facing entry point. Idempotent under no-change inserts.
create or replace function public.record_price_snapshot(
  p_link_id uuid,
  p_price numeric,
  p_currency text,
  p_source text default 'manual'
) returns void
language plpgsql
security invoker
as $$
declare
  v_last_price numeric;
  v_user_id uuid;
  v_link_currency text;
begin
  select price, user_id, currency
    into v_last_price, v_user_id, v_link_currency
  from public.links
  where id = p_link_id and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'link not found or not owned';
  end if;

  if v_link_currency is distinct from p_currency then
    return; -- ignore snapshots in a different currency
  end if;

  if v_last_price is distinct from p_price then
    insert into public.link_price_history (link_id, user_id, price, currency, source)
    values (p_link_id, v_user_id, p_price, p_currency, p_source);
  end if;
end;
$$;

grant execute on function public.record_price_snapshot(uuid, numeric, text, text) to authenticated;

-- Trigger: creates a price_alert on price drop and refreshes links.price cache.
create or replace function public.handle_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous numeric;
begin
  select price into v_previous
  from public.link_price_history
  where link_id = new.link_id
    and currency = new.currency
    and id <> new.id
  order by captured_at desc
  limit 1;

  if v_previous is not null and new.price < v_previous then
    insert into public.price_alerts
      (link_id, user_id, previous_price, current_price, drop_amount)
    values
      (new.link_id, new.user_id, v_previous, new.price, v_previous - new.price);
  end if;

  update public.links
     set price = new.price
   where id = new.link_id;

  return new;
end;
$$;

drop trigger if exists on_link_price_snapshot on public.link_price_history;
create trigger on_link_price_snapshot
after insert on public.link_price_history
for each row execute function public.handle_price_snapshot();
