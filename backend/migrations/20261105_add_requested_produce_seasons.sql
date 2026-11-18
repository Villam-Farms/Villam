alter table public.produce_requests
  add column if not exists requested_season_months integer[] not null default '{}';

alter table public.produce_requests
  drop constraint if exists produce_requests_requested_season_months_check;

alter table public.produce_requests
  add constraint produce_requests_requested_season_months_check
  check (
    requested_season_months <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::integer[]
  );
