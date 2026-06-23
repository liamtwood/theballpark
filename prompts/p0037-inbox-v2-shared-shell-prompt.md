# p0037 — inbox-v2 shared shell (hero only)

## Goal

Stand up the new inbox-v2 component as a **shared, reusable** component with
just the hero rendering. No search, no filter drawer, no body. We'll layer the
rest in subsequent prompts.

## Pattern to mirror

V1 already follows the right pattern:
- `shared/components/messages-inbox/` — real component
- `features/messages/inbox.component.ts` — thin route wrapper that mounts it

V2 mirrors this.

## What to build

### 1. Create the shared component

**File:** `client-angular/src/app/shared/components/messages-inbox-v2/messages-inbox-v2.component.ts`

```typescript
import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-messages-inbox-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="bp-inbox-v2" [class.bp-inbox-v2--compact]="compact">
      <!-- hero rendered by app-shell via route data when showHero=true,
           nothing local until we add chrome layers -->
    </div>
  `,
  styles: [`
    .bp-inbox-v2 {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .bp-inbox-v2--compact { padding: 12px; }
  `]
})
export class MessagesInboxV2Component {
  // SCOPE
  @Input() scopedToProjectId?: string;
  @Input() scopedToSupplierId?: string;
  @Input() scopedToItemId?: string;
  @Input() viewerRole: 'agency' | 'supplier' = 'agency';

  // CHROME
  @Input() showHero = true;
  @Input() showSearchRow = true;
  @Input() showFilterDrawer = true;
  @Input() showTreeRail = true;
  @Input() compact = false;

  // EVENTS
  @Output() threadSelected = new EventEmitter<string>();
  @Output() messageSent = new EventEmitter<any>();
}
```

### 2. Convert the route wrapper

**File:** `client-angular/src/app/features/messages/inbox-v2.component.ts`

Replace whatever's currently there with the thin wrapper:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MessagesInboxV2Component } from '../../shared/components/messages-inbox-v2/messages-inbox-v2.component';

@Component({
  selector: 'app-inbox-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessagesInboxV2Component],
  template: `<app-messages-inbox-v2 viewerRole="agency"/>`
})
export class InboxV2Component {}
```

### 3. Register the route

**File:** `client-angular/src/app/app.routes.ts`

Add (or confirm present):

```typescript
{
  path: 'inbox-v2',
  loadComponent: () =>
    import('./features/messages/inbox-v2.component').then(m => m.InboxV2Component),
  data: {
    pageLabel: '',
    tabs: [],
    heroTitle: 'Inbox',
    heroSub: 'Project conversations.',
    back: '/home',
    heroAlign: 'left'
  }
}
```

## Acceptance criteria

1. Navigate to `/inbox-v2` — page loads without errors
2. Hero band renders with title "Inbox" and subtitle "Project conversations."
3. Back arrow returns to `/home`
4. Cog icon in hero opens page-settings drawer (HeroSettingsService default behavior)
5. Below the hero: just empty padded space (correct — body comes later)
6. No console errors, no template warnings
7. `<app-messages-inbox-v2>` selector works when dropped anywhere else (e.g. ad-hoc test in a project page) — renders the same empty padded div

## Out of scope (do NOT add)

- Search row
- Filter drawer
- Tree rail (left)
- Thread pane (right)
- Any data loading
- Any styles beyond the padding wrapper

## Reference

- Living spec: `client-angular/src/app/features/messages/inbox-v2.schematic.yaml`
- V1 reference: `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts`
- V1 wrapper pattern: `client-angular/src/app/features/messages/inbox.component.ts`

## After this lands

- Update `inbox-v2.schematic.yaml` status block: `built_so_far: [hero]`
- Next prompt will add `search-row`
