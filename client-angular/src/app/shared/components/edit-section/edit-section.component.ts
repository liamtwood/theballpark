import { Component, Input, Output, EventEmitter, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export type EditSectionDensity = 'card' | 'drawer';

/**
 * <app-edit-section> — the shared chrome + Edit → Cancel/Save lifecycle for a
 * section of editable attributes. Fields are projected via <ng-content>
 * (normally a `.bp-field-grid-2/3` of <app-edit-field>s).
 *
 * The section owns only the `editing` boolean and the buttons. The PARENT owns
 * the data: it snapshots on `(edit)`, persists on `(save)`, and restores on
 * `(cancel)`. `[(editing)]` keeps the parent's flag in sync (so its own
 * save-handler can flip editing off on success).
 *
 * ONE CHROME, TWO DENSITIES (not two idioms). The card chrome is the only
 * chrome; `density` just scales it:
 *   - 'card'   (default) = `.bp-card` 28/32 padding, serif 28px title, 38px
 *     action pills — the page/settings standard (/settings/organisation).
 *   - 'drawer' = the SAME card scaled down (16px padding, serif 20px title,
 *     32px pills) for sidebar drawers, via `.bp-card--drawer`.
 *   The consuming SURFACE picks the container (drawer OR page — exactly one at a
 *   time) and the matching density. Migrating a drawer interaction to a page is
 *   a deliberate per-interaction move: swap the container, flip density
 *   drawer→card. Same sections, same fields, same save logic.
 *
 * `editable=false` renders a static section (title + projected content, no edit
 * lifecycle) — for live-update / non-attribute sections that still want the
 * standard shell. Use the `[headExtra]` slot for any custom header affordance.
 */
@Component({
  selector: 'app-edit-section',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bp-card" [class.bp-card--drawer]="density === 'drawer'">
      <div class="bp-card-head">
        <h3 class="bp-card-title">{{ title }}</h3>
        <ng-content select="[headExtra]"></ng-content>
      </div>

      <ng-content></ng-content>

      <div class="bp-card-foot" *ngIf="editable">
        <button *ngIf="!editing" class="bp-btn-outline" (click)="onEdit()">
          <lucide-icon name="square-pen" [size]="16"></lucide-icon> {{ editLabel }}
        </button>
        <div *ngIf="editing" class="bp-card-actions">
          <button class="bp-btn-outline" (click)="onCancel()">Cancel</button>
          <button class="bp-btn-grad" (click)="onSave()" [disabled]="saving">
            <i class="pi pi-check" style="font-size:12px"></i> {{ saveLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: ['']
})
export class EditSectionComponent {
  @Input() title = '';
  @Input({ transform: booleanAttribute }) editing = false;
  @Output() editingChange = new EventEmitter<boolean>();
  @Input({ transform: booleanAttribute }) saving = false;
  @Input({ transform: booleanAttribute }) editable = true;
  @Input() density: EditSectionDensity = 'card';
  @Input() editLabel = 'Edit';
  @Input() saveLabel = 'Save changes';

  /** Parent snapshots the model here. */
  @Output() edit = new EventEmitter<void>();
  /** Parent persists here (and flips editing off on success via [(editing)]). */
  @Output() save = new EventEmitter<void>();
  /** Parent restores the snapshot here. */
  @Output() cancel = new EventEmitter<void>();

  onEdit(): void {
    this.editing = true;
    this.editingChange.emit(true);
    this.edit.emit();
  }

  onCancel(): void {
    this.editing = false;
    this.editingChange.emit(false);
    this.cancel.emit();
  }

  onSave(): void {
    // Parent owns persistence; it sets editing=false on success (flows back
    // through [(editing)]). We don't optimistically close here.
    this.save.emit();
  }
}
