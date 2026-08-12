-- Apply in the Supabase SQL editor before deploying the onboarding-enabled API.
alter table public.profiles
  add column if not exists location_city text,
  add column if not exists location_region text,
  add column if not exists app_goals text[] not null default '{}',
  add column if not exists produce_interests text[] not null default '{}',
  add column if not exists onboarding_completed_at timestamptz;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;
