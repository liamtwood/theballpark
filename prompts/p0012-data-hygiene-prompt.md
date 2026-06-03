# CC Prompt — p0012 — Data hygiene (subject prefix · uniqueness · item display ref)

Three small fixes that travel well together — all touch the items / messages data shape and the inbox-row / item-card rendering. Prompt only, no mockup.

Same rules: existing v1.22 tokens only, Lucide icons only, no hardcoded shadows / radii / hex.

## 1. Drop the legacy projectRef prefix from outreach subjects

Today the outreach compose modal builds its default subject as `{projectRef} — Brief: {item.name}`, baking the project-level ref (e.g. `WA-016`) into the subject string. With p0008's `ref_code` column carrying the category-level ref in its own field (and rendering as the `Ref XX-NNN` chip on the inbox row), the projectRef-in-subject is now redundant noise.

Fix forward only — no backfill of legacy data. The user is clearing the dev DB anyway, so two visual conventions side-by-side isn't a concern.

### Change

In `client-angular/src/app/shared/components/outreach-compose/outreach-compose.component.ts` (around line 564):

```typescript
// before
this.subject = (this.projectRef ? this.projectRef + ' — ' : '') + `Brief: ${r.item.name}`;

// after
this.subject = r.item.name;
```

The agent can still hand-edit the subject before sending. The default is now the clean item name, no embedded ref, no `Brief:` literal — that prefix wasn't adding signal.

Server side (`taxonomy.service.js:requestQuotes`) — the fallback subject if the client doesn't pass one is already `[${refCode}] ${categoryName} — brief from ${agencyName}`, which uses the `ref_code` properly. No change needed there.

## 2. Unique indexes on items + message_items

Two duplicate-prevention indexes. Neither is enforced today; both should be.

### 2.1 `items` — one catalogue entry per supplier per name

```sql
CREATE UNIQUE INDEX items_supplier_name_idx
  ON items (org_id, lower(trim(name)))
  WHERE is_active = true;
```

Case-insensitive, whitespace-trimmed, only constrains active rows so soft-toggled rows don't block re-adds. `org_id` is the supplier-owning org per the items schema.

Migration must run with `ON CONFLICT DO NOTHING` (or equivalent dedup) on insert paths if any code today blindly INSERTs into items. Audit:

- `taxonomy.service.js` — any items inserts in the AI matching / "Recommend" flow
- `catalogue.service.js` or wherever bulk imports live
- Any seed scripts that might re-run

Wrap the new index creation in a `try/catch` in the migration in case any dupes exist in the current data — log and skip the index if so, leave a `TODO(p0012-§2.1-dedup)` in the migration so we can clean up before re-running.

### 2.2 `message_items` — one catalogue item per brief

```sql
CREATE UNIQUE INDEX message_items_unique_item_per_msg
  ON message_items (message_id, item_id)
  WHERE item_id IS NOT NULL;
```

Partial index so AI-proposed / hand-entered items (where `item_id IS NULL`) aren't constrained — they don't have an id to dedup on.

Audit the `requestQuotes` flow + any other path that writes to `message_items` to add `ON CONFLICT (message_id, item_id) WHERE item_id IS NOT NULL DO NOTHING` (or transactionally guard with a SELECT-then-INSERT).

## 3. Item display ref

Items have a UUID `id` today but nothing human-readable. Add a short per-supplier sequential ref, displayed on the item card.

### 3.1 Schema

```sql
ALTER TABLE items
  ADD COLUMN display_ref text;

CREATE UNIQUE INDEX items_display_ref_idx
  ON items (org_id, display_ref)
  WHERE display_ref IS NOT NULL;
```

Format: `{SupplierInitials}-{seq}` where:

- `SupplierInitials` — uppercase first letter of each word in the supplier org name, max 3 chars (e.g. "Natural History Museum" → `NHM`, "Construct & Co. London" → `CCL`, "Illusion Design & Construct" → `IDC`, "DAR Hire London" → `DHL` — collapse single-letter words like "&" to nothing).
- `seq` — per-supplier sequential, zero-padded to 3 digits (`001`, `002`, …), counts only active items.

Mirrors the brief `ref_code` pattern (`HS-001`) for visual consistency.

### 3.2 Generation

On insert (and on activate, when an inactive row toggles back), allocate the next sequence atomically:

```sql
UPDATE items
   SET display_ref = $org_initials || '-' || lpad((
     SELECT COALESCE(MAX(SUBSTRING(display_ref FROM '\d+$')::int), 0) + 1
     FROM items
     WHERE org_id = $org_id AND display_ref IS NOT NULL
   )::text, 3, '0')
 WHERE id = $item_id;
```

(Or compute in app code with a per-org advisory lock — whichever fits the existing pattern. Just don't race.)

Add a helper `allocateItemDisplayRef(orgId, orgName)` somewhere in the items service so all insert paths funnel through it.

### 3.3 Backfill

```sql
-- For each existing active item, assign the next display_ref per supplier.
-- Process oldest-first so sequence aligns with creation order.
WITH numbered AS (
  SELECT id, org_id,
         row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS rn
  FROM items
  WHERE is_active = true AND display_ref IS NULL
)
UPDATE items i
   SET display_ref = (
     SELECT initials FROM orgs WHERE id = i.org_id
   ) || '-' || lpad(n.rn::text, 3, '0')
   FROM numbered n
  WHERE i.id = n.id;
```

If `orgs` doesn't have an `initials` column, compute it inline in the migration (same logic as the helper).

### 3.4 Display

Two places the `display_ref` should appear:

- **`MessageItemCardComponent` (p0011)** — small muted chip in the top-left of the card body or trailing the name, e.g. `Natural History & Science Museum  · NHM-001`. Use `--color-text-muted`, ~10px, lowercase letterspacing per the eyebrow style.
- **Marketplace item card (`catalogue-grid.component.ts`)** — same chip, same position. If the existing eyebrow already has the supplier name, append `· {display_ref}`.

For AI-proposed / hand-entered items (those without a row in `items` and therefore no `display_ref`), show nothing — no fallback, no `—`.

## Verify

- **Subject prefix:** open the outreach compose modal for an item. Default subject is `{item.name}` only — no `WA-016 — Brief:` prefix. Agent can edit before sending.
- **Items uniqueness:** try to insert a duplicate item name for the same supplier (case-different, whitespace-different) — fails with a unique-violation. Inserting the same name for a different supplier works.
- **Message-items uniqueness:** try to add the same catalogue item twice to one brief — second one is dropped (or rejected, per the chosen insert path).
- **Display ref generation:** create a new item under "Natural History Museum" → gets `NHM-{nextSeq}`. Next item → `NHM-{seq+1}`.
- **Backfill:** every existing active item has a `display_ref` populated. Sequence is in creation order per supplier.
- **Display:** item cards (both marketplace and inbox conversation) show `· NHM-001` as a small muted chip after the eyebrow.

When complete and verified, mark p0012 `Done` in `prompts/README.md`.
