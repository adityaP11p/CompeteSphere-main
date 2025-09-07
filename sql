-- ===== Prep =====
create extension if not exists "pgcrypto";

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ===== PROFILES (links to auth.users) =====
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('student','organizer','mentor','recruiter')) default 'student',
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row execute function public.set_updated_at();

-- ===== COMPETITIONS =====
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  registration_deadline timestamptz,
  min_team_size int not null default 1,
  max_team_size int not null default 4,
  tier text not null default 'free',               -- free | pro | enterprise (derive from subscription later)
  entry_fee_cents int not null default 0 check (entry_fee_cents >= 0),
  currency text not null default 'INR',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- sanity checks
  check (min_team_size >= 1),
  check (max_team_size >= min_team_size)
);
drop trigger if exists trg_competitions_updated_at on competitions;
create trigger trg_competitions_updated_at
before update on competitions
for each row execute function public.set_updated_at();

-- Optional date sanity (allow nulls but if present must be ordered)
create or replace function public.check_competition_dates()
returns trigger language plpgsql as $$
begin
  if new.start_date is not null and new.end_date is not null and new.start_date > new.end_date then
    raise exception 'start_date must be <= end_date';
  end if;
  if new.registration_deadline is not null and new.start_date is not null
     and new.registration_deadline > new.start_date then
    raise exception 'registration_deadline must be <= start_date';
  end if;
  return new;
end$$;

drop trigger if exists trg_comp_dates_biu on competitions;
create trigger trg_comp_dates_biu
before insert or update on competitions
for each row execute function public.check_competition_dates();

-- ===== TEAMS =====
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  status text not null default 'forming',          -- forming | registered | disbanded
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(competition_id, name)
);
drop trigger if exists trg_teams_updated_at on teams;
create trigger trg_teams_updated_at
before update on teams
for each row execute function public.set_updated_at();

-- ===== TEAM MEMBERS =====
create table if not exists team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role_pref text,                                  -- dev | design | research | product ...
  joined_at timestamptz default now(),
  is_captain boolean default false,
  status text not null default 'pending',          -- pending | invited | accepted | left
  primary key (team_id, user_id)
);
create index if not exists idx_team_members_user on team_members(user_id);

-- Enforce: a user can be in at most ONE 'accepted' team per competition
create or replace function public.check_one_team_per_comp()
returns trigger language plpgsql as $$
declare comp_id uuid;
declare conflict_count int;
begin
  -- competition of the team being joined
  select competition_id into comp_id from teams where id = coalesce(new.team_id, old.team_id);

  if (new.status = 'accepted') then
    select count(*) into conflict_count
    from team_members tm
    join teams t on t.id = tm.team_id
    where tm.user_id = new.user_id
      and tm.status = 'accepted'
      and t.competition_id = comp_id
      and tm.team_id <> new.team_id;

    if conflict_count > 0 then
      raise exception 'User % is already accepted in another team for this competition', new.user_id;
    end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_one_team_per_comp_biu on team_members;
create trigger trg_one_team_per_comp_biu
before insert or update on team_members
for each row execute function public.check_one_team_per_comp();

-- ===== TEAM REGISTRATIONS (one per team per competition) =====
create table if not exists team_registrations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id uuid not null unique references teams(id) on delete cascade,
  status text not null default 'pending',          -- pending | approved | rejected
  registered_at timestamptz default now()
);
create unique index if not exists ux_team_competition on team_registrations(competition_id, team_id);

-- Ensure team belongs to the same competition
create or replace function check_team_competition_consistency()
returns trigger language plpgsql as $$
declare team_comp uuid;
begin
  select competition_id into team_comp from teams where id = NEW.team_id;
  if team_comp is null then
    raise exception 'Team % not found', NEW.team_id;
  end if;
  if team_comp <> NEW.competition_id then
    raise exception 'Team % belongs to a different competition', NEW.team_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_check_team_comp on team_registrations;
create trigger trg_check_team_comp
before insert or update on team_registrations
for each row execute function check_team_competition_consistency();

-- Enforce team size bounds at registration
create or replace function check_team_size_to_register()
returns trigger as $$
declare sz int; min_sz int; max_sz int;
begin
  select count(*) into sz from team_members where team_id = NEW.team_id and status = 'accepted';
  select min_team_size, max_team_size into min_sz, max_sz from competitions where id = NEW.competition_id;
  if sz < min_sz or sz > max_sz then
    raise exception 'Team size % not within [% - %] for this competition', sz, min_sz, max_sz;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_check_team_size on team_registrations;
create trigger trg_check_team_size
before insert on team_registrations
for each row execute function check_team_size_to_register();

-- Optional: auto-set team status when approved/rejected
create or replace function public.sync_team_status_on_registration()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' then
    update teams set status = 'registered' where id = new.team_id;
  elsif new.status = 'rejected' then
    update teams set status = 'forming' where id = new.team_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_sync_team_status on team_registrations;
create trigger trg_sync_team_status
after insert or update on team_registrations
for each row execute function public.sync_team_status_on_registration();

-- ===== SIMPLE TEAM CHAT =====
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);
create index if not exists idx_team_messages_team on team_messages(team_id, created_at);

-- Only accepted team members can post in their team
create or replace function public.check_sender_is_member()
returns trigger language plpgsql as $$
declare ok int;
begin
  select count(*) into ok
  from team_members
  where team_id = new.team_id
    and user_id = new.sender_id
    and status = 'accepted';
  if ok = 0 then
    raise exception 'Only accepted team members can send messages';
  end if;
  return new;
end$$;

drop trigger if exists trg_team_msg_guard on team_messages;
create trigger trg_team_msg_guard
before insert on team_messages
for each row execute function public.check_sender_is_member();

-- ===== MATCHING DATA =====
create table if not exists skills (
  id serial primary key,
  slug text unique not null
);

create table if not exists user_skills (
  user_id uuid references profiles(id) on delete cascade,
  skill_id int references skills(id) on delete cascade,
  level int check (level between 1 and 5),
  years numeric default 0,
  primary key (user_id, skill_id)
);
create index if not exists idx_user_skills_user on user_skills(user_id);

create table if not exists user_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  role_pref text,
  avail_hours_per_week int
);

create table if not exists team_needs (
  team_id uuid references teams(id) on delete cascade,
  needed_role text,
  needed_skills int[],
  primary key (team_id, needed_role)
);

create table if not exists team_match_suggestions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 1),
  premium_boost boolean default false,
  created_at timestamptz default now(),
  unique(team_id, user_id)
);
create index if not exists idx_match_suggestions_team on team_match_suggestions(team_id, score);

-- ===== LEARNING + STRIPE =====
create table if not exists creators (
  user_id uuid primary key references profiles(id) on delete cascade,
  display_name text,
  verified boolean default false,
  stripe_account_id text
);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(user_id) on delete cascade,
  type text not null check (type in ('course','mentorship')),
  title text not null,
  description text,
  price_cents int not null default 0 check (price_cents >= 0),
  currency text not null default 'INR',
  is_active boolean default true,
  media_type text default 'video',                 -- video/pdf/link/mixed
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_catalog_creator on catalog_items(creator_id);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references catalog_items(id) on delete cascade,
  title text not null,
  content_url text,
  index_in_course int,
  check (index_in_course is null or index_in_course >= 0),
  unique (item_id, index_in_course)
);

create table if not exists mentorship_slots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references catalog_items(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity int default 1 check (capacity > 0),
  seats_taken int default 0 check (seats_taken >= 0 and seats_taken <= capacity)
);
create index if not exists idx_slots_item on mentorship_slots(item_id, starts_at);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id) on delete cascade,
  item_id uuid references catalog_items(id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'INR',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  status text not null default 'requires_payment',   -- requires_payment | paid | refunded | failed | cancelled
  created_at timestamptz default now()
);
create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_intent on orders(stripe_payment_intent_id);

create table if not exists enrollments (
  buyer_id uuid references profiles(id) on delete cascade,
  item_id uuid references catalog_items(id) on delete cascade,
  granted_at timestamptz default now(),
  primary key (buyer_id, item_id)
);

-- Explicit bookings for mentorship slots
create table if not exists mentorship_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references mentorship_slots(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete cascade,
  status text not null default 'reserved',          -- reserved | confirmed | cancelled
  created_at timestamptz default now(),
  unique(slot_id, buyer_id)
);
create index if not exists idx_bookings_slot on mentorship_bookings(slot_id);

-- ===== SUBSCRIPTIONS =====
create table if not exists organizer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id) on delete cascade,
  stripe_subscription_id text,
  plan text not null check (plan in ('free','pro','enterprise')),
  status text not null default 'active',
  max_teams int not null default 20,
  created_at timestamptz default now(),
  expires_at timestamptz
);
create unique index if not exists ux_org_active_sub
  on organizer_subscriptions(organizer_id)
  where status = 'active';

create table if not exists student_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  stripe_subscription_id text,
  plan text not null check (plan in ('free','premium')),
  status text not null default 'active',
  created_at timestamptz default now(),
  expires_at timestamptz
);
create unique index if not exists ux_student_active_sub
  on student_subscriptions(student_id)
  where status = 'active';

-- ===== PRIZE DISTRIBUTIONS =====
create table if not exists prize_distributions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  member_id uuid references profiles(id) on delete cascade,
  share_percent numeric check (share_percent >= 0),
  payout_amount_cents int,
  currency text default 'INR',
  processed boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_prize_comp_team on prize_distributions(competition_id, team_id);

-- Prize info directly on competitions
alter table competitions
add column if not exists prize_pool_cents integer not null default 0 check (prize_pool_cents >= 0),
add column if not exists prize_currency text not null default 'INR',
add column if not exists prize_summary text;

create table if not exists competition_prizes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  rank_from int,               -- e.g. 1 for "Winner"
  rank_to   int,               -- e.g. 1 for "Winner", 3 for "Top 3"
  title     text not null,     -- "Winner", "Runner-up", "Best UI", etc.
  amount_cents int not null default 0 check (amount_cents >= 0),
  currency text not null default 'INR',
  perks jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_prizes_comp on competition_prizes(competition_id, sort_order);

create or replace function public.refresh_prize_pool()
returns trigger language plpgsql as $$
declare comp_id uuid;
begin
  comp_id := coalesce(new.competition_id, old.competition_id);
  update competitions c
     set prize_pool_cents = coalesce(
         (select sum(amount_cents)::int from competition_prizes p where p.competition_id = comp_id), 0)
   where c.id = comp_id;
  return null;
end$$;

drop trigger if exists trg_refresh_prize_pool_aiud on competition_prizes;
create trigger trg_refresh_prize_pool_aiud
after insert or update or delete on competition_prizes
for each row execute function public.refresh_prize_pool();

-- (Optional) RLS example only for prizes list
alter table competition_prizes enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'competition_prizes'
      and policyname = 'prizes_select_all'
  ) then
    create policy prizes_select_all
    on competition_prizes
    for select using (true);
  end if;
end$$;

create table if not exists join_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  desired_skills int[] not null,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Invitations from team -> user
create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text default 'pending', -- pending/accepted/rejected
  created_at timestamptz default now()
);

ALTER TABLE team_needs
ADD CONSTRAINT team_needs_team_id_key UNIQUE (team_id);

create table if not exists team_join_requests (
    id uuid primary key default gen_random_uuid(),

    team_id uuid not null references teams(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,

    status text check (status in ('pending','accepted','rejected')) default 'pending',

    requested_at timestamptz default now(),
    responded_at timestamptz
);
create index if not exists idx_team_join_requests_team_id on team_join_requests(team_id);

alter table team_invitations
add constraint unique_invite unique(team_id, user_id);


-- Enable row-level security
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT operations
CREATE POLICY objects_select_policy ON storage.objects FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy for INSERT operations WITH CHECK !
CREATE POLICY objects_insert_policy ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy for UPDATE operations
CREATE POLICY objects_update_policy ON storage.objects FOR UPDATE
USING (auth.role() = 'authenticated');

-- Policy for DELETE operations
CREATE POLICY objects_delete_policy ON storage.objects FOR DELETE
USING (auth.role() = 'authenticated');


create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  related_team_id uuid references teams(id) on delete cascade, -- optional context
  message text not null,
  created_at timestamptz default now()
);

create index if not exists idx_direct_messages_pair 
  on direct_messages (sender_id, recipient_id, created_at);
