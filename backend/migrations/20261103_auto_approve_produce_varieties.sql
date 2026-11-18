alter table public.produce_requests
  add column if not exists requested_produce_item_id uuid
  references public.produce_items(id) on delete set null;

create index if not exists produce_requests_requested_produce_item_id_idx
  on public.produce_requests (requested_produce_item_id);

create or replace function public.approve_requested_produce_variety(
  p_farm_id uuid,
  p_produce_item_id uuid,
  p_variety_name text,
  p_default_sold_by text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_produce_name text;
  v_variety_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in is required.';
  end if;

  if char_length(trim(coalesce(p_variety_name, ''))) = 0 then
    raise exception 'A variety name is required.';
  end if;

  if not exists (
    select 1 from public.farms
    where id = p_farm_id and user_id = v_user_id
  ) then
    raise exception 'You can only add varieties for your own farm.';
  end if;

  select name into v_produce_name
  from public.produce_items
  where id = p_produce_item_id;

  if v_produce_name is null then
    raise exception 'The selected produce item no longer exists.';
  end if;

  select id into v_variety_id
  from public.produce_varieties
  where produce_item_id = p_produce_item_id
    and lower(trim(name)) = lower(trim(p_variety_name))
  limit 1;

  if v_variety_id is null then
    insert into public.produce_varieties (produce_item_id, name)
    values (p_produce_item_id, trim(p_variety_name))
    returning id into v_variety_id;
  end if;

  insert into public.produce_requests (
    user_id,
    farm_id,
    request_kind,
    requested_produce_item_id,
    requested_name,
    requested_variety,
    default_sold_by,
    status,
    approved_produce_item_id,
    approved_produce_variety_id,
    review_note
  ) values (
    v_user_id,
    p_farm_id,
    'new_variety',
    p_produce_item_id,
    v_produce_name,
    trim(p_variety_name),
    p_default_sold_by,
    'approved',
    p_produce_item_id,
    v_variety_id,
    'Automatically approved while variety moderation is unavailable.'
  );

  return v_variety_id;
end;
$$;

grant execute on function public.approve_requested_produce_variety(uuid, uuid, text, text)
  to authenticated;
