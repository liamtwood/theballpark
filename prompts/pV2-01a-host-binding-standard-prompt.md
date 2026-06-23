# pV2-01a — Codify the `host:` binding pattern in WORKING_STANDARDS

## Read first

1. `WORKING_STANDARDS.md`
2. This prompt (it's a one-screen docs commit)

## Goal

Add a small, explicit rule under the Angular section of `WORKING_STANDARDS.md`
codifying the v2 component pattern: **the component instance IS the styled
element — no inner wrapper**.

Catches the anti-pattern of wrapping the entire template in a `<div>` or
`<header>` etc. that re-states the component's identity. Wastes a DOM node and
adds CSS specificity friction.

## What to add

Find the Angular / styling section of `WORKING_STANDARDS.md` (the one that
already covers OnPush, standalone, `.pick({})` for Lucide, etc.) and add a new
rule beneath it:

```markdown
### Component is the element — no wrapping

A v2 standalone component's template MUST NOT begin with a wrapper element that
re-states what the component already is (e.g. an inner `<header>` inside an
`<app-page-hero>`, or a root `<div class="bp-foo">` inside an `<app-foo>`).

Instead, bind the root class and variant modifiers to the host element via
`host:` in the component decorator. The component instance IS the styled
element.

**Wrong** — wastes a DOM element, doubles styling targets:
```typescript
@Component({
  selector: 'app-page-hero',
  template: `<header class="bp-page-hero">...</header>`,
})
```

**Right** — `<app-page-hero>` is itself the band:
```typescript
@Component({
  selector: 'app-page-hero',
  host: {
    'class': 'bp-page-hero',
    '[class.bp-page-hero--align-center]': "align() === 'center'",
  },
  template: `...`,    // no outer wrapper
})
```

Apply to every v2 component in `client-v2/`. If a child component genuinely
needs ONE inner wrapper (rare — usually because of a semantic HTML requirement
like `<form>` or `<table>`), the wrapper does NOT carry the component's root
class; the host element does.

This rule applies ONLY to `client-v2/` going forward. Existing v1 components in
`client-angular/` are not retroactively refactored.
```

Place this rule in the Angular section, near the existing "Standalone only" /
"ChangeDetectionStrategy.OnPush mandatory" rules.

## Acceptance

1. `WORKING_STANDARDS.md` has the new rule under the appropriate section.
2. Examples are present (the Wrong/Right pair).
3. Atomic commit — docs only, no code touched.
4. Commit message: `docs: codify host:-binding component standard for client-v2`

## Out of scope

- Auditing existing v2 components — pV2-01 only has the hello/login/auth-callback placeholders and there's nothing big to refactor yet
- Touching v1 patterns
- Bumping version chip (docs only)

## Reply with

- Commit SHA
- Quote of the exact section header you placed the rule under
