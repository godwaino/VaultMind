-- VaultMind — schema v3: atomic usage increment + erasure purge queue.
-- Supports the real backend adapters (ContractScan usage metering, account erasure).

begin;

-- Atomic monthly usage increment (REQ-CONTRACT-012). Avoids read-modify-write races.
create or replace function public.increment_usage_counter(p_user uuid, p_metric text, p_period date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_counters (user_id, metric, period, count)
  values (p_user, p_metric, p_period, 1)
  on conflict (user_id, metric, period)
  do update set count = public.usage_counters.count + 1;
$$;

-- Erasure purge queue (NFR-SEC-007). A Vercel cron worker drains due rows:
--   kind 'rows'  -> hard-delete the user's DB rows (≤24h)
--   kind 'blobs' -> delete the user's backup objects from storage (≤72h)
create table public.purge_jobs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null,
  kind      text not null check (kind in ('rows', 'blobs')),
  due_at    timestamptz not null,
  done_at   timestamptz,
  created_at timestamptz not null default now()
);
create index purge_jobs_due_idx on public.purge_jobs (due_at) where done_at is null;

-- Service-role only: RLS on, no user policies (the service role bypasses RLS).
alter table public.purge_jobs enable row level security;

commit;
