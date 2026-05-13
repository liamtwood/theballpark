import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { SupplierService } from '../../../../../../core/services/supplier.service';
import { OrgService } from '../../../../../../core/services/org.service';
import {
  Project, ProjectCategory, ProjectContext, CatalogueEntity, CategoryInfo,
  Item, ProjectItem
} from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import {
  CatalogueGridComponent
} from '../../../../../../shared/components/catalogue-grid/catalogue-grid.component';
import {
  ItemDrawerComponent, ItemDrawerMode
} from '../../../../../../shared/components/item-drawer/item-drawer.component';

/**
 * Project Marketplace tab — the catalogue-grid browse in project context.
 *
 * v1.18: this is the component that used to live in build.component.ts
 * and serve the "Marketplace" label. The label was previously misrouted
 * via /build, and build.component.ts now hosts the new unified Build
 * tab (compressed cards + estimate summary). All of the project-context
 * + project-cart + drawer wiring from v1.16 / v1.17 lands here unchanged.
 *
 * The grid does the heavy lifting (circles, list/card/table layouts,
 * inline detail panel, search). What this component owns:
 *   - Loading project + project_categories + all categories + all items
 *     in parallel and shaping them for the grid.
 *   - Persisting events the grid emits in project mode:
 *       categoryScopeChange  → projectSvc.setCategoryScope()
 *       projectBriefChange   → projectSvc.update({ raw_brief_text })
 *       categoryBriefChange  → projectSvc.upsertCategory({ requirement_brief })
 *   - Handling the detail-panel + / ♡ / ✎ / 👁 cluster from v1.17.
 */
@Component({
  selector: 'app-marketplace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, LucideAngularModule, ToastModule,
    LoadingSpinnerComponent, CatalogueGridComponent, ItemDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <app-catalogue-grid *ngIf="!loading"
      [entities]="itemEntities"
      [categories]="categories"
      entityType="item"
      entityLabel="item"
      sectionTitle="CATALOGUE"
      actionLabel="View item"
      [projectContext]="projectContext"
      [showEdit]="false"
      [showFavourite]="false"
      [totalCount]="itemEntities.length"
      [projectId]="projectId"
      [projectItems]="projectItems"
      [currentOrgId]="currentOrgId"
      [currentOrgType]="currentOrgType"
      panelContext="project"
      (categoryScopeChange)="onCategoryScopeChange($event)"
      (projectBriefChange)="onProjectBriefChange($event)"
      (categoryBriefChange)="onCategoryBriefChange($event)"
      (viewRequested)="onViewItem($event)"
      (itemEditRequested)="onItemEditRequested($event)"
      (addToProject)="onAddToProject($event)"
      (removeFromProject)="onRemoveFromProject($event)">
    </app-catalogue-grid>

    <!-- Item drawer — view (read-only) and edit (own-org items only).
         v1.17: same component handles both via the [mode] input. -->
    <app-item-drawer
      [(visible)]="showItemDrawer"
      [mode]="drawerMode"
      [item]="drawerItem"
      (saved)="onItemSaved($event)"
      (cancelled)="drawerItem = null">
    </app-item-drawer>

    <p-toast></p-toast>
  `,
  styles: [`:host { display: block; }`]
})
export class MarketplaceComponent implements OnInit {
  loading = true;
  projectContext: ProjectContext | null = null;
  categories: CategoryInfo[] = [];
  itemEntities: CatalogueEntity[] = [];

  /** Raw item rows from the supplier API — keyed by id for fast lookup
      when the detail panel emits view/edit and we need the full Item to
      pass to the drawer. */
  private rawItems: any[] = [];

  // v1.17 project-cart context — bound through to catalogue-grid so the
  // + / ♡ buttons reflect existing selections.
  projectItems: ProjectItem[] = [];
  currentOrgId: string | null = null;
  currentOrgType: string | null = null;

  // v1.17 item drawer state — shared instance handles view + edit.
  showItemDrawer = false;
  drawerMode: ItemDrawerMode = 'view';
  drawerItem: Item | null = null;

  private project: Project | null = null;
  private projectCategories: ProjectCategory[] = [];
  projectId = '';

  constructor(
    private route: ActivatedRoute,
    private projectSvc: ProjectService,
    private projectItemSvc: ProjectItemService,
    private categorySvc: CategoryService,
    private supplierSvc: SupplierService,
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // pid lives on the project-detail route — walk parents until found.
    let r: ActivatedRoute | null = this.route;
    let pid = '';
    while (r && !pid) {
      pid = r.snapshot.paramMap.get('id') || '';
      r = r.parent;
    }
    this.projectId = pid;
    if (!pid) { this.loading = false; return; }

    forkJoin({
      project:    this.projectSvc.getById(pid),
      projectCat: this.projectSvc.getCategories(pid),
      categories: this.categorySvc.getAll('catalogue'),
      items:      this.supplierSvc.getItems({}),
      cart:       this.projectItemSvc.getByProject(pid),
      org:        this.orgSvc.getCurrentOrg()
    }).subscribe({
      next: ({ project, projectCat, categories, items, cart, org }) => {
        this.project = project || null;
        this.projectCategories = (projectCat || []).filter(p => p.is_active);
        this.categories = this.mapCategories(categories || []);
        this.rawItems = items || [];
        this.itemEntities = this.mapItems(this.rawItems);
        this.projectItems = cart || [];
        if (org) {
          this.currentOrgId = org.id;
          this.currentOrgType = org.type || null;
        }
        this.rebuildContext();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── v1.17 detail-panel action handlers ───────────────────────────────

  onViewItem(entity: CatalogueEntity) {
    const raw = this.rawItems.find(i => i.id === entity.id);
    if (!raw) return;
    this.drawerItem = raw as Item;
    this.drawerMode = 'view';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  onItemEditRequested(entity: CatalogueEntity) {
    const raw = this.rawItems.find(i => i.id === entity.id);
    if (!raw) return;
    this.drawerItem = raw as Item;
    this.drawerMode = 'edit';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  onItemSaved(_item: Item) {
    // Refresh the catalogue (a save may have changed images / price /
    // category that the grid needs to re-render).
    this.supplierSvc.getItems({}).subscribe(items => {
      this.rawItems = items || [];
      this.itemEntities = this.mapItems(this.rawItems);
      this.cdr.detectChanges();
    });
    this.drawerItem = null;
  }

  onAddToProject(event: { entity: CatalogueEntity; type: 'selected' | 'liked' }) {
    if (!this.projectId) return;
    // v1.18: pass project_category_id when we can resolve one — find
    // the project_category whose category_id matches the item's
    // category_id (or its parent if drilled). Keeps the Build tab's
    // grouping clean for new selections.
    const itemCatId = (event.entity as any).category_id || event.entity._raw?.category_id;
    const pc = this.findProjectCategoryForItemCategory(itemCatId);
    this.projectItemSvc.add(this.projectId, event.entity.id, event.type, pc?.id).subscribe({
      next: () => this.refreshCart(),
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onRemoveFromProject(event: { entity: CatalogueEntity }) {
    if (!this.projectId) return;
    this.projectItemSvc.remove(this.projectId, event.entity.id).subscribe({
      next: () => this.refreshCart(),
      error: () => this.msg.add({ severity: 'error', summary: 'Remove failed', life: 3000 })
    });
  }

  private refreshCart() {
    this.projectItemSvc.getByProject(this.projectId).subscribe(rows => {
      this.projectItems = rows || [];
      this.cdr.detectChanges();
    });
  }

  /** Walk the category tree to find the project_category that an item
      belongs under. Direct match first, then parent chain. */
  private findProjectCategoryForItemCategory(catId?: string | null): ProjectCategory | undefined {
    if (!catId) return undefined;
    const directMatch = this.projectCategories.find(pc => pc.category_id === catId);
    if (directMatch) return directMatch;
    // Walk up the parent chain — the item may be on a subcategory whose
    // parent is what the project scoped in.
    let current = this.categories.find(c => c.id === catId);
    let guard = 6;
    while (current && current.parent_id && guard-- > 0) {
      const parentMatch = this.projectCategories.find(pc => pc.category_id === current!.parent_id);
      if (parentMatch) return parentMatch;
      current = this.categories.find(c => c.id === current!.parent_id);
    }
    return undefined;
  }

  // ── Catalogue-grid event handlers ────────────────────────────────────
  onCategoryScopeChange(e: { categoryId: string; active: boolean }) {
    this.projectSvc.setCategoryScope(this.projectId, e.categoryId, e.active).subscribe({
      next: () => {
        this.refreshProjectCategories();
        this.msg.add({
          severity: 'success',
          summary: e.active ? 'Category added to project' : 'Category removed from project',
          life: 2000
        });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 });
      }
    });
  }

  onProjectBriefChange(brief: string) {
    this.projectSvc.update(this.projectId, { raw_brief_text: brief }).subscribe({
      next: p => {
        this.project = p || this.project;
        this.rebuildContext();
        this.cdr.detectChanges();
        this.msg.add({ severity: 'success', summary: 'Project brief saved', life: 2000 });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 });
      }
    });
  }

  onCategoryBriefChange(e: { categoryId: string; brief: string }) {
    this.projectSvc.upsertCategory(this.projectId, e.categoryId, { requirement_brief: e.brief }).subscribe({
      next: () => {
        this.refreshProjectCategories();
        this.msg.add({ severity: 'success', summary: 'Brief saved', life: 2000 });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 });
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  private refreshProjectCategories() {
    this.projectSvc.getCategories(this.projectId).subscribe(rows => {
      this.projectCategories = (rows || []).filter(p => p.is_active);
      this.rebuildContext();
      this.cdr.detectChanges();
    });
  }

  private rebuildContext() {
    this.projectContext = {
      projectId: this.projectId,
      projectBrief: this.project?.raw_brief_text || '',
      projectCategories: this.projectCategories
    };
  }

  /** Mirror the marketplace's categories shaping so the grid sees the
      same fields (cover_image_url, icon_name, description, etc). */
  private mapCategories(raw: any[]): CategoryInfo[] {
    return raw
      .filter((c: any) => c.enabled !== false)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        cover_image_url: c.cover_image_url,
        logo_url: c.logo_url,
        icon_name: c.icon_name,
        icon_color: c.icon_color,
        parent_id: c.parent_id || undefined,
        tagline: c.tagline,
        description: c.description,
        model: c.model || 'A'
      }));
  }

  /** Mirror supplier-list.mapItems() so the grid renders rows the same
      way as the marketplace catalogue. */
  private mapItems(raw: any[]): CatalogueEntity[] {
    return (raw || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      image_url: i.image_url,
      external_url: i.external_url,
      cover_image_url: i.supplier_cover_url,
      image_display: i.image_url ? (i.image_display || 'cover') : (i.supplier_image_display || 'cover'),
      subtitle: i.supplier_name,
      category_id: i.category_id,
      price: i.base_price ? Number(i.base_price) : undefined,
      priceRange: i.min_price && i.max_price ? { min: Number(i.min_price), max: Number(i.max_price) } : undefined,
      unit: i.unit,
      categoryLabel: i.category_name,
      specs: i.lead_time_days ? [{ label: 'Lead time', value: `${i.lead_time_days} working days` }] : [],
      parentEntity: i.supplier_name ? {
        id: i.org_id,
        name: i.supplier_name,
        subtitle: i.supplier_city,
        image_url: i.supplier_cover_url
      } : undefined,
      _raw: i
    }));
  }
}
