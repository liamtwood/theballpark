-- Rebuild migration 0060 — items.bpin (Ballpark Identification Number): the
-- immutable public item handle. pV2-BPIN-01 / ADR-0002.
--
-- `BP` + 8-char Crockford base32, DB-self-minted via column DEFAULT so no caller
-- (loader, supplier editor, website extractor) ever supplies or can forget it.
-- Non-sequential by construction (bijective scramble of a 40-bit sequence → no
-- enumeration leak) yet collision-free (bijection mod 2^40, no retry). Immutable;
-- the UUID stays the PK, bpin is the public face. Variant handles compose this
-- parent with per-dimension value codes at the URL boundary (ADR-0002, app-level) —
-- nothing extra is stored on the row.
--
-- ADDITIVE column: the rebuild `items` table never had the legacy
-- min_price/max_price the first spec draft proposed renaming (verified dev+preview;
-- the legacy migrate-schemas.js table itself already dropped them in pV2-STORE-01).
-- Fully idempotent (IF NOT EXISTS / CREATE OR REPLACE / null-guarded backfill).

-- 1. sequence
CREATE SEQUENCE IF NOT EXISTS public.items_bpin_seq;

-- 2. generator — bijective scramble, overflow-safe (numeric multiply, mod 2^40).
--    K odd ⇒ coprime to 2^40 ⇒ (seq*K + C) mod 2^40 is a bijection → distinct seq
--    ⇒ distinct code, zero collisions. n*k is done in numeric so it never overflows
--    int8 once the sequence passes ~2^23 (~8.4M rows).
--    K MUST be mid-range for diffusion, NOT hugged against 0 or 2^40: a K near 2^40
--    (e.g. 2^40-87) makes seq*K ≡ -87*seq, an effective multiplier of -87, so
--    consecutive seq values produce near-sequential codes (shared prefixes) and leak
--    enumeration. K below = round(2^40 · (√5−1)/2), the golden-ratio multiplier
--    (Knuth), odd, ~0.618·2^40 — good avalanche across all 8 base32 digits. Fixed forever.
CREATE OR REPLACE FUNCTION public.gen_bpin() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n         bigint  := nextval('public.items_bpin_seq');
  k         numeric := 679535555967;    -- odd golden-ratio multiplier; fixed forever
  c         numeric := 777777777777;    -- fixed offset
  scrambled bigint  := ((n::numeric * k + c) % 1099511627776)::bigint;  -- mod 2^40
  alphabet  text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- Crockford (no I L O U)
  out       text := '';
  i         int;
BEGIN
  FOR i IN 0..7 LOOP
    out := substr(alphabet, (scrambled & 31)::int + 1, 1) || out;
    scrambled := scrambled >> 5;
  END LOOP;
  RETURN 'BP' || out;
END $$;

-- 3. additive column
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS bpin varchar(12);

-- 4. backfill existing rows (gen_bpin is volatile → distinct per row)
UPDATE public.items SET bpin = public.gen_bpin() WHERE bpin IS NULL;

-- 5. default + guard + lookup
ALTER TABLE public.items ALTER COLUMN bpin SET DEFAULT public.gen_bpin();
ALTER TABLE public.items ALTER COLUMN bpin SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS items_bpin_uidx ON public.items (bpin);
