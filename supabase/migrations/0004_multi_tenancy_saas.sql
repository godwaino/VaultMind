-- VaultMind — schema migration v4: Multi-tenancy & SaaS billing
-- Adds organizations, workspaces, memberships, RBAC, and enterprise billing
-- to support the SaaS transformation (individual + enterprise tiers).
--
-- Apply with:  supabase db push  (or)  supabase migration up

begin;

-- ---------------------------------------------------------------------------
-- organizations  (enterprise multi-tenancy)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  logo_url     text,
  owner_id     uuid not null references auth.users (id) on delete restrict,
  tier         text not null default 'professional'
                 check (tier in ('professional', 'enterprise')),
  settings     jsonb not null default '{}'::jsonb,
  sso_provider text check (sso_provider in ('saml', 'oidc', null)),
  sso_config   jsonb,
  data_region  text default 'ng' check (data_region in ('ng', 'za', 'ke', 'gh', 'eu', 'us')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index organizations_slug_idx on public.organizations (slug);

-- ---------------------------------------------------------------------------
-- organization_members  (RBAC membership)
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  invited_by  uuid references auth.users (id) on delete set null,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  unique (org_id, user_id)
);
create index org_members_org_idx on public.organization_members (org_id);
create index org_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- workspaces  (team document vaults within an org)
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  description text,
  created_by  uuid not null references auth.users (id) on delete set null,
  is_default  boolean not null default false,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index workspaces_org_idx on public.workspaces (org_id);

-- ---------------------------------------------------------------------------
-- workspace_members  (access control per workspace)
-- ---------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member'
                 check (role in ('admin', 'editor', 'viewer')),
  added_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- subscriptions  (SaaS billing)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users (id) on delete cascade,
  org_id                   uuid references public.organizations (id) on delete cascade,
  plan_id                  text not null,
  tier                     text not null check (tier in ('free', 'personal', 'professional', 'enterprise')),
  billing_cycle            text not null default 'monthly'
                             check (billing_cycle in ('monthly', 'annual')),
  status                   text not null default 'active'
                             check (status in ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  currency                 text not null default 'NGN'
                             check (currency in ('NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'ZAR')),
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz not null,
  trial_end                timestamptz,
  payment_provider         text not null default 'paystack'
                             check (payment_provider in ('paystack', 'stripe')),
  external_subscription_id text,
  external_customer_id     text,
  created_at               timestamptz not null default now(),
  canceled_at              timestamptz,
  check (user_id is not null or org_id is not null)
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_org_idx on public.subscriptions (org_id);

-- ---------------------------------------------------------------------------
-- invoices  (billing history)
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users (id) on delete set null,
  org_id               uuid references public.organizations (id) on delete set null,
  subscription_id      uuid references public.subscriptions (id) on delete set null,
  amount               integer not null,
  currency             text not null default 'NGN',
  status               text not null default 'draft'
                         check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  period_start         timestamptz not null,
  period_end           timestamptz not null,
  paid_at              timestamptz,
  external_invoice_id  text,
  created_at           timestamptz not null default now()
);
create index invoices_user_idx on public.invoices (user_id);
create index invoices_org_idx on public.invoices (org_id);

-- ---------------------------------------------------------------------------
-- retention_policies  (enterprise records management)
-- ---------------------------------------------------------------------------
create table public.retention_policies (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid references public.organizations (id) on delete cascade,
  name                 text not null,
  description          text,
  category_pattern     text,
  retention_days       integer not null,
  disposition_action   text not null default 'review'
                         check (disposition_action in ('archive', 'delete', 'review')),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index retention_policies_org_idx on public.retention_policies (org_id);

-- ---------------------------------------------------------------------------
-- legal_holds  (litigation/compliance holds)
-- ---------------------------------------------------------------------------
create table public.legal_holds (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  matter      text not null,
  hold_type   text not null default 'litigation'
                check (hold_type in ('litigation', 'regulatory', 'investigation')),
  scope       jsonb not null default '[]'::jsonb,
  is_active   boolean not null default true,
  created_by  uuid not null references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  released_at timestamptz
);
create index legal_holds_org_idx on public.legal_holds (org_id);

-- ===========================================================================
-- Alter entitlements to support the new tiers
-- ===========================================================================
alter table public.entitlements
  drop constraint if exists entitlements_tier_check;
alter table public.entitlements
  add constraint entitlements_tier_check
    check (tier in ('free', 'personal', 'professional', 'enterprise'));
alter table public.entitlements
  add column if not exists org_id uuid references public.organizations (id) on delete set null;

-- ===========================================================================
-- Row Level Security for new tables
-- ===========================================================================
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.workspaces              enable row level security;
alter table public.workspace_members       enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.invoices                enable row level security;
alter table public.retention_policies      enable row level security;
alter table public.legal_holds             enable row level security;

-- Organizations: members can read their own org
create policy organizations_select_member on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = id and m.user_id = auth.uid() and m.left_at is null
    )
  );

create policy organizations_update_admin on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin') and m.left_at is null
    )
  );

create policy org_members_select on public.organization_members
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_id and m.user_id = auth.uid() and m.left_at is null
    )
  );

create policy workspaces_select on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid()
        and om.role in ('owner', 'admin') and om.left_at is null
    )
  );

create policy subscriptions_select_own on public.subscriptions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin') and m.left_at is null
    )
  );

create policy invoices_select_own on public.invoices
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin') and m.left_at is null
    )
  );

create policy retention_policies_select on public.retention_policies
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_id and m.user_id = auth.uid() and m.left_at is null
    )
  );

create policy legal_holds_select_admin on public.legal_holds
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'manager') and m.left_at is null
    )
  );

commit;
