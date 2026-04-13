import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../../core/services/category.service';
import { Category, CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, CatalogueGridComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <app-catalogue-grid
        [entities]="feedbackEntities"
        [categories]="parentCategories"
        entityType="feedback"
        entityLabel="feedback entry"
        sectionTitle="FEEDBACK"
        actionLabel="View"
        [favouriteIds]="emptySet"
        [showEdit]="false"
        [showFavourite]="false"
        [totalCount]="feedbackEntities.length"
        (entitySelected)="onEntitySelected($event)">
      </app-catalogue-grid>

      <div *ngIf="!feedbackEntities.length && !loading" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries yet. Feedback logged during sessions will appear here.</p>
      </div>
    </ng-container>
  `,
  styles: [`
    .bp-empty-state {
      text-align: center;
      padding: 48px 24px;
    }
  `]
})
export class FeedbackComponent implements OnInit {
  loading = true;
  allCategories: Category[] = [];
  parentCategories: CategoryInfo[] = [];
  feedbackEntities: CatalogueEntity[] = [];
  emptySet = new Set<string>();

  constructor(
    private catSvc: CategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.catSvc.getAll('feedback').subscribe({
      next: (cats) => {
        this.allCategories = cats || [];
        this.buildGrid();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildGrid() {
    const parents = this.allCategories.filter(c => !c.parent_id);
    const children = this.allCategories.filter(c => !!c.parent_id);

    this.parentCategories = parents.map(p => ({
      id: p.id,
      name: p.name,
      cover_image_url: p.cover_image_url,
      count: children.filter(c => c.parent_id === p.id).length
    }));

    // Show child categories as entities in the grid
    this.feedbackEntities = children.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      category_id: c.parent_id,
      categoryLabel: parents.find(p => p.id === c.parent_id)?.name,
      subtitle: parents.find(p => p.id === c.parent_id)?.tagline || ''
    }));
  }

  onEntitySelected(_entity: CatalogueEntity) {}
}
