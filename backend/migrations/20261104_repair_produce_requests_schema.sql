-- Repairs databases where produce_requests was created before request_kind existed.
alter table public.produce_requests
  add column if not exists request_kind text;

update public.produce_requests
set request_kind = case
  when requested_variety is null then 'new_item'
  else 'new_variety'
end
where request_kind is null;

alter table public.produce_requests
  alter column request_kind set not null;

do $$
begin
  alter table public.produce_requests
    add constraint produce_requests_request_kind_check
    check (request_kind in ('new_item', 'new_variety'));
exception
  when duplicate_object then null;
end;
$$;
