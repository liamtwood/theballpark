# Phase 3 Verification Tests — Soft-delete + audit columns

**Status (v1.66e6):** Phase 4 is ALREADY applied — the hard-delete guard is
live on the dev DB (`v_guard=true`). These tests now confirm the soft-delete UX +
audit attribution end-to-end *against the guarded DB*. All five should pass.

**Before running:** pull `origin/dev` + restart the local dev server so the
converted services are live — otherwise a stale build's hard-delete will hit the
guard and raise.

**Environment:** dev only (Supabase dev DB). Columns + stamp trigger + guard
applied (v1.66e6). Middleware (v1.66dy) live so `SET LOCAL app.current_user_id`
resolves correctly.

---

## Test 1 — Soft-delete an estimate item

**Steps:**
1. Open a project that has at least one estimate with items
2. Note the current estimate total
3. Delete one estimate item from the UI (cart drawer or estimate view)

**Expected:**
- Item vanishes from the estimate's item list
- Estimate total drops by exactly the deleted item's amount
- `SELECT * FROM estimate_items WHERE id = '<deleted_id>'` shows the row still exists with `deleted_at` populated
- `deleted_by` matches your user_id

**Failure modes to watch for:**
- Total doesn't recalculate (recalcTotal SUM not filtering deleted)
- Item still appears in list (read query not filtering `deleted_at IS NULL`)

---

## Test 2 — Toggle a project_category off, then back on

**Steps:**
1. Open a project's brief picker (where project_categories toggle on/off)
2. Toggle off an active category — confirm it disappears from the project view
3. Toggle the same category back on
4. Confirm it reappears

**Expected:**
- Category disappears immediately when toggled off
- Toggling back on reactivates the SAME row (no duplicate ghost row created)
- `SELECT * FROM project_categories WHERE project_id = '<id>' AND category_id = '<id>'` returns ONE row, currently `is_active = true`
- `updated_by` reflects the toggle action; `updated_at` bumped twice

**Failure modes:**
- Toggling on creates a new row (constraint or upsert logic wrong)
- Toggle off doesn't actually hide the category from the brief
- Duplicate rows accumulate over multiple toggles

---

## Test 3 — Delete a feedback item / folder

**Steps:**
1. Open the feedback admin view
2. Delete an individual feedback item — confirm it vanishes from the list
3. Delete a folder that contains feedback items — confirm folder + children vanish from the list

**Expected:**
- Deleted feedback item disappears from list view immediately
- Folder deletion cascades visually — children also disappear
- Database rows still exist with `deleted_at` populated (soft-delete confirmed)
- All ~10 feedback reads (BASE_SELECT subqueries, getAll/ById/Folders/Issues/Today/Children/Versions/Categories) filter correctly

**Failure modes:**
- Deleted items still showing in one of the 10 read paths
- Folder delete doesn't cascade visually
- Reads return ghosted rows

---

## Test 4 — Junction tables stay hard-deletable

**Test 4a — Cart item (project_items):**
1. Open a project's cart, add an item if needed
2. Remove the item from the cart

**Expected:**
- Row is hard-deleted (no `deleted_at` set; row gone from DB)
- `SELECT * FROM project_items WHERE project_id = '<id>' AND item_id = '<id>'` returns zero rows
- Operation completes without trigger raising "Hard delete forbidden"

**Test 4b — Item tags (supplier_item_tag):**
1. Edit an item, change its tags, save (taxonomy sync = delete + reinsert pattern)

**Expected:**
- Old tag rows hard-deleted; new tag rows inserted
- No trigger blocking the delete
- Tag changes reflect immediately

**Failure modes:**
- Trigger raises on junction delete (guard scoping wrong — should be entity tables only)
- Tag changes fail to save

---

## Test 5 — Audit attribution on edit

**Steps:**
1. Edit any entity record (e.g., update an org field via Settings → Organisation, or change a project name)
2. Save
3. Query the row directly

**Expected:**
- `updated_by` is now populated with YOUR user_id (not NULL, not SYSTEM sentinel)
- `updated_at` is bumped to NOW()
- `created_by` and `created_at` unchanged

**Failure modes:**
- `updated_by` is NULL (middleware not setting `SET LOCAL app.current_user_id`)
- `updated_by` shows wrong user (session leak across requests)
- `updated_at` not bumped (trigger missing)

---

## Sign-off

| Test | Pass / Fail | Notes |
|---|---|---|
| 1 — Delete estimate item | | |
| 2 — Toggle project_category | | |
| 3 — Delete feedback item/folder | | |
| 4a — Hard-delete cart item | | |
| 4b — Re-save item tags | | |
| 5 — Audit attribution | | |

**All five pass →** dev foundation confirmed; greenlight CC for the preview/master
rollout of the migration.

**Any fail →** diagnose + fix on dev. (The guard is already on; if you need
hard-delete back temporarily while diagnosing, drop `trg_forbid_hard_delete` on
the affected table, fix, then re-run the runner.)

---

## Bonus (optional — confirms the guard works after Phase 4)

Once Phase 4 is run with `v_guard=true`, run from `psql`:

```sql
-- Should RAISE EXCEPTION ("Hard delete forbidden on items...")
DELETE FROM items WHERE id = '<test-item-id>';

-- Should succeed (junction table, exempt from guard)
DELETE FROM project_items WHERE project_id = '<id>' AND item_id = '<id>';
```

Confirms guard is active on entities AND junctions still hard-delete.
