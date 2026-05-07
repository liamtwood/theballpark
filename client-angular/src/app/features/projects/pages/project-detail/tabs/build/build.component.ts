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
import { CategoryService } from '../../../../../../core/services/category.service';
import { SupplierService } from '../../../../../../core/services/supplier.service';
import {
  Project, ProjectCategory, ProjectContext, CatalogueEntity, CategoryInfo
} from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import {
  CatalogueGridComponent
} from '../../../../../../shared/components/catalogue-grid/catalogue-grid.component';

/**
 * Project Build tab — reuses CatalogueGridComponent in project context.
 *
 * The grid does the heavy lifting (circles, list/card/table layouts,
 * inline detail panel, search). What this component owns:
 *   - Loading project + project_categories + all categories + all items
 *     in parallel and shaping them for the grid.
 *   - Persisting events that the grid emits in project mode:
 *       categoryScopeChange  → projectSvc.setCategoryScope()
 *       projectBriefChange   → projectSvc.update({ raw_brief_text })
 *       categoryBriefChange  → projectSvc.upsertCategory({ requirement_brief })
 *
 * Categories not currently scoped to the project render greyed in the
 * circle strip. Clicking a greyed circle scopes it in (soft toggle) so
 * any prior requirement_brief survives.
 */
@Component({
  selector: 'app-build',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, LucideAngularModule, ToastModule,
    LoadingSpinnerComponent, CatalogueGridComponent
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
      (categoryScopeChange)="onCategoryScopeChange($event)"
      (projectBriefChange)="onProjectBriefChange($event)"
      (categoryBriefChange)="onCategoryBriefChange($event)">
    </app-catalogue-grid>

    <p-toast></p-toast>
  `,
  styles: [`:host { display: block; }`]
})
export class BuildComponent implements OnInit {
  loading = true;
  projectContext: ProjectContext | null = null;
  categories: CategoryInfo[] = [];
  itemEntities: CatalogueEntity[] = [];

  private project: Project | null = null;
  private projectCategories: ProjectCategory[] = [];
  private projectId = '';

  constructor(
    private route: ActivatedRoute,
    private projectSvc: ProjectService,
    private categorySvc: CategoryService,
    private supplierSvc: SupplierService,
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
      items:      this.supplierSvc.getItems({})
    }).subscribe({
      next: ({ project, projectCat, categories, items }) => {
        this.project = project || null;
        this.projectCategories = (projectCat || []).filter(p => p.is_active);
        this.categories = this.mapCategories(categories || []);
        this.itemEntities = this.mapItems(items || []);
        this.rebuildContext();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
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
