-- Harden public.profiles for the /api/auth/register flow.
-- 0001_init.sql created the table; the register endpoint relies on email being
-- unique (to surface DuplicateEmailError) and phone_e164 being NOT NULL.
-- Also seeds the row-level read policy so authenticated users can read their
-- own profile (writes stay service-role only).

begin;

alter table public.profiles
  alter column phone_e164 set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_email_key'
  ) then
    alter table public.profiles add constraint profiles_email_key unique (email);
  end if;
end$$;

alter table public.profiles enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles
  for select using (auth.uid() = user_id);

commit;
