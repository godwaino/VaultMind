-- VaultMind — schema migration v1 (ARCHITECTURE §4.2)
-- Server holds METADATA and CIPHERTEXT ONLY. No document text, OCR output,
-- categories, expiry dates, or analysis results live here — those stay on-device
-- and inside opaque encrypted backups (data-minimisation, NFR-SEC-006).
--
-- Every table is RLS-protected to `user_id = auth.uid()`. Apply with:
--   supabase db push      (or)   supabase migration up

begin;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  phone_e164   text,
  mfa_method   text check (mfa_method in ('totp', 'sms')),
  ndpa_consents jsonb not null default '{}'::jsonb,   -- mirror of device consent state
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz                              -- soft-delete; purge job hard-deletes
);

-- ---------------------------------------------------------------------------
-- entitlements  (tier includes 'free' — backup is available on free per DECISIONS.md #1)
-- ---------------------------------------------------------------------------
create table public.entitlements (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  tier                  text not null default 'free'
                          check (tier in ('free', 'personal', 'family')),
  paystack_customer_id  text,
  paystack_sub_id       text,
  current_period_end    timestamptz,
  early_access_lock_until timestamptz,
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- usage_counters  (e.g. free-tier ContractScan 2/month — REQ-CONTRACT-012)
-- ---------------------------------------------------------------------------
create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric  text not null,         -- 'contractscan_analyses' | 'documents' | 'expiry_tracked'
  period  date not null,         -- month bucket (first of month)
  count   integer not null default 0,
  primary key (user_id, metric, period)
);

-- ---------------------------------------------------------------------------
-- backup_manifests  (pointers/versioning; NO plaintext doc metadata)
-- ---------------------------------------------------------------------------
create table public.backup_manifests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  version     integer not null,
  size_bytes  bigint not null default 0,
  client_meta jsonb not null default '{}'::jsonb,   -- opaque, set by client
  created_at  timestamptz not null default now()
);
create index backup_manifests_user_idx on public.backup_manifests (user_id, version desc);

-- ---------------------------------------------------------------------------
-- consent_events  (NDPA 2023 audit trail — append-only — NFR-SEC-011)
-- ---------------------------------------------------------------------------
create table public.consent_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  consent_key text not null,
  granted     boolean not null,
  at          timestamptz not null default now(),
  app_version text not null
);
create index consent_events_user_idx on public.consent_events (user_id, at desc);

-- ---------------------------------------------------------------------------
-- audit_log  (security events only — no document content)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event   text not null,
  at      timestamptz not null default now(),
  ip_hash text                                   -- hashed, never raw IP
);
create index audit_log_user_idx on public.audit_log (user_id, at desc);

-- ===========================================================================
-- Row Level Security: a user can only ever see/modify their own rows.
-- ===========================================================================
alter table public.profiles         enable row level security;
alter table public.entitlements     enable row level security;
alter table public.usage_counters   enable row level security;
alter table public.backup_manifests enable row level security;
alter table public.consent_events   enable row level security;
alter table public.audit_log        enable row level security;

-- profiles: owner can read + update own row (inserts handled server-side via service role)
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- entitlements: read-only to the owner (writes come from the Paystack webhook via service role)
create policy entitlements_select_own on public.entitlements
  for select using (auth.uid() = user_id);

-- usage_counters: owner may read; writes are server-side (service role) to prevent tampering
create policy usage_counters_select_own on public.usage_counters
  for select using (auth.uid() = user_id);

-- backup_manifests: owner full CRUD on own rows
create policy backup_manifests_all_own on public.backup_manifests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- consent_events: owner may read + append (append-only: no update/delete policy granted)
create policy consent_events_select_own on public.consent_events
  for select using (auth.uid() = user_id);
create policy consent_events_insert_own on public.consent_events
  for insert with check (auth.uid() = user_id);

-- audit_log: owner may read own security events; writes are server-side only
create policy audit_log_select_own on public.audit_log
  for select using (auth.uid() = user_id);

commit;
