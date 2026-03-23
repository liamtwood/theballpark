# UX Fixes — CC Handoff
# Apply in order. Run ng build after each step.

=================================================================
## STEP 1 — Back arrow in hero (ShellContext + AppShell)
=================================================================

### 1a. Add backPath to ShellContext interface
In client-angular/src/app/core/services/shell-context.service.ts

Add to ShellContext interface:
  backPath?: string;   // if set, renders a ← back arrow in the hero

### 1b. Add back arrow to AppShell hero template
In client-angular/src/app/shared/components/app-shell/app-shell.component.ts

In the template, find:
  <!-- TITLE — project name or org name -->
  <h1 class="bp-hero-org-name">{{ heroTitle }}</h1>

BEFORE that h1, insert:
  <!-- BACK ARROW -->
  <div *ngIf="ctx?.backPath" class="bp-hero-back" (click)="navigate(ctx!.backPath!)">
    <i class="pi pi-arrow-left" style="font-size:13px;"></i>
    <span>Back</span>
  </div>

Add CSS to the component styles:
  .bp-hero-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 500; color: var(--color-text-muted);
    cursor: pointer; margin-bottom: 6px;
    transition: color 0.15s;
  }
  .bp-hero-back:hover { color: var(--theme-accent); }

### 1c. Set backPath in supplier-detail.component.ts
In ngOnInit(), update the shellCtx.set() call to add:
  backPath: '/suppliers',

### 1d. Set backPath in project-detail.component.ts
In pushContext(), update the shellCtx.set() call to add:
  backPath: '/projects',

---

=================================================================
## STEP 2 — Supplier list: split tap zones
=================================================================

Tap name/image → navigate to supplier detail
Tap › chevron → expand/collapse tags

In client-angular/src/app/features/suppliers/supplier-list.component.ts

### 2a. Update the row template
Find the bp-sup-card div and replace with:

  <div class="bp-sup-card">
    <!-- LEFT — tap to navigate -->
    <div class="bp-sup-card-nav" (click)="goToSupplier(s, null)">
      <div class="bp-sup-card-img"
        [style.background-image]="s.cover_image_url ? 'url(' + s.cover_image_url + ')' : null"
        [class.bp-sup-card-img-default]="!s.cover_image_url">
      </div>
      <div class="bp-sup-card-body">
        <div class="bp-sup-card-name">{{ s.name }}</div>
        <div class="bp-sup-card-meta">{{ (s as any).city || 'London' }}</div>
      </div>
    </div>
    <!-- HEART -->
    <button class="bp-heart-btn" [class.active]="isFav(s.id)"
      (click)="toggleFav($event, s.id)">
      <lucide-icon name="heart" [size]="16"></lucide-icon>
    </button>
    <!-- CHEVRON — tap to expand tags -->
    <button class="bp-sup-expand-btn" (click)="toggleExpand(s)">
      <lucide-icon [name]="s.expanded ? 'chevron-down' : 'chevron-right'" [size]="16"></lucide-icon>
    </button>
  </div>

### 2b. Add toggleExpand method (separate from goToSupplier)
Add method to class:
  toggleExpand(s: SupplierWithState) {
    s.expanded = !s.expanded;
    if (s.expanded && !s.catalogueLoaded) {
      this.supplierSvc.getCatalogue(s.id).subscribe({
        next: (items: any[]) => {
          s.catalogueItems = items || [];
          s.catalogueLoaded = true;
          this.applyFilters();
          this.cdr.detectChanges();
        },
        error: () => { s.catalogueItems = []; s.catalogueLoaded = true; this.cdr.detectChanges(); }
      });
    }
    this.cdr.detectChanges();
  }

### 2c. Add CSS for the split nav zone
Add to component styles:
  .bp-sup-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; }
  .bp-sup-card-nav { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; cursor: pointer; }
  .bp-sup-card-nav:active { opacity: 0.7; }
  .bp-sup-expand-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; display: flex; align-items: center; flex-shrink: 0; }

Do the SAME changes to the project suppliers tab component:
  client-angular/src/app/features/projects/pages/project-detail/tabs/suppliers/suppliers.component.ts
  (same template pattern, same toggleExpand method)

---

=================================================================
## STEP 3 — Favourites items: use item card style
=================================================================

In client-angular/src/app/features/favourites/favourites.component.ts

### 3a. Replace the items tab row cards with item card style

Find the ITEMS TAB section and replace the row card with:

  <div class="bp-sup-list">
    <a *ngFor="let f of filtered" class="bp-fav-item-card"
      [routerLink]="['/suppliers', f.ref_id]"
      [queryParams]="{ item: f.ref_id }">
      <div class="bp-fav-item-body">
        <div class="bp-fav-item-name">{{ f.ref_name }}</div>
        <div class="bp-fav-item-supplier" *ngIf="f.supplier_name">{{ f.supplier_name }}</div>
        <div class="bp-fav-item-meta">
          <span class="bp-sup-item-tag" *ngIf="f.ref_category">{{ f.ref_category }}</span>
        </div>
      </div>
      <div class="bp-fav-item-right">
        <div class="bp-fav-item-price" *ngIf="f.ref_price">{{ f.ref_price | gbp }}</div>
        <lucide-icon name="heart" [size]="14" style="color:#E11D48;" [style.fill]="'#E11D48'"></lucide-icon>
        <lucide-icon name="chevron-right" [size]="14" class="bp-row-chev"></lucide-icon>
      </div>
    </a>
  </div>

### 3b. Add CSS to favourites component styles:
  .bp-fav-item-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 0.5px solid var(--color-border); background: #fff; cursor: pointer; text-decoration: none; transition: background 0.15s; }
  .bp-fav-item-card:active { background: var(--color-surface); }
  .bp-fav-item-body { flex: 1; min-width: 0; }
  .bp-fav-item-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 2px; }
  .bp-fav-item-supplier { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
  .bp-fav-item-meta { display: flex; flex-wrap: wrap; gap: 4px; }
  .bp-fav-item-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .bp-fav-item-price { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }

---

ng build
git add .
git commit -m "ux: back arrow in hero, split supplier row tap zones, item card style in favourites"
git push origin dev
