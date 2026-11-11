-- Rebuild migration 0036 — pV2-BUILDUP-03: per-component quantity on items.
-- Build-up components are stored as child items (parent_item_id); the estimate /
-- cost build-up panel needs to persist each component's quantity, including
-- fractions (e.g. 0.5 chef-days). Additive + NULLABLE (null = 1 by convention at
-- read); numeric so fractions round-trip. No backfill needed — existing rows read
-- as 1. Idempotent.
alter table public.items add column if not exists quantity numeric;
