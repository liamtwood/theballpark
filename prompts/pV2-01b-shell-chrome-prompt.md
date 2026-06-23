# pV2-01b — Shell chrome: header + avatar + user menu + footer

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/auth-and-users-plan.md` (role model — `org.type` + `is_admin`)
4. `prompts/pV2-01-scaffold-client-v2-shipped.md` (scaffold landed; this builds on it)
5. This prompt

## Goal

Build the v2 shell chrome — transparent header with avatar widget on the right,
version chip footer on the bottom right — before pV2-02 wires real auth.
Everything works against a **stub `AuthService`** so the UI is functional and
demoable even though Google OAuth doesn't exist yet.

The widget set extracted here becomes the v2 standard, reused everywhere
identity is shown (top nav, team list rows, message senders, etc.).

When pV2-02 ships, only the `AuthService` implementation swaps — the
components don't change.

## What this builds

### 1. `<app-user-avatar>` — atomic primitive

`client-v2/src/app/shared/user-avatar/user-avatar.component.ts`

```typescript
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (imageUrl()) {
      <img [src]="imageUrl()" [alt]="displayName()" class="avatar avatar--img" [style.width.px]="size()" [style.height.px]="size()"/>
    } @else {
      <div class="avatar avatar--initials" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="fontSize()">
        {{ initials() }}
      </div>
    }
  `,
  styles: [`
    .avatar {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      flex-shrink: 0;
      font-weight: 600;
      color: var(--theme-accent);
    }
    .avatar--initials {
      background: var(--theme-soft);              /* the pink-to-green gradient */
      font-family: var(--font-display, inherit);
    }
    .avatar--img {
      object-fit: cover;
    }
  `]
})
export class UserAvatarComponent {
  readonly displayName = input<string | null>(null);
  readonly email       = input<string | null>(null);
  readonly imageUrl    = input<string | null>(null);
  readonly size        = input<number>(36);

  protected readonly initials = computed(() => deriveInitials(this.displayName(), this.email()));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.40));
}

function deriveInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}
```

Used wherever a user circle appears. Default 36px in header; 28px in team list rows; 20px in message bubbles; etc.

### 2. Stub `AuthService` — same shape as the future real one

`client-v2/src/app/core/auth/auth.service.ts`

```typescript
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeOrgId: string;
  activeOrgName: string;
  activeOrgType: 'agency' | 'supplier' | 'ballpark';
  isAdmin: boolean;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<SessionUser | null>(STUB_USERS[0]);    // start logged in as Sarah for dev

  readonly user        = this._user.asReadonly();
  readonly isLoggedIn  = computed(() => this._user() !== null);
  readonly role        = computed(() => this._user()?.role ?? null);

  // Dev-only — real implementation arrives in pV2-02
  listDevUsers(): SessionUser[] {
    return STUB_USERS;
  }

  devLogin(userId: string): void {
    const u = STUB_USERS.find(x => x.id === userId);
    if (u) {
      this._user.set(u);
      // In real impl this'd hit /auth/dev/login + hard reload; for stub just signal
    }
  }

  loginWithGoogle(): void {
    console.warn('Google OAuth lands in pV2-02');
  }

  logout(): void {
    this._user.set(null);
  }
}

// Fixed list of fake users for dev — replaced by /api/dev/users in pV2-02
const STUB_USERS: SessionUser[] = [
  { id: 'stub-sm', email: 'sarah@creative-agency.example', displayName: 'Sarah Mitchell',
    avatarUrl: null, activeOrgId: 'stub-cag', activeOrgName: 'Creative Agency Ltd',
    activeOrgType: 'agency', isAdmin: true, role: 'agency_admin' },
  { id: 'stub-bp', email: 'beth@ballpark.example', displayName: 'Beth Pizey',
    avatarUrl: null, activeOrgId: 'stub-bp-org', activeOrgName: 'Ballpark',
    activeOrgType: 'ballpark', isAdmin: true, role: 'ballpark_admin' },
  { id: 'stub-ry', email: 'ryan@rocketfood.example', displayName: 'Ryan Chen',
    avatarUrl: null, activeOrgId: 'stub-rf', activeOrgName: 'Rocket Food',
    activeOrgType: 'supplier', isAdmin: true, role: 'supplier_admin' },
  { id: 'stub-am', email: 'alex@creative-agency.example', displayName: 'Alex Martin',
    avatarUrl: null, activeOrgId: 'stub-cag', activeOrgName: 'Creative Agency Ltd',
    activeOrgType: 'agency', isAdmin: false, role: 'agency_member' },
];
```

This service is replaced in pV2-02 with real HTTP-backed implementation. Same
public surface so components don't need to change.

### 3. `<app-user-menu>` — avatar + dropdown

`client-v2/src/app/shell/user-menu/user-menu.component.ts`

Click avatar → dropdown shows:
- Current user header: avatar + name + "agency_admin · Creative Agency Ltd"
- Divider
- **"Switch user (dev)"** submenu — lists `auth.listDevUsers()` results (only renders if list returns ≥1 entry)
- Divider
- **"Sign out"**

Use PrimeNG `<p-menu>` or `<p-popover>` for dropdown chrome. Styling matches v1's calm dropdown treatment.

Avatar size in header: **40px**. Slightly larger than v1, per spec.

### 4. `<app-shell>` — the chrome around `<router-outlet>`

`client-v2/src/app/shell/app-shell.component.ts`

```
┌────────────────────────────────────────────────────────────────────┐
│  Ballpark                                              [SM] ▾      │  ← transparent header
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                                                                    │
│                       <router-outlet />                            │
│                                                                    │
│                                                                    │
│                                                                    │
│                                                       [Dev v2] v2.01a   ← footer, fixed
└────────────────────────────────────────────────────────────────────┘
```

- Header: transparent background, fixed-position top, hairline bottom border (`var(--border-hairline)`), 56px tall, padding 0 24px
- Left: `Ballpark` wordmark (links to `/`)
- Right: `<app-user-menu>` when logged in
- Footer: bottom-right, fixed, small monospace chip reading `environment.versionChip`

Header is only rendered when NOT on `/login` or `/auth/callback` — those are full-bleed pages.

### 5. Login page update — `/login`

Replace the pV2-01 placeholder with:

```
┌──────────────────────────────────┐
│  Sign in to Ballpark             │
│  Continue with Google to access  │
│  your account                    │
│                                  │
│  [ Continue with Google ]        │
│                                  │
│  ── or, for dev, pick a user ──  │
│  ┌──────────────────────────┐    │
│  │ [SM]  Sarah Mitchell     │    │
│  │       Agency · Admin     │    │
│  ├──────────────────────────┤    │
│  │ [BP]  Beth Pizey         │    │
│  │       Ballpark · Admin   │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

- Google button is the primary CTA (always visible). Calls `auth.loginWithGoogle()`.
- Dev picker section only renders if `auth.listDevUsers().length > 0`. Clicking a user → `auth.devLogin(userId)` → router navigate to `/`.
- Picker uses `<app-user-avatar size="28">` for each row.

### 6. Footer version chip

`client-v2/src/app/shell/version-chip/version-chip.component.ts`

```typescript
@Component({
  selector: 'app-version-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="chip">{{ chip }}</div>`,
  styles: [`
    .chip {
      position: fixed; bottom: 12px; right: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: var(--color-text-secondary, #6b7280);
      pointer-events: none;
      z-index: 50;
      opacity: 0.55;
      user-select: none;
    }
  `]
})
export class VersionChipComponent {
  readonly chip = environment.versionChip;
}
```

Rendered once at the bottom of `<app-shell>`. Hidden in pure-bleed pages (login, callback)? No — keep it visible everywhere so we always know which build we're looking at.

### 7. Hello page update

Replace the pV2-01 hello page with:

- Title "Hello, {displayName}" (from `auth.user()` signal)
- Subtitle "{activeOrgName} · {role}"
- API connection indicator (preserved from pV2-01)
- One PrimeNG button — preserved as the theme proof
- Removes the version chip (now in footer)

## Routing changes

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,              // header + footer + outlet
    children: [
      { path: '', loadComponent: () => import('./pages/hello/hello.component').then(m => m.HelloComponent) },
      // future feature routes go here, all get the shell
    ]
  },
  // Pure-bleed routes outside the shell:
  { path: 'login',         loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent) },
  { path: '**', redirectTo: '' }
];
```

## PrimeNG components used

- `<p-button>` for Google sign-in button + minor CTAs
- `<p-menu>` OR `<p-popover>` for the user dropdown — pick whichever has cleaner styling under Aura
- All themed via the existing `definePreset` brand bridge — no per-component CSS overrides

## Acceptance criteria

1. Visit `http://localhost:4201/` — transparent header at top, `Ballpark` wordmark left, avatar circle (40px, initials "SM" with theme-soft gradient) on right.
2. Click avatar → dropdown opens, shows Sarah's info + "Switch user (dev)" submenu + Sign out.
3. Click another user (e.g. Beth) → avatar updates to "BP", hello page reflects new name + org.
4. Click Sign out → redirected to `/login`. Avatar gone from header.
5. `/login` shows Google button + dev picker (4 stub users).
6. Click a dev user from `/login` → redirected to `/`, hello page shows that user.
7. Click "Continue with Google" → console warning "Google OAuth lands in pV2-02" (stub).
8. Version chip in bottom-right corner of every authenticated route reads `[Dev v2] v2.01a`.
9. On `/login` and `/auth/callback` → no header rendered (full-bleed pages). Footer still visible (your call — but consistent).
10. `<app-user-avatar>` used in 3 places: header (40px), login picker (28px), and hello page intro (44px or wherever feels right). Verify it scales correctly.
11. Old `client-angular/` on port 4200 still works unchanged.
12. `ng build` clean, lint clean. Zero `*ngIf` / `*ngFor` / NgModules / `any` types.
13. PrimeNG `<p-menu>` (or `<p-popover>`) styled correctly with Aura preset — no hardcoded colors in component CSS.

## Out of scope

- Real Google OAuth (pV2-02)
- Real `/api/dev/users` endpoint (pV2-02)
- Real cookie / session persistence — stub `AuthService` holds in-memory state
- Org switcher (multi-org UX deferred)
- Settings menu, notifications, search — separate prompts later
- Page hero band (Ballpark's signature "Inbox" + subtitle hero) — separate prompt; this prompt is just the OUTER shell, not the per-page hero
- Touching `client-angular/`

## Bump + ship

1. Version chip → `[Dev v2] v2.01a`
2. Commit: `feat(v2.01a): shell chrome — transparent header + user avatar + dev picker + footer chip`
3. Ship report `prompts/pV2-01b-shell-chrome-shipped.md`
4. Flip backlog row to Done

## Reply with

- Commit SHA
- 13/13 acceptance criteria ticked
- Confirmation old app still works
- Brief on PrimeNG menu component choice (`<p-menu>` vs `<p-popover>`) and why
- Any visual tweaks made (avatar size, dropdown style, etc.)
