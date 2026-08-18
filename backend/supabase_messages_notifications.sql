create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, is_read);

create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  farmer_user_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint conversation_threads_unique_participants
    unique (farm_id, buyer_user_id, farmer_user_id),
  constraint conversation_threads_distinct_users
    check (buyer_user_id <> farmer_user_id)
);

create index if not exists conversation_threads_buyer_idx
  on public.conversation_threads (buyer_user_id, last_message_at desc, created_at desc);

create index if not exists conversation_threads_farmer_idx
  on public.conversation_threads (farmer_user_id, last_message_at desc, created_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create index if not exists conversation_messages_thread_created_idx
  on public.conversation_messages (thread_id, created_at asc);

create index if not exists conversation_messages_recipient_read_idx
  on public.conversation_messages (recipient_user_id, read_at, created_at desc);
