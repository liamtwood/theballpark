import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { LucideAngularModule } from 'lucide-angular';

/**
 * inbox-v2 — shared, reusable inbox shell.
 *
 * p0037: hero layer (rendered globally by app-shell from route data).
 * p0038: search row + three-column body shell + empty 3-deep tree rail
 *        (project → supplier → item-thread) using the marketplace's global
 *        `.bp-cat-*` rail classes. NO data is loaded yet — `projectTree` is
 *        empty so the rail renders zero rows; the right pane shows an
 *        empty-state placeholder. Chrome flags gate each layer; handlers are
 *        stubs until the data prompt.
 *
 * Living spec: features/messages/inbox-v2.schematic.yaml
 */

export interface ItemThreadNode {
  itemId: string;
  itemName: string;
  latestSnippet: string;
  timestamp: string;   // pre-formatted relative string for now
  unreadCount: number;
}
export interface SupplierNode {
  supplierId: string;
  supplierName: string;
  threadCount: number;
  itemThreads: ItemThreadNode[];
}
export interface ProjectNode {
  projectId: string;
  projectName: string;
  threadCount: number;
  suppliers: SupplierNode[];
}

@Component({
  selector: 'app-messages-inbox-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Bare LucideAngularModule: icon names resolve from the global ICON_REGISTRY
  // (app.config.ts). `.pick()` returns a ModuleWithProviders, which Angular
  // rejects in a standalone component's imports — this is the codebase pattern
  // (action-tile / home-launcher / messages-inbox v1 all use the bare module).
  imports: [
    CommonModule, FormsModule, InputTextModule,
    LucideAngularModule,
  ],
  template: `
    <div class="bp-inbox-v2" [class.bp-inbox-v2--compact]="compact">

      <!-- Search row (gated) -->
      <div class="bp-search-row" *ngIf="showSearchRow">
        <lucide-icon name="search" [size]="14" class="bp-search-icon"></lucide-icon>
        <input pInputText
               [(ngModel)]="searchTerm"
               (ngModelChange)="onSearchChange()"
               placeholder="Search threads, suppliers, items..."
               class="bp-search-input"/>
        <button type="button" class="bp-search-filter-btn"
                *ngIf="showFilterDrawer"
                [class.active]="filterOpen"
                (click)="filterOpen = !filterOpen"
                title="Filters">
          <lucide-icon name="list-filter" [size]="15"></lucide-icon>
          <span class="bp-search-filter-count" *ngIf="activeFilterCount()">{{ activeFilterCount() }}</span>
        </button>
      </div>

      <!-- Three-column body shell -->
      <div class="bp-cat-body bp-cat-body--cats-left">

        <!-- LEFT: tree rail (gated) -->
        <div class="bp-cat-sidebar" *ngIf="showTreeRail">
          <div class="bp-cat-sidebar-head">
            <lucide-icon name="messages-square" [size]="13" class="bp-cat-sidebar-head-icon"></lucide-icon>
            <div class="bp-filter-title">Project conversations</div>
          </div>
          <div class="bp-cat-sidebar-body">
            <div class="bp-cat-rail">
              <!-- Empty state: rail renders nothing while projectTree is empty -->
              <ng-container *ngFor="let project of projectTree">
                <button type="button" class="bp-cat-rail-item"
                        [class.active]="expandedProjectIds.has(project.projectId)"
                        (click)="toggleProject(project.projectId)">
                  <span class="bp-cat-rail-icon">
                    <lucide-icon name="folder" [size]="16" [strokeWidth]="1.5"></lucide-icon>
                  </span>
                  <span class="bp-cat-rail-text">
                    <span class="bp-cat-rail-name">{{ project.projectName }}</span>
                    <span class="bp-cat-rail-count" *ngIf="project.threadCount">{{ project.threadCount }}</span>
                  </span>
                  <lucide-icon [name]="expandedProjectIds.has(project.projectId) ? 'chevron-down' : 'chevron-right'"
                               [size]="15" class="bp-cat-rail-chev"></lucide-icon>
                </button>

                <div class="bp-cat-rail-subs" *ngIf="expandedProjectIds.has(project.projectId)">
                  <ng-container *ngFor="let supplier of project.suppliers">
                    <button type="button" class="bp-cat-rail-sub"
                            (click)="toggleSupplier(supplier.supplierId)">
                      {{ supplier.supplierName }}
                      <span *ngIf="supplier.threadCount">({{ supplier.threadCount }})</span>
                    </button>

                    <ng-container *ngIf="expandedSupplierIds.has(supplier.supplierId)">
                      <button type="button" class="bp-cat-rail-sub-sub"
                              *ngFor="let thread of supplier.itemThreads"
                              [class.active]="selectedItemId === thread.itemId"
                              (click)="selectItem(thread.itemId)">
                        {{ thread.itemName }}
                      </button>
                    </ng-container>
                  </ng-container>
                </div>
              </ng-container>
            </div>
          </div>
        </div>

        <!-- RIGHT: thread pane (empty placeholder for now) -->
        <div class="bp-inbox-v2-thread-pane">
          <div class="bp-inbox-v2-empty">
            Select a thread to view.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp-inbox-v2 {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .bp-inbox-v2--compact { padding: 12px; }

    .bp-inbox-v2-thread-pane {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }
    .bp-inbox-v2-empty {
      color: var(--color-text-secondary);
      font-size: 14px;
    }
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
  @Input() showItemPreview = true;   // p0038 — declared for the item-preview layer (not consumed yet)
  @Input() compact = false;

  // EVENTS
  @Output() threadSelected = new EventEmitter<string>();
  @Output() messageSent = new EventEmitter<any>();

  // STATE (p0038 — shell only; data loading comes later)
  searchTerm = '';
  filterOpen = false;             // stays false — filter drawer comes later
  projectTree: ProjectNode[] = []; // empty for now
  expandedProjectIds = new Set<string>();
  expandedSupplierIds = new Set<string>();
  selectedItemId: string | null = null;

  // HANDLERS (stubs — template hooks, no data logic yet)
  onSearchChange(): void { /* debounced filter — comes with data prompt */ }

  toggleProject(id: string): void {
    this.expandedProjectIds.has(id)
      ? this.expandedProjectIds.delete(id)
      : this.expandedProjectIds.add(id);
  }

  toggleSupplier(id: string): void {
    this.expandedSupplierIds.has(id)
      ? this.expandedSupplierIds.delete(id)
      : this.expandedSupplierIds.add(id);
  }

  selectItem(id: string): void {
    this.selectedItemId = id;
    this.threadSelected.emit(id);
  }

  activeFilterCount(): number { return 0; }  // stub — filter drawer comes later
}
