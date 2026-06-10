# Shipped — pV2-01b — Shell chrome: header + avatar + user menu + footer

**Version:** v2.01a (chip `[Dev v2] v2.01a`)
**Shipped:** see commit log
**Prompt:** `pV2-01b-shell-chrome-prompt.md`

## What changed (all in `client-v2/`)
- **NEW** `shared/user-avatar/user-avatar.component.ts` — `<app-user-avatar>`: image or theme-soft-gradient initials circle; `input()` signals (`displayName/email/imageUrl/size`), `computed()` initials + font size. Used at 40px (header), 36px (menu header), 28px (login picker), 24px (menu dev rows), 44px (hello intro).
- **NEW** `core/auth/auth.service.ts` — stub `AuthService` with `signal<SessionUser | null>` (`user` readonly, `isLoggedIn`/`role` computed), `listDevUsers()`, `devLogin()`, `loginWithGoogle()` (console-warn stub), `logout()`. Exports `SessionUser` + the 5-role `Role` union from `auth-and-users-plan.md`. Starts signed in as Sarah. Same public surface as pV2-02's real impl.
- **NEW** `shell/user-menu/user-menu.component.ts` — 40px avatar button → **`p-popover`** dropdown: identity header ("agency_admin · Creative Agency Ltd"), "Switch user (dev)" rows (renders only while the stub list is non-empty), Sign out (→ `/login`).
- **NEW** `shell/app-shell.component.ts` — transparent fixed 56px header (`Ballpark` wordmark → `/`, user menu right, `var(--border-hairline)` bottom) above `<router-outlet>`.
- **NEW** `shell/version-chip/version-chip.component.ts` — fixed bottom-right monospace chip; **host IS the chip** (styles on `:host`, no inner wrapper) per the pV2-01a standard.
- **CHANGED** `app.component.ts` — slimmed to `<router-outlet/> + <app-version-chip/>` (chip rendered outside the shell so it shows on full-bleed pages too).
- **CHANGED** `app.routes.ts` — shell wrapper route with children (`''` → hello); `login` + `auth/callback` outside the shell (no header).
- **CHANGED** `pages/login` — Google CTA (stub) + dev picker (4 stub users, 28px avatars) → `devLogin` + navigate `/`.
- **CHANGED** `pages/hello` — "Hello, {displayName}" + "{org} · {role}" from `auth.user()`; keeps API dot + Aura button proofs; chip removed (now in footer).
- `styles.css` — added chrome tokens `--border-hairline`, `--color-text-secondary`.
- Env chips → `v2.01a` (dev/staging/prod).

## PrimeNG menu choice — `p-popover` (not `p-menu`)
The dropdown is rich content (avatar identity header + avatar-led user rows + sign out), which fits `p-popover`'s free-content overlay naturally; `p-menu` would force everything through `MenuItem[]` with per-item template overrides. Popover chrome is Aura-themed; zero hardcoded colors in component CSS (Tailwind utilities + brand tokens only).

## Visual tweaks
- Header avatar 40px per spec; menu identity header 36px; dev rows 24px; login picker 28px; hello intro 44px.
- Current user's row in the dev switcher is dimmed (opacity) as a subtle "you are here".
- Login is a centred white/80 card on the parchment ground.

## Verify — 13/13
1. ✓ Transparent header (`rgba(0,0,0,0)`), `Ballpark` wordmark left, 40px "SM" gradient avatar right.
2. ✓ Avatar click → popover with Sarah's info + "Switch user (dev)" + Sign out.
3. ✓ Switch to Beth → avatar "BP", hello "Hello, Beth Pizey" / "Ballpark · ballpark_admin".
4. ✓ Sign out → `/login`; header + avatar gone.
5. ✓ `/login` shows Google CTA + 4-user dev picker.
6. ✓ Dev login (Ryan) → `/`, "Hello, Ryan Chen".
7. ✓ Google CTA → console warning "Google OAuth lands in pV2-02".
8. ✓ Fixed bottom-right chip `[Dev v2] v2.01a` (authenticated routes).
9. ✓ No header on `/login`/`/auth/callback` (outside the shell); chip still visible there (rendered at root).
10. ✓ `<app-user-avatar>` at 40/28/44 px — scales correctly (verified measured widths).
11. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).
12. ✓ `ng build` + `ng lint` clean; zero `*ngIf`/`*ngFor`/NgModule/`any`.
13. ✓ Popover Aura-styled via the existing `BallparkPreset` bridge — no per-component color CSS.

angular-developer skill invoked pre-build (inputs/host-elements references) — `input()`/`computed()`/`inject()`/`host:` idioms confirmed current.

pV2-01b flipped to `Done` in `prompts/backlog.md`. Next: pV2-01c (page hero).
