create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('farm', 'produce', 'listing', 'recipe')),
  item_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context text not null check (context in ('home', 'produce', 'marketplace')),
  query text not null default '',
  filters jsonb not null default '{}'::jsonb,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_searches_identity_idx
  on public.saved_searches (user_id, context, query, (filters::text));
create index if not exists saved_items_user_created_idx on public.saved_items (user_id, created_at desc);
create index if not exists saved_searches_user_created_idx on public.saved_searches (user_id, created_at desc);

alter table public.saved_items enable row level security;
alter table public.saved_searches enable row level security;

create policy "Users manage their saved items" on public.saved_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their saved searches" on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_items to authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;
