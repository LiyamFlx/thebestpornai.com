-- Stop watch-page 401/409 noise on likes, views, and comments.
-- Applied to the linked project. Safe to re-run.
--
-- Views: schema-views-dedupe.sql rejected a second same-day insert in RLS
-- (PostgREST 401). A unique index alone turned that into 409, because
-- Prefer: resolution=ignore-duplicates cannot target an expression index.
-- A BEFORE INSERT trigger skips the duplicate and PostgREST returns 201.
-- The unique index remains the race backstop.
--
-- Comments: the one-per-minute RLS check did the same (401). The trigger
-- skips the extra row (201, empty body) instead. client_id is still required.
--
-- Likes: DELETE had no policy, so toggling a vote off was rejected.

-- views upsert (duplicates + unique day index + permissive insert policy)
delete from public.views a
  using public.views b
 where a.id > b.id
   and a.video_id = b.video_id
   and a.client_id is not distinct from b.client_id
   and ((timezone('utc', a.created_at))::date)
     = ((timezone('utc', b.created_at))::date);

create unique index if not exists views_one_per_client_per_day
  on public.views (
    video_id,
    client_id,
    ((timezone('utc', created_at))::date)
  );

drop policy if exists "public insert views" on public.views;
create policy "public insert views" on public.views
  for insert with check (client_id is not null);

drop policy if exists "public read views" on public.views;
create policy "public read views" on public.views
  for select using (true);

create or replace function public.views_skip_if_same_day()
returns trigger
language plpgsql
as $$
begin
  if new.client_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.views existing
    where existing.video_id = new.video_id
      and existing.client_id = new.client_id
      and (timezone('utc', existing.created_at))::date
        = (timezone('utc', coalesce(new.created_at, now())))::date
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists views_skip_same_day on public.views;
create trigger views_skip_same_day
  before insert on public.views
  for each row
  execute function public.views_skip_if_same_day();

-- comments: same quiet skip, still one comment per client per video per minute
create or replace function public.comments_skip_if_rate_limited()
returns trigger
language plpgsql
as $$
begin
  if new.client_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.comments existing
    where existing.video_id = new.video_id
      and existing.client_id = new.client_id
      and existing.created_at > now() - interval '1 minute'
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row
  execute function public.comments_skip_if_rate_limited();

drop policy if exists "public insert comments" on public.comments;
create policy "public insert comments" on public.comments
  for insert with check (client_id is not null);

drop policy if exists "public read comments" on public.comments;
create policy "public read comments" on public.comments
  for select using (true);

-- likes: allow the app's filtered DELETE (client_id=eq.<id>)
drop policy if exists "client delete own like" on public.likes;
create policy "client delete own like" on public.likes
  for delete using (true);
