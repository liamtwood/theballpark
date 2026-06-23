import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectService } from '../../../core/services/project.service';
import { Project } from '../../../models';
import { MarketplaceProject } from '../../../core/services/marketplace-project.service';

/**
 * Project picker for the marketplaces. The user chooses which project they're
 * "shopping for"; the choice is remembered for the session (see
 * MarketplaceProjectService) so "Add to Project" / "Wishlist" target it.
 * Stateless about persistence — it just lists projects and emits the pick.
 */
@Component({
  selector: 'app-marketplace-project-picker',
  standalone: true,
  imports: [CommonModule, DialogModule, LucideAngularModule],
  template: `
    <p-dialog [(visible)]="visible"
              (visibleChange)="visibleChange.emit($event)"
              [modal]="true" [draggable]="false" [resizable]="false"
              [dismissableMask]="true" [style]="{width:'440px'}"
              styleClass="bp-mpp-dialog">
      <ng-template pTemplate="header">
        <div class="bp-mpp-header">
          <span class="bp-mpp-eyebrow">ADD TO PROJECT</span>
          <div class="bp-mpp-title">Choose a project</div>
        </div>
      </ng-template>

      <div class="bp-mpp-body">
        <div *ngIf="loading" class="bp-mpp-empty">Loading projects…</div>
        <ng-container *ngIf="!loading">
          <button type="button" class="bp-mpp-row"
                  *ngFor="let p of projects"
                  [class.bp-mpp-row--active]="p.id === activeId"
                  (click)="pick(p)">
            <span class="bp-mpp-row-icon">
              <lucide-icon name="folder" [size]="16" [strokeWidth]="1.5"></lucide-icon>
            </span>
            <span class="bp-mpp-row-text">
              <span class="bp-mpp-row-name">{{ p.event_name || p.name }}</span>
              <span class="bp-mpp-row-sub" *ngIf="p.client_name">{{ p.client_name }}</span>
            </span>
            <lucide-icon *ngIf="p.id === activeId" name="check" [size]="16" class="bp-mpp-row-check"></lucide-icon>
          </button>
          <div *ngIf="!projects.length" class="bp-mpp-empty">No projects yet.</div>
          <button type="button" class="bp-mpp-clear" *ngIf="activeId" (click)="pick(null)">
            Browse without a project
          </button>
        </ng-container>
      </div>
    </p-dialog>
  `,
  styles: [`
    .bp-mpp-eyebrow {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--theme-accent); font-family: var(--font-body);
    }
    .bp-mpp-title { font-family: var(--font-display); font-size: 19px; color: var(--color-text-primary); margin-top: 2px; }
    .bp-mpp-body { display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto; }
    .bp-mpp-row {
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      padding: 10px 12px; border: none; background: none; cursor: pointer;
      border-radius: 12px; font-family: var(--font-body); transition: background 0.12s;
    }
    .bp-mpp-row:hover { background: var(--color-fill); }
    .bp-mpp-row--active { background: var(--theme-soft); }
    .bp-mpp-row-icon {
      width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--grad-accent-soft); color: #374151;
    }
    .bp-mpp-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .bp-mpp-row-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-mpp-row-sub { font-size: 12px; color: var(--color-text-muted); }
    .bp-mpp-row-check { color: var(--theme-accent); flex-shrink: 0; }
    .bp-mpp-clear {
      margin-top: 6px; padding: 9px 12px; width: 100%; text-align: center;
      border: 1px solid var(--color-border); background: none; cursor: pointer;
      border-radius: 10px; font-size: 12.5px; font-weight: 500; font-family: var(--font-body);
      color: var(--color-text-secondary);
    }
    .bp-mpp-clear:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-mpp-empty { padding: 24px 12px; text-align: center; font-size: 13px; color: var(--color-text-muted); }
  `]
})
export class MarketplaceProjectPickerComponent implements OnInit {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Currently-selected project id (for the active tick). */
  @Input() activeId: string | null = null;
  /** Emits the chosen project, or null for "browse without a project". */
  @Output() picked = new EventEmitter<MarketplaceProject | null>();

  projects: Project[] = [];
  loading = true;

  constructor(private projectSvc: ProjectService) {}

  ngOnInit() {
    this.projectSvc.getAll().subscribe({
      next: (ps) => { this.projects = ps || []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  pick(p: Project | null) {
    this.picked.emit(p ? { id: p.id, name: p.event_name || p.name } : null);
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
