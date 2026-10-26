-- Rebuild migration 0022 — MESSAGING / ENGAGEMENT CLUSTER, Stage 3 (Inbox).
-- The locked design (DATA-MODEL-REDESIGN §"Messaging / engagement cluster"). Messaging
-- is a general org<->org comms layer (not a project feature): party-anchored, two-party.
-- Five tables + the vw_project_provider read view + the deferred project_item_quotes FK.
--
-- Conventions (match 0018/0020): status is TEXT governed by a reference codelist,
-- validated app-side (NOT a DB CHECK). Audit columns. RLS forced. message_events is
-- APPEND-ONLY (select+insert grants only — no update/delete). Nuanced per-line approval
-- state (approved_both / awaiting_<side> / needs_reapproval, derived from event ordering)
-- is APP/port logic, not baked here; vw_project_provider gives the inbox-home live status.

-- ═══════════════════════════════════════════════════════════════════════════
-- project_providers — the engagement spine (one row per supplier the agency has
-- engaged on a project). status is WHOLESALE only (pending/booked/cancelled);
-- negotiating/agreed are DERIVED from the quotes (see vw_project_provider).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_providers (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs(id),               -- the OWNING agency (sacred)
  project_id       uuid not null references public.projects(id) on delete cascade,
  provider_org_id  uuid not null references public.orgs(id),               -- supplier OR agent-as-provider
  status           text not null default 'pending',                        -- provider_status codelist (wholesale)
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
-- UNIQUE(project, provider) — reused on re-engagement (revive the soft-deleted row).
create unique index project_providers_proj_provider_uidx
  on public.project_providers (project_id, provider_org_id) where deleted_at is null;
create index project_providers_project_idx  on public.project_providers (project_id) where deleted_at is null;
create index project_providers_provider_idx on public.project_providers (provider_org_id) where deleted_at is null;

alter table public.project_providers enable row level security;
alter table public.project_providers force row level security;
-- READ: the owning agency OR the engaged provider (sees the project in their inbox) OR admin.
create policy project_providers_read on public.project_providers for select
  using (org_id = public.app_current_org() or provider_org_id = public.app_current_org() or public.app_is_admin());
-- WRITE: the agency manages the engagement (provider interaction happens via messages).
create policy project_providers_insert on public.project_providers for insert
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy project_providers_update on public.project_providers for update
  using      (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy project_providers_delete on public.project_providers for delete
  using (org_id = public.app_current_org() or public.app_is_admin());
grant select, insert, update, delete on public.project_providers to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- messages — party-anchored, TWO-PARTY (the one place with two org FKs). body is
-- NULLABLE: a bodyless message is an *action* (e.g. a bare Accept) rendered as a
-- timeline action line, not a chat bubble. Access = members of from_org OR to_org.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  from_org_id    uuid not null references public.orgs(id),
  to_org_id      uuid not null references public.orgs(id),
  user_id        uuid references public.users(id),                         -- sender (person)
  project_id     uuid references public.projects(id) on delete cascade,    -- nullable context
  subject        text,
  body           text,                                                     -- NULL = an action, not a bubble
  status         text,                                                     -- message_status codelist
  next_action_by uuid references public.orgs(id),                          -- which side acts next
  token          text,                                                     -- public /brief credential (BE-00115)
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create index messages_project_idx on public.messages (project_id) where deleted_at is null;
create index messages_pair_idx    on public.messages (from_org_id, to_org_id) where deleted_at is null;

alter table public.messages enable row level security;
alter table public.messages force row level security;
-- Two-party: the caller's active org must be a party (from or to).
create policy messages_read on public.messages for select
  using (public.app_current_org() in (from_org_id, to_org_id) or public.app_is_admin());
create policy messages_insert on public.messages for insert
  with check (from_org_id = public.app_current_org() or public.app_is_admin());   -- you send FROM your org
create policy messages_update on public.messages for update
  using      (public.app_current_org() in (from_org_id, to_org_id) or public.app_is_admin())
  with check (public.app_current_org() in (from_org_id, to_org_id) or public.app_is_admin());
create policy messages_delete on public.messages for delete
  using (public.app_is_admin());                                           -- messages aren't user-deleted
grant select, insert, update, delete on public.messages to web_app_user;
-- The two parties are fixed at send. messages_update's WITH CHECK only requires
-- the caller to STAY a party, so without this a party could reassign the OTHER
-- side (e.g. agency repoints to_org_id to a different supplier). RLS can't compare
-- old vs new, so a trigger pins both party columns immutable. (audit L1)
create or replace function public.messages_pin_parties() returns trigger
  language plpgsql as $$
  begin
    if new.from_org_id is distinct from old.from_org_id
       or new.to_org_id is distinct from old.to_org_id then
      raise exception 'messages.from_org_id / to_org_id are immutable';
    end if;
    return new;
  end;
  $$;
drop trigger if exists messages_pin_parties_trg on public.messages;
create trigger messages_pin_parties_trg before update on public.messages
  for each row execute function public.messages_pin_parties();

-- ═══════════════════════════════════════════════════════════════════════════
-- message_reads — per-USER read (the inbox is org-shared, so read is per person).
-- Foundation for the parked read-receipts.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.users(id),
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reads enable row level security;
alter table public.message_reads force row level security;
-- A user touches only their OWN read-rows, and only for messages they can see.
create policy message_reads_all on public.message_reads for all
  using      (user_id = public.app_current_user_id()
              and exists (select 1 from public.messages m where m.id = message_id
                           and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())))
  with check (user_id = public.app_current_user_id()
              and exists (select 1 from public.messages m where m.id = message_id
                           and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())));
grant select, insert, update, delete on public.message_reads to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- message_relations — what a message is ABOUT (0..N). Exactly ONE of
-- project_item_id / project_category_id / document_id per row. 0 rows = a general
-- message (context from messages.project_id). Immutable link. document_id is a
-- FORWARD reference (project_documents is S4/DRAFT) — nullable uuid, NO FK yet.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.message_relations (
  id                  uuid primary key default gen_random_uuid(),
  message_id          uuid not null references public.messages(id) on delete cascade,
  project_item_id     uuid references public.project_items(id) on delete cascade,
  project_category_id uuid references public.project_categories(id) on delete cascade,
  document_id         uuid,                                                -- forward FK (S4); no FK yet
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  constraint message_relations_one_target
    check (num_nonnulls(project_item_id, project_category_id, document_id) = 1)
);
create index message_relations_message_idx on public.message_relations (message_id);
create index message_relations_item_idx     on public.message_relations (project_item_id) where project_item_id is not null;

alter table public.message_relations enable row level security;
alter table public.message_relations force row level security;
create policy message_relations_all on public.message_relations for all
  using      (exists (select 1 from public.messages m where m.id = message_id
                       and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())))
  with check (exists (select 1 from public.messages m where m.id = message_id
                       and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())));
grant select, insert, update, delete on public.message_relations to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- message_events — APPEND-ONLY state journal. Always about an item/doc (both FKs
-- NOT NULL). Resulting-STATE only (no before/from — the prior event / frozen
-- project_items row is the baseline). One event per (message × relation).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.message_events (
  id                  uuid primary key default gen_random_uuid(),
  message_id          uuid not null references public.messages(id) on delete cascade,
  message_relation_id uuid not null references public.message_relations(id) on delete cascade,
  status              text,                                                -- the item's/doc's resulting status
  price_current       numeric,                                            -- per-unit (NULL in a pure flat deal)
  price_override      numeric,                                            -- effective LINE TOTAL (always set)
  changes             jsonb not null default '{}'::jsonb,                 -- other evolved fields {field: new_value}
  reason_code         text,
  note                text,
  created_at timestamptz not null default now(), created_by uuid references public.users(id)
  -- append-only: NO updated_at / deleted_at
);
create unique index message_events_msg_relation_uidx on public.message_events (message_id, message_relation_id);
create index message_events_relation_idx on public.message_events (message_relation_id);

alter table public.message_events enable row level security;
alter table public.message_events force row level security;
create policy message_events_read on public.message_events for select
  using (exists (select 1 from public.messages m where m.id = message_id
                  and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())));
create policy message_events_insert on public.message_events for insert
  with check (exists (select 1 from public.messages m where m.id = message_id
                       and (public.app_current_org() in (m.from_org_id, m.to_org_id) or public.app_is_admin())));
-- APPEND-ONLY: no update/delete policy or grant.
grant select, insert on public.message_events to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- Deferred FK from S2: project_item_quotes.project_provider_id now has its target.
-- (0020 left it a plain nullable uuid because project_providers didn't exist yet.)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.project_item_quotes
  add constraint project_item_quotes_provider_fk
  foreign key (project_provider_id) references public.project_providers(id) on delete cascade;

-- ═══════════════════════════════════════════════════════════════════════════
-- vw_project_provider — the inbox-home read (ADR-0002: security_invoker view runs
-- under caller RLS). Live status derives from the quotes with a fallback to the
-- stored wholesale status; provider display (name/logo/city) via supplier_directory
-- (owner-run, bypasses orgs RLS). The nuanced per-LINE approval state is app logic.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view public.vw_project_provider with (security_invoker = true) as
  select pp.id, pp.org_id, pp.project_id, pp.provider_org_id,
         pp.status as stored_status,
         case
           when pp.status in ('cancelled', 'booked') then pp.status
           when exists (select 1 from public.project_item_quotes q
                         where q.project_provider_id = pp.id and q.deleted_at is null) then 'negotiating'
           else pp.status
         end as live_status,
         sd.name as provider_name, sd.logo_url as provider_logo, sd.city as provider_city,
         pp.created_at, pp.updated_at
    from public.project_providers pp
    left join public.supplier_directory sd on sd.id = pp.provider_org_id
   where pp.deleted_at is null;
grant select on public.vw_project_provider to web_app_user;
