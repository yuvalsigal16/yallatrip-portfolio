-- Trip checklist (packing / to-do) and trip budget & expenses.
-- Everyone who plans the trip (owner + accepted partners) can read and change them; nobody else.

-- ---------- checklist ----------
create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  done boolean not null default false,
  position int not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_checklist_items_trip on public.trip_checklist_items (trip_id, position);
alter table public.trip_checklist_items enable row level security;

create policy checklist_select on public.trip_checklist_items for select to authenticated using (public.can_edit_trip(trip_id));
create policy checklist_insert on public.trip_checklist_items for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy checklist_update on public.trip_checklist_items for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy checklist_delete on public.trip_checklist_items for delete to authenticated using (public.can_edit_trip(trip_id));

create trigger trip_checklist_items_updated_at before update on public.trip_checklist_items
  for each row execute function public.set_updated_at();
create trigger trip_checklist_items_touch_trip after insert or delete or update on public.trip_checklist_items
  for each row execute function public.touch_trip();

-- ---------- budget ----------
create table if not exists public.trip_budgets (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  home_currency text not null default 'ILS' check (home_currency ~ '^[A-Z]{3}$'),
  total numeric(12,2) check (total is null or total >= 0),
  updated_at timestamptz not null default now()
);
alter table public.trip_budgets enable row level security;
create policy budgets_select on public.trip_budgets for select to authenticated using (public.can_edit_trip(trip_id));
create policy budgets_insert on public.trip_budgets for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy budgets_update on public.trip_budgets for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create trigger trip_budgets_updated_at before update on public.trip_budgets
  for each row execute function public.set_updated_at();

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null default 'other'
    check (category in ('lodging','food','transport','flights','attractions','shopping','other')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rate numeric(14,6) not null default 1 check (rate > 0),          -- 1 unit of currency in the trip's home currency
  home_amount numeric(14,2) generated always as (round(amount * rate, 2)) stored,
  paid_by uuid references public.profiles(id) on delete set null,
  shared boolean not null default true,                              -- split equally between everyone in the trip
  spent_on date not null default current_date,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists trip_expenses_trip on public.trip_expenses (trip_id, spent_on desc, created_at desc);
alter table public.trip_expenses enable row level security;
create policy expenses_select on public.trip_expenses for select to authenticated using (public.can_edit_trip(trip_id));
create policy expenses_insert on public.trip_expenses for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy expenses_update on public.trip_expenses for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy expenses_delete on public.trip_expenses for delete to authenticated using (public.can_edit_trip(trip_id));
create trigger trip_expenses_touch_trip after insert or delete or update on public.trip_expenses
  for each row execute function public.touch_trip();

-- Who paid must be someone in the trip (the owner or an accepted partner).
create or replace function public.trip_expenses_check_payer()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.paid_by is not null and not (
       exists (select 1 from public.trips where id = new.trip_id and owner_id = new.paid_by)
    or exists (select 1 from public.trip_members where trip_id = new.trip_id and user_id = new.paid_by and status = 'accepted')
  ) then
    raise exception 'payer is not in this trip' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.trip_expenses_check_payer() from public, anon, authenticated;
create trigger trip_expenses_check_payer before insert or update of paid_by, trip_id on public.trip_expenses
  for each row execute function public.trip_expenses_check_payer();

-- ---------- duplicate: the copy also gets the checklist (all unticked) and the budget plan, not the expenses ----------
create or replace function public.duplicate_trip(p_trip uuid, p_title text default null, p_start date default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  src public.trips%rowtype;
  v_new uuid;
  v_title text;
  shift int := 0;
  n_days int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into src from public.trips where id = p_trip;
  if not found or src.is_snapshot or not public.can_edit_trip(p_trip) then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  v_title := left(coalesce(nullif(btrim(p_title), ''), src.title || ' – עותק'), 120);
  v_new := public.copy_trip_internal(p_trip, uid, v_title);

  update public.trips
     set with_kids = src.with_kids,
         destinations = src.destinations
   where id = v_new;

  insert into public.trip_checklist_items (trip_id, text, done, position, created_by)
  select v_new, text, false, position, uid from public.trip_checklist_items where trip_id = p_trip;

  insert into public.trip_budgets (trip_id, home_currency, total)
  select v_new, home_currency, total from public.trip_budgets where trip_id = p_trip;

  if p_start is not null then
    if src.start_date is not null then
      shift := p_start - src.start_date;
      update public.trips
         set start_date = p_start,
             end_date = src.end_date + shift,
             destinations = case
               when jsonb_typeof(src.destinations) = 'array' then (
                 select coalesce(jsonb_agg(
                   case when (leg ? 'start') and (leg ? 'end')
                          and (leg->>'start') ~ '^\d{4}-\d{2}-\d{2}$' and (leg->>'end') ~ '^\d{4}-\d{2}-\d{2}$'
                        then leg || jsonb_build_object('start', to_char((leg->>'start')::date + shift, 'YYYY-MM-DD'),
                                                       'end', to_char((leg->>'end')::date + shift, 'YYYY-MM-DD'))
                        else leg end
                   order by ord), '[]'::jsonb)
                 from jsonb_array_elements(src.destinations) with ordinality as e(leg, ord))
               else src.destinations end
       where id = v_new;
    else
      select count(*) into n_days from public.trip_days where trip_id = v_new;
      if n_days > 0 then
        update public.trips set start_date = p_start, end_date = p_start + (n_days - 1) where id = v_new;
      end if;
    end if;
  end if;

  return v_new;
end $$;

revoke all on function public.duplicate_trip(uuid, text, date) from public, anon;
grant execute on function public.duplicate_trip(uuid, text, date) to authenticated;
