-- 0037 — scope the per-supplier item name dedupe to TOP-LEVEL CATALOGUE items.
--
-- items_org_name_uidx (0010/0015) was unique (org_id, lower(name)) across the
-- WHOLE items table. The build-up/estimate feature (pV2-BUILDUP-03) stores
-- components as items rows (parent_item_id set) and clones each one up to a
-- reusable library copy (parent_item_id null, type='component') with the SAME
-- name — so a child + its library clone, and any component sharing a catalogue
-- item's name, collided on this index (23505 on the very first save).
--
-- The dedupe only ever meant "one catalogue item per name per supplier", so we
-- narrow the predicate to parent_item_id IS NULL AND type <> 'component'.
-- Narrowing a partial unique index only RELAXES it, so it can't fail on existing
-- rows. Component uniqueness (the library clone) is enforced by the service's own
-- INSERT-dedupe, not by this index.
drop index if exists public.items_org_name_uidx;
create unique index items_org_name_uidx
  on public.items (org_id, lower(name))
  where deleted_at is null
    and parent_item_id is null
    and type is distinct from 'component';
