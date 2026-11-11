-- short-video-editor: first migration (Supabase Postgres 15+).
-- Access rules: Postgres row level security on every table. The browser talks
-- to Supabase with the anon key + user JWT; service-role is used only inside
-- Edge Functions (Stripe webhook, export worker) and never ships to the client.
--
-- The timeline (tracks, clips, keyframes, captions) is one versioned JSON
-- document per project, not rows. Rationale in architecture.md ("Schema").

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: 1-1 with auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'creator', 'studio')),
  storage_quota_bytes bigint not null default 2147483648,   -- 2 GiB free
  storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;
create policy profiles_self_read on profiles for select using (id = auth.uid());
-- plan / quota columns are written only by the service role (Stripe webhook).
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
-- Column-level revoke cannot override a table-level grant, so grant narrowly instead.
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions: mirror of Stripe state, written only by the webhook
-- ---------------------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('free', 'creator', 'studio')),
  period text check (period in ('month', 'year')),
  status text not null check (status in
    ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  price_cents integer check (price_cents >= 0),
  currency text not null default 'usd',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();
alter table subscriptions enable row level security;
create policy subscriptions_self_read on subscriptions for select using (user_id = auth.uid());

-- Webhooks arrive more than once. Insert-or-skip on the event id.
create table stripe_events (
  id text primary key,                 -- Stripe evt_... id
  type text not null,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;   -- no policies: service role only

-- ---------------------------------------------------------------------------
-- projects: one row per edit; timeline is a versioned JSON document
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'Untitled' check (char_length(name) between 1 and 120),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9', '1:1', '4:5')),
  fps smallint not null default 30 check (fps in (24, 25, 30, 50, 60)),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  timeline jsonb not null default '{"schema":1,"tracks":[],"captions":[]}',
  timeline_version integer not null default 1,   -- optimistic concurrency for sync
  thumbnail_path text,                            -- storage key in bucket "thumbs"
  template_id uuid,
  deleted_at timestamptz,                         -- soft delete, purged after 30 days
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated on projects (user_id, updated_at desc) where deleted_at is null;
create index projects_template on projects (template_id);
create trigger projects_updated before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;
create policy projects_owner_all on projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Save with optimistic concurrency: fails (returns null) if someone else saved first.
create or replace function save_timeline(p_id uuid, p_expected_version integer, p_timeline jsonb, p_duration_ms integer)
returns integer language sql security invoker as $$
  update projects
     set timeline = p_timeline,
         duration_ms = p_duration_ms,
         timeline_version = timeline_version + 1
   where id = p_id and user_id = auth.uid() and timeline_version = p_expected_version
  returning timeline_version;
$$;

-- ---------------------------------------------------------------------------
-- assets: uploaded media (only when cloud sync is on; local-first otherwise)
-- ---------------------------------------------------------------------------
create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('video', 'image', 'audio')),
  filename text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 4294967296),  -- 4 GiB cap
  content_sha256 text not null,                 -- dedupe across projects
  duration_ms integer check (duration_ms >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  storage_path text not null unique,            -- bucket "media": {user_id}/{id}
  waveform_path text,                           -- bucket "derived"
  filmstrip_path text,                          -- bucket "derived"
  beat_bpm real check (beat_bpm between 60 and 200),
  beat_first_ms integer,
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_sha256)
);
create index assets_user_created on assets (user_id, created_at desc);
create trigger assets_updated before update on assets
  for each row execute function set_updated_at();
alter table assets enable row level security;
create policy assets_owner_all on assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep profiles.storage_used_bytes honest and enforce the quota in the database.
create or replace function track_storage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  delta bigint := coalesce(case when tg_op <> 'DELETE' then new.size_bytes end, 0)
                - coalesce(case when tg_op <> 'INSERT' then old.size_bytes end, 0);
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  update profiles
     set storage_used_bytes = storage_used_bytes + delta
   where id = uid
     and (delta <= 0 or storage_used_bytes + delta <= storage_quota_bytes);
  -- Only a growing upload can hit the quota. Shrinks/deletes must never fail
  -- (account deletion cascades here after the profile row is already gone).
  if not found and delta > 0 then
    raise exception 'storage quota exceeded' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger assets_storage after insert or delete or update of size_bytes on assets
  for each row execute function track_storage();

-- ---------------------------------------------------------------------------
-- export_jobs: server-side renders (4K, long videos, or no WebCodecs)
-- Browser exports never touch this table.
-- ---------------------------------------------------------------------------
create table export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  timeline_version integer not null,
  timeline_snapshot jsonb not null,              -- render exactly what was asked for
  width integer not null check (width between 144 and 3840),
  height integer not null check (height between 144 and 3840),
  fps smallint not null check (fps in (24, 25, 30, 50, 60)),
  format text not null default 'mp4' check (format in ('mp4', 'webm', 'mov')),
  burn_captions boolean not null default true,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  progress real not null default 0 check (progress between 0 and 1),
  attempts smallint not null default 0,
  locked_by text,                                -- worker id holding the job
  locked_at timestamptz,
  output_path text,                              -- bucket "exports", signed URL on read
  error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index export_jobs_queue on export_jobs (status, created_at) where status in ('queued', 'running');
create index export_jobs_user on export_jobs (user_id, created_at desc);
create index export_jobs_project on export_jobs (project_id);
create trigger export_jobs_updated before update on export_jobs
  for each row execute function set_updated_at();
alter table export_jobs enable row level security;
create policy export_jobs_owner_read on export_jobs for select using (user_id = auth.uid());
create policy export_jobs_owner_insert on export_jobs for insert
  with check (user_id = auth.uid() and status = 'queued');
create policy export_jobs_owner_cancel on export_jobs for update
  using (user_id = auth.uid() and status in ('queued', 'running'))
  with check (user_id = auth.uid() and status = 'canceled');

-- Worker claim: one job, skip rows other workers hold. Called with service role.
create or replace function claim_export_job(p_worker text) returns export_jobs
language sql as $$
  update export_jobs set status = 'running', locked_by = p_worker, locked_at = now(), attempts = attempts + 1
   where id = (
     select id from export_jobs
      where (status = 'queued')
         or (status = 'running' and locked_at < now() - interval '10 minutes' and attempts < 3)
      order by created_at
      for update skip locked
      limit 1)
  returning *;
$$;
revoke execute on function claim_export_job(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- templates: our own templates (never the original's library)
-- ---------------------------------------------------------------------------
create table templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  aspect_ratio text not null check (aspect_ratio in ('9:16', '16:9', '1:1', '4:5')),
  duration_ms integer not null check (duration_ms > 0),
  slot_count smallint not null check (slot_count between 1 and 30),
  timeline jsonb not null,                       -- slots marked {"slot": n, "min_ms": ...}
  preview_path text not null,
  min_plan text not null default 'free' check (min_plan in ('free', 'creator', 'studio')),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_browse on templates (published, category, sort_order);
create trigger templates_updated before update on templates
  for each row execute function set_updated_at();
alter table templates enable row level security;
create policy templates_public_read on templates for select using (published);

alter table projects add constraint projects_template_fk
  foreign key (template_id) references templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- storage buckets (private; access via RLS on storage.objects)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 4294967296),
       ('derived', 'derived', false, 52428800),
       ('thumbs', 'thumbs', false, 2097152),
       ('exports', 'exports', false, 4294967296)
on conflict (id) do nothing;

create policy storage_owner_rw on storage.objects for all
  using (bucket_id in ('media', 'derived', 'thumbs')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('media', 'derived', 'thumbs')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_exports_read on storage.objects for select
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
