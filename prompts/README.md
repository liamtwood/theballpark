# prompts/

Design and styling prompts for Claude Code, with their visual references.

## How this works

Each piece of design work lives here as an indexed **pair**:

- `pNNNN-<slug>-prompt.md` — the written spec: what to change, which files, which tokens, how to verify.
- `pNNNN-<slug>-mockup.html` — a standalone visual reference. Self-contained; opens in any browser.

The `pNNNN` prefix (zero-padded, e.g. `p0001`) gives each task a stable ID and keeps the folder sorted in order. Both files in a pair share the same prefix and slug.

When picking up a task, read the `-prompt.md` and open the matching `-mockup.html` so you have both the spec and the picture.

## Conventions

- Prompts reference real file paths and the v1.22 elevation tokens in `client-angular/src/styles.css`. Use existing tokens — never hardcode shadows, radii, or hex colours, never invent new tokens.
- Prompts are styling/layout scoped unless they say otherwise — don't change data flow or business logic.
- Theme colours (`--theme-*`) recolour with the admin preset; semantic colours (`--color-action/waiting/quoted/booked`, success/danger) do not.
- Icons are Lucide only, via `lucide-angular` — never Tabler or any other set.
- **Never edit a prompt once written.** To change or fix something, create a new numbered prompt that supersedes it. A prompt always means one fixed thing.
- A prompt usually pairs with its own `-mockup.html`, but a follow-up/fix prompt may instead reference an earlier mockup as its target (note that in the prompt and the Index row).

## Index

| ID | Status | Work |
|----|--------|------|
| p0001 | Done | Search-panel standardisation across Marketplace + Messages, and the Messages styling pass (panel containment, sticky headers, shared list-row card, elevation-token migration). |
| p0002 | Done | Styling fixes after p0001's first pass — white search panel, stray container removed, panel-header divider alignment, header icons de-circled, active category circle. Prompt only; uses the p0001 mockup as its target. |

Statuses: **Draft** (still being written) · **Ready** (ready to implement) · **Done** (implemented).

## "Do the next one"

When asked to do the next prompt:

1. Open this README and find the **lowest-numbered entry not marked `Done`**.
2. Read its `pNNNN-<slug>-prompt.md` and open the matching `pNNNN-<slug>-mockup.html`.
3. Implement it.
4. Change that entry's status to **`Done`** in the table above.

This is how the queue stays correct across sessions — the README is the single source of truth for what's done, not memory.

## Going forward

New design work follows the same pattern: take the next `pNNNN` index, drop a `pNNNN-<slug>-prompt.md` and its `pNNNN-<slug>-mockup.html` in here as a pair, and add a row to the **Index** table with status `Ready`.
