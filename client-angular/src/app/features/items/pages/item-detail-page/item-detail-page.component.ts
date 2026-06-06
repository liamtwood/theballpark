import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, ChevronLeft, ChevronRight, Heart, Plus, SquarePen, Share2, MapPin } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { marked } from 'marked';

import { ItemService } from '../../../../core/services/item.service';
import { SupplierService } from '../../../../core/services/supplier.service';
import { OrgService } from '../../../../core/services/org.service';
import { CategoryService } from '../../../../core/services/category.service';
import { CodelistService } from '../../../../core/services/codelist.service';
import { ProjectItemService } from '../../../../core/services/project-item.service';
import { FavouriteService } from '../../../../core/services/favourite.service';
import { ProjectService } from '../../../../core/services/project.service';
import { ConfigService } from '../../../../core/services/config.service';
import { ShellContextService } from '../../../../core/services/shell-context.service';
import { OutreachService } from '../../../../core/services/outreach.service';
import { PersonaService } from '../../../../core/services/persona.service';
import { MarketplaceProjectService, MarketplaceProject } from '../../../../core/services/marketplace-project.service';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ItemDrawerComponent } from '../../../../shared/components/item-drawer/item-drawer.component';
import { MarketplaceProjectPickerComponent } from '../../../../shared/components/marketplace-project-picker/marketplace-project-picker.component';
import { Item, Org, Project } from '../../../../models';

@Component({
  selector: 'app-item-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, ToastModule, LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ItemDrawerComponent,
    MarketplaceProjectPickerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <!-- NOT FOUND -->
    <ng-container *ngIf="!loading && !item">
      <div class="bp-itempage-empty">
        <p>Item not found.</p>
        <a routerLink="/shop">← Back to {{ catalogueLabel }}</a>
      </div>
    </ng-container>

    <!-- ITEM CONTENT — v1.66cy: full-width gallery on top, then a two-card
         layout (details + Ballpark Pricing) matching the client mockup. The
         shell hero above shows the navigation context (project / supplier /
         marketplace). -->
    <div class="bp-itempage" *ngIf="!loading && item">

      <!-- Back link -->
      <a class="bp-itempage-back" (click)="goBack()">
        <lucide-icon name="chevron-left" [size]="12"></lucide-icon>
        Back
      </a>

      <!-- ═══ Gallery (full-width, standard rounding) ═══ -->
      <div class="bp-itempage-gallery">
        <div class="bp-itempage-hero" [class.bp-itempage-hero--empty]="!galleryImages.length">
          <ng-container *ngIf="galleryImages.length; else heroPlaceholder">
            <img [src]="galleryImages[currentImg]" alt="" />
          </ng-container>
          <ng-template #heroPlaceholder>
            <div class="bp-itempage-hero-initial">{{ (item.name || '?').charAt(0) }}</div>
          </ng-template>
          <ng-container *ngIf="galleryImages.length > 1">
            <button class="bp-itempage-nav bp-itempage-nav--prev" (click)="prevImg()" title="Previous">
              <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
            </button>
            <button class="bp-itempage-nav bp-itempage-nav--next" (click)="nextImg()" title="Next">
              <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
            </button>
            <span class="bp-itempage-counter">{{ currentImg + 1 }} / {{ galleryImages.length }}</span>
          </ng-container>
        </div>
        <div class="bp-itempage-thumbs" *ngIf="galleryImages.length > 1">
          <button *ngFor="let url of galleryImages; let i = index"
            class="bp-itempage-thumb"
            [class.active]="i === currentImg"
            (click)="selectImg(i)">
            <img [src]="url" alt="" />
          </button>
        </div>
      </div>

      <!-- ═══ Two-card content ═══ -->
      <div class="bp-itempage-cards">

        <!-- LEFT: details -->
        <div class="bp-itempage-card">
          <span class="bp-itempage-pill" *ngIf="item.category_name">{{ item.category_name }}</span>
          <h1 class="bp-itempage-name">{{ item.name }}</h1>
          <div class="bp-itempage-meta">
            <span class="bp-itempage-meta-item" *ngIf="locationLabel">
              <lucide-icon name="map-pin" [size]="14"></lucide-icon>{{ locationLabel }}
            </span>
            <span class="bp-itempage-meta-item" *ngIf="leadTimeLabel() !== '—'">
              <lucide-icon name="clock" [size]="14"></lucide-icon>{{ leadTimeLabel() }}
            </span>
          </div>

          <!-- About = the supplier (org) description -->
          <ng-container *ngIf="supplier?.description">
            <hr class="bp-itempage-rule" />
            <h2 class="bp-itempage-h">About</h2>
            <p class="bp-itempage-prose">{{ supplier?.description }}</p>
          </ng-container>

          <!-- Services — left unmapped for now (no item field yet). -->
        </div>

        <!-- RIGHT: Ballpark Pricing -->
        <div class="bp-itempage-card bp-itempage-card--price">
          <div class="bp-itempage-price-eyebrow">Ballpark Pricing</div>
          <div class="bp-itempage-from" *ngIf="fromPrice != null">From {{ fromPrice | gbp:0:true }}</div>

          <button class="bp-itempage-add" (click)="addToProject()">
            <lucide-icon name="plus" [size]="16"></lucide-icon> Add to Project
          </button>
          <button class="bp-itempage-edit" *ngIf="isOwner" (click)="openEdit()">
            <lucide-icon name="square-pen" [size]="14"></lucide-icon> Edit
          </button>

          <!-- What's included = the item's own description -->
          <ng-container *ngIf="item.description">
            <hr class="bp-itempage-rule" />
            <div class="bp-itempage-included-label">What's included:</div>
            <div class="bp-itempage-included" [innerHTML]="descriptionHtml"></div>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- ITEM EDIT DRAWER (reused) — v1.36 explicitly mounted in edit
         mode. Default mode on the drawer is 'add', so without this the
         ✎ button was opening the new-item form instead of editing. -->
    <app-item-drawer
      [(visible)]="showEditDrawer"
      [mode]="'edit'"
      [item]="item"
      (saved)="onItemSaved($event)"
      (cancelled)="showEditDrawer = false">
    </app-item-drawer>

    <app-marketplace-project-picker
      [(visible)]="pickerOpen"
      [activeId]="projectId || null"
      (picked)="onProjectPicked($event)">
    </app-marketplace-project-picker>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }

    .bp-itempage { max-width: 1100px; margin: 0 auto; padding: 24px var(--section-pad); }
    .bp-itempage-empty {
      text-align: center; padding: 80px 0; color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    .bp-itempage-empty a { color: var(--theme-accent); display: inline-block; margin-top: 8px; }

    /* Back link */
    .bp-itempage-back {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); color: var(--color-text-muted);
      cursor: pointer; margin-bottom: 16px; text-decoration: none;
      transition: color 0.15s;
    }
    .bp-itempage-back:hover { color: var(--theme-accent); }

    /* ── Gallery (full-width, standard rounding) ── */
    .bp-itempage-gallery { margin-bottom: 22px; }
    .bp-itempage-hero {
      width: 100%; height: 460px;
      border-radius: var(--radius-card-lg);
      overflow: hidden;
      background: var(--color-surface);
      border: var(--border-hairline);
      margin-bottom: 12px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .bp-itempage-hero img { width: 100%; height: 100%; object-fit: cover; }
    .bp-itempage-hero-initial {
      font-family: var(--font-display); font-size: 80px;
      color: var(--color-text-muted);
    }
    .bp-itempage-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--color-text-muted);
      transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .bp-itempage-nav:hover { color: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-itempage-nav--prev { left: 14px; }
    .bp-itempage-nav--next { right: 14px; }
    .bp-itempage-counter {
      position: absolute; bottom: 12px; right: 12px;
      background: rgba(0,0,0,0.6); color: #fff;
      font-size: 10px; padding: 2px 8px;
      border-radius: var(--radius-pill);
    }
    .bp-itempage-thumbs { display: flex; gap: 10px; flex-wrap: wrap; }
    .bp-itempage-thumb {
      width: 112px; height: 80px; padding: 0;
      border-radius: var(--radius-card); overflow: hidden;
      cursor: pointer; border: 2px solid transparent;
      transition: border-color 0.15s;
      background: var(--color-surface); flex-shrink: 0;
    }
    .bp-itempage-thumb.active { border-color: var(--theme-accent); }
    .bp-itempage-thumb:hover { border-color: var(--theme-accent); }
    .bp-itempage-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* ── Two-card content ── */
    .bp-itempage-cards {
      display: grid; grid-template-columns: 1.7fr 1fr; gap: 24px; align-items: start;
    }
    .bp-itempage-card {
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card-lg);
      box-shadow: var(--shadow-xs);
      padding: 32px;
    }
    .bp-itempage-card--price { position: sticky; top: 20px; }

    /* Category pill — soft accent chip (standard). */
    .bp-itempage-pill {
      display: inline-block; padding: 5px 14px; border-radius: var(--radius-pill);
      background: var(--theme-soft); color: var(--theme-accent);
      font-size: 12px; font-weight: 600; font-family: var(--font-body);
      margin-bottom: 14px;
    }
    .bp-itempage-name {
      font-family: var(--font-display); font-size: 38px; font-weight: 400;
      line-height: 1.1; margin: 0 0 14px; color: var(--color-text-primary);
    }
    .bp-itempage-meta {
      display: flex; flex-wrap: wrap; gap: 18px;
      font-size: 14px; color: var(--color-text-muted); font-family: var(--font-body);
    }
    .bp-itempage-meta-item { display: inline-flex; align-items: center; gap: 6px; }
    .bp-itempage-rule { border: none; border-top: var(--border-hairline); margin: 26px 0; }
    .bp-itempage-h {
      font-family: var(--font-display); font-size: 22px; font-weight: 400;
      margin: 0 0 12px; color: var(--color-text-primary);
    }
    .bp-itempage-prose { font-size: 15px; line-height: 1.7; color: var(--color-text-secondary); margin: 0; }

    /* Pricing card */
    .bp-itempage-price-eyebrow { font-size: 13px; color: var(--color-text-muted); margin-bottom: 8px; font-family: var(--font-body); }
    .bp-itempage-from {
      font-family: var(--font-body); font-weight: 400; font-size: 36px; line-height: 1; margin-bottom: 22px;
      background: var(--grad-accent); -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: transparent;
    }
    .bp-itempage-add {
      width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 14px; border: none; border-radius: var(--radius-pill);
      background: var(--grad-accent); color: #fff; cursor: pointer;
      font-size: 15px; font-weight: 600; font-family: var(--font-body);
      box-shadow: 0 2px 10px rgba(var(--theme-accent-rgb), 0.25);
      transition: box-shadow 0.18s ease, transform 0.18s ease;
    }
    .bp-itempage-add:hover { box-shadow: 0 6px 18px rgba(var(--theme-accent-rgb), 0.32); }
    .bp-itempage-add:active { transform: translateY(1px); }
    .bp-itempage-edit {
      width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 10px; padding: 11px;
      border: var(--border-hairline); background: var(--color-surface); color: var(--color-text-secondary);
      border-radius: var(--radius-button); cursor: pointer;
      font-size: 13px; font-weight: 500; font-family: var(--font-body);
      transition: border-color 0.15s, color 0.15s;
    }
    .bp-itempage-edit:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-itempage-included-label { font-size: 13px; color: var(--color-text-muted); margin-bottom: 12px; font-family: var(--font-body); }
    .bp-itempage-included { font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); }
    .bp-itempage-included :first-child { margin-top: 0; }
    .bp-itempage-included p { margin: 0 0 8px; }
    .bp-itempage-included ul, .bp-itempage-included ol { margin: 0 0 8px 18px; }
    .bp-itempage-included li { margin-bottom: 5px; }

    /* Responsive */
    @media (max-width: 768px) {
      .bp-itempage-cards { grid-template-columns: 1fr; gap: 16px; }
      .bp-itempage-card--price { position: static; }
      .bp-itempage-card { padding: 24px; }
      .bp-itempage-hero { height: 300px; }
    }
  `]
})
export class ItemDetailPageComponent implements OnInit, OnDestroy {
  item: Item | null = null;
  supplier: Org | null = null;
  related: Item[] = [];
  galleryImages: string[] = [];
  currentImg = 0;
  isFav = false;
  loading = true;
  showEditDrawer = false;
  descriptionHtml: SafeHtml = '';
  catalogueLabel = 'catalogue';
  /** True when the viewer is the supplier that owns this item — gates Edit. */
  isOwner = false;
  /** Project picker state + a pending add queued until a project is chosen. */
  pickerOpen = false;
  private pendingAdd = false;
  /** Active project for Add to Project — ?projectId= or the session project.
      Public so the picker template can read it for the active tick. */
  projectId = '';
  /** v1.36: navigation context driven by ?context= query.
      'project'    → render project hero (name + client/venue pills + tabs)
      'supplier'   → render shop front hero (supplier name + city)
      'marketplace'→ render marketplace hero (platform name + CATALOGUE)
      Default: 'marketplace' when no context (direct URL navigation). */
  private context: 'project' | 'supplier' | 'marketplace' = 'marketplace';
  private supplierContextId = '';
  /** Cached project/supplier needed for the hero. */
  private contextProject: Project | null = null;
  private contextSupplier: Org | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private itemSvc: ItemService,
    private supplierSvc: SupplierService,
    private orgSvc: OrgService,
    private categorySvc: CategoryService,
    private codelistSvc: CodelistService,
    private projectItemSvc: ProjectItemService,
    private favSvc: FavouriteService,
    private projectSvc: ProjectService,
    private configSvc: ConfigService,
    private shellCtx: ShellContextService,
    private outreach: OutreachService,
    private personaSvc: PersonaService,
    private marketProjectSvc: MarketplaceProjectService,
    private msg: MessageService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const qp = this.route.snapshot.queryParams;
    // Active project: explicit ?projectId= wins, else the session "shopping
    // for" project (shared with the marketplaces) so Add to Project has a
    // target without re-asking.
    this.projectId = qp['projectId'] || this.marketProjectSvc.current?.id || '';
    this.supplierContextId = qp['supplierId'] || '';
    const ctx = qp['context'];
    this.context = (ctx === 'project' || ctx === 'supplier' || ctx === 'marketplace')
      ? ctx
      : 'marketplace';

    this.codelistSvc.getByName('item_unit').subscribe(() => this.cdr.markForCheck());
    this.codelistSvc.getByName('item_time_unit').subscribe(() => this.cdr.markForCheck());

    // Kick off context fetch in parallel with item load so the hero
    // can be applied as soon as either resolves.
    this.loadContext();

    this.route.params.subscribe(params => {
      const id = params['id'];
      if (!id) { this.loading = false; this.cdr.markForCheck(); return; }
      this.loadItem(id);
    });
  }

  /** v1.36: fetch whatever the context hero needs (project for project
      context, supplier for supplier context, nothing for marketplace),
      then push the hero into ShellContextService. */
  private loadContext() {
    if (this.context === 'project' && this.projectId) {
      this.projectSvc.getById(this.projectId).pipe(
        catchError(() => of(null as Project | null))
      ).subscribe(p => {
        this.contextProject = p;
        this.applyShellHero();
      });
    } else if (this.context === 'supplier' && this.supplierContextId) {
      this.orgSvc.getById(this.supplierContextId).pipe(
        catchError(() => of(null as Org | null))
      ).subscribe(s => {
        this.contextSupplier = s;
        this.applyShellHero();
      });
    } else {
      // marketplace context (or fallback): no fetch needed, push hero now.
      this.applyShellHero();
    }
  }

  private loadItem(id: string) {
    this.loading = true;
    this.itemSvc.getById(id).pipe(
      catchError(() => of(null as Item | null))
    ).subscribe(item => {
      this.item = item;
      if (!item) { this.loading = false; this.cdr.markForCheck(); return; }

      this.galleryImages = this.buildGallery(item);
      this.currentImg = 0;
      this.descriptionHtml = this.renderDescription(item.description);
      this.isFav = this.favSvc.isItemFavourited(item.id);
      // Owner = the viewing supplier persona owns this item's org.
      const myOrgId = this.personaSvc.isSupplier()
        ? this.personaSvc.active?.supplierOrgId
        : null;
      this.isOwner = !!item.org_id && !!myOrgId && myOrgId === item.org_id;

      const supplier$ = item.org_id
        ? this.orgSvc.getById(item.org_id).pipe(catchError(() => of(null as Org | null)))
        : of(null as Org | null);
      const related$ = item.category_id
        ? this.supplierSvc.getItems({ category_id: item.category_id }).pipe(catchError(() => of([])))
        : of([]);

      forkJoin({ supplier: supplier$, related: related$ }).subscribe(({ supplier, related }) => {
        this.supplier = supplier;
        this.related = (related || [])
          .filter((r: any) => r.id !== item.id)
          .slice(0, 4);
        this.loading = false;
        this.cdr.markForCheck();
      });
    });
  }

  /** v1.36: render the hero of whichever surface navigated us here so
      the user keeps their bearings (and the project tab bar / supplier
      identity stays visible). Item name lives in the page body now. */
  private applyShellHero() {
    if (this.context === 'project' && this.contextProject) {
      const p = this.contextProject;
      const pills: string[] = [];
      if ((p as any).client_name) pills.push((p as any).client_name);
      if ((p as any).venue_name)  pills.push((p as any).venue_name);
      this.shellCtx.set({
        heroTitle: (p as any).event_name || p.name || 'Untitled',
        heroSub: 'MARKETPLACE',
        pills,
        // v1.65cg (p0005) — Brief tab removed (Plan/Brief deleted, AI
        // matching + per-category brief editing both live on the
        // Marketplace now). Tab set mirrors project-detail's three.
        tabs: [
          { label: 'Overview',    path: `/projects/${this.projectId}/overview` },
          { label: 'Marketplace', path: `/projects/${this.projectId}/marketplace` },
          { label: 'Inbox',       path: `/projects/${this.projectId}/messages` }
        ]
      });
    } else if (this.context === 'supplier' && this.contextSupplier) {
      this.shellCtx.set({
        heroTitle: this.contextSupplier.name,
        heroSub: (this.contextSupplier.city || 'London').toUpperCase(),
        pills: [],
        tabs: []
      });
    } else {
      // Marketplace (default).
      this.shellCtx.set({
        heroTitle: this.configSvc.platformName,
        heroSub: this.configSvc.catalogueLabel.toUpperCase(),
        pills: [],
        tabs: []
      });
    }
  }

  private buildGallery(item: Item): string[] {
    if (item.images && item.images.length) {
      return [...item.images]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(i => i.url)
        .filter(Boolean);
    }
    if (item.image_url) return [item.image_url];
    return [];
  }

  private renderDescription(md?: string): SafeHtml {
    if (!md) return '';
    const html = marked.parse(md, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  selectImg(idx: number) { this.currentImg = idx; this.cdr.markForCheck(); }
  nextImg() { this.currentImg = (this.currentImg + 1) % this.galleryImages.length; this.cdr.markForCheck(); }
  prevImg() {
    this.currentImg = (this.currentImg - 1 + this.galleryImages.length) % this.galleryImages.length;
    this.cdr.markForCheck();
  }

  tierLabel(tier?: string | null): string {
    if (!tier) return '';
    const fromCodelist = this.codelistSvc.getLabel('item_tier', tier);
    if (fromCodelist && fromCodelist !== tier) return fromCodelist;
    return ({ basic: 'Core', mid: 'Signature', premium: 'Premium' } as Record<string, string>)[tier] || tier;
  }

  unitLabel(unit?: string | null): string {
    if (!unit) return '';
    return this.codelistSvc.getDisplay(unit, ['item_unit']) || unit;
  }

  timeUnitLabel(): string {
    if (!this.item?.time_unit) return '—';
    return this.codelistSvc.getDisplay(this.item.time_unit, ['item_time_unit']) || this.item.time_unit;
  }

  leadTimeLabel(): string {
    const days = this.item?.lead_time_days;
    if (!days && days !== 0) return '—';
    if (days % 7 === 0 && days >= 7) {
      const weeks = days / 7;
      return `${weeks} week${weeks === 1 ? '' : 's'}`;
    }
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  supplierInitials(): string {
    const name = this.supplier?.name || '';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
  }

  shortUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40);
  }

  supplierNameOf(item: Item): string {
    return (item as any)?.supplier_name || (item as any)?.org_name || '';
  }

  /** v1.36: when the user clicks a related item, carry the same context
      forward so the hero stays consistent (project → project, supplier
      → supplier, etc.) rather than reverting to marketplace default. */
  relatedQueryParams(): Record<string, string> {
    const out: Record<string, string> = { context: this.context };
    if (this.projectId) out['projectId'] = this.projectId;
    if (this.supplierContextId) out['supplierId'] = this.supplierContextId;
    return out;
  }

  /** "From" price — the floor (min_price), falling back to the ballpark. */
  get fromPrice(): number | null {
    if (!this.item) return null;
    return this.item.min_price ?? this.item.base_price ?? null;
  }

  /** Location line — the supplier's city. */
  get locationLabel(): string {
    return this.supplier?.city || '';
  }

  addToProject() {
    if (!this.item) return;
    if (!this.projectId) {
      // No project chosen yet — open the picker and add once one is picked.
      this.pendingAdd = true;
      this.pickerOpen = true;
      this.cdr.markForCheck();
      return;
    }
    this.projectItemSvc.add(this.projectId, this.item.id, 'selected').subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Added to project' }),
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add item' })
    });
  }

  /** Project picked from the dialog — remember for the session, then flush a
      pending add if the picker was opened by Add to Project. */
  onProjectPicked(p: MarketplaceProject | null) {
    this.marketProjectSvc.set(p);
    this.projectId = p?.id || '';
    const pending = this.pendingAdd;
    this.pendingAdd = false;
    if (p && pending) this.addToProject();
    this.cdr.markForCheck();
  }

  toggleWishlist() {
    if (!this.item) return;
    if (this.projectId) {
      this.projectItemSvc.add(this.projectId, this.item.id, 'liked').subscribe({
        next: () => {
          this.isFav = true;
          this.msg.add({ severity: 'success', summary: 'Wishlisted' });
          this.cdr.markForCheck();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Could not wishlist' })
      });
      return;
    }
    this.favSvc.toggleItem(this.item.id).subscribe({
      next: result => {
        this.isFav = result.favourited;
        this.msg.add({ severity: 'success', summary: result.favourited ? 'Wishlisted' : 'Removed from wishlist' });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not update wishlist' })
    });
  }

  openEdit() { this.showEditDrawer = true; }

  /** v1.51a — Request-quote outreach. Only available inside a project
      context (you need a project to send a quote request from). */
  get canRequestQuote(): boolean { return !!this.projectId && !!this.item; }

  requestQuote() {
    if (!this.item || !this.projectId) return;
    // v1.52a — requesting a quote implies selecting the item.
    this.addToProject();
    this.outreach.open({
      item: {
        item_id:     this.item.id,
        name:        this.item.name,
        description: this.item.description,
        price:       this.item.base_price ?? null,
        isNew:       false
      },
      categoryId: this.item.category_id || '',
      projectId:  this.projectId
    });
  }

  /** v1.45a — the item's structured tags grouped by dimension, for the
      read-only Attributes section. */
  get attributeGroups(): { dimension: string; labels: string[] }[] {
    const tags: Array<{ dimension: string; label: string }> =
      (this.item && (this.item as any).item_tags) || [];
    const order: string[] = [];
    const map = new Map<string, string[]>();
    for (const t of tags) {
      if (!map.has(t.dimension)) { map.set(t.dimension, []); order.push(t.dimension); }
      map.get(t.dimension)!.push(t.label);
    }
    return order.map(d => ({ dimension: d, labels: map.get(d)! }));
  }

  onItemSaved(updated: Item) {
    if (updated) {
      this.item = { ...this.item, ...updated };
      this.galleryImages = this.buildGallery(this.item);
      this.descriptionHtml = this.renderDescription(this.item.description);
      this.currentImg = 0;
      this.cdr.markForCheck();
    }
    // v1.43 — do NOT force the drawer shut here: after a save it stays
    // open to show the AI classification panel and self-closes once the
    // supplier accepts / edits / skips it.
  }

  copyLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => this.msg.add({ severity: 'success', summary: 'Link copied' }),
        () => this.msg.add({ severity: 'error', summary: 'Could not copy link' })
      );
    } else {
      this.msg.add({ severity: 'info', summary: url });
    }
  }

  /** v1.36: history.back() per spec. Falls back to a context-sensible
      URL when there's no SPA history (direct URL navigation):
        project   → /projects/:id/marketplace
        supplier  → /suppliers/:id
        marketplace (or unknown) → /suppliers */
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (this.context === 'project' && this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'marketplace']);
    } else if (this.context === 'supplier' && this.supplierContextId) {
      this.router.navigate(['/suppliers', this.supplierContextId]);
    } else {
      this.router.navigate(['/shop']);
    }
  }

  ngOnDestroy() {
    // Clear the hero context so the next page (which may not call set())
    // doesn't inherit the item-detail title/back button.
    this.shellCtx.reset();
  }
}
