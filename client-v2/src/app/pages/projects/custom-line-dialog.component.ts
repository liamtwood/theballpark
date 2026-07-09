import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

/** A custom (ad-hoc) line the agent adds on the Final view — in-session only
 *  (persisting needs a project_items column; flagged). */
export interface CustomLine {
  id: string;
  /** The category the line was added under (its dashed button). */
  categoryId: string | null;
  category: string;
  description: string;
  cost: number;
  quantity: number;
  install: boolean;
  notes: string;
}

/** pV2-CART-01 — the Add-Your-Own-Line-Item modal. Owns its form; emits the
 *  new CustomLine. Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-custom-line-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancel.emit()">
      <div class="bp-card w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between">
          <h3 class="bp-card-title text-lg">Add Your Own Line Item</h3>
          <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="cancel.emit()">
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>
        <div class="mt-4 flex flex-col gap-3">
          <label class="block">
            <span class="bp-field-label">Category</span>
            <input class="bp-input-field" placeholder="e.g. Security Staff" [(ngModel)]="form.category" />
          </label>
          <label class="block">
            <span class="bp-field-label">Description</span>
            <input class="bp-input-field" placeholder="e.g. On-site security team" [(ngModel)]="form.description" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="bp-field-label">Estimated Cost <span class="text-muted">(optional)</span></span>
              <input type="number" class="bp-input-field" placeholder="TBC — supplier quotes" [(ngModel)]="form.cost" />
            </label>
            <label class="block">
              <span class="bp-field-label">Quantity</span>
              <input type="number" class="bp-input-field" placeholder="1" [(ngModel)]="form.quantity" />
            </label>
          </div>
          <label class="block">
            <span class="bp-field-label">Type</span>
            <select class="bp-input-field" [(ngModel)]="form.type">
              <option value="deliverable">Deliverable</option>
              <option value="install">Install</option>
            </select>
          </label>
          <label class="block">
            <span class="bp-field-label">Notes (optional)</span>
            <input class="bp-input-field" placeholder="Any additional details" [(ngModel)]="form.notes" />
          </label>
        </div>
        <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="!form.description.trim()" (click)="submit()">
          Add Line Item
        </button>
      </div>
    </div>
  `,
})
export class CustomLineDialogComponent implements OnInit {
  /** The category whose dashed button was clicked (seeds the form + tags the line). */
  readonly categoryId = input<string | null>(null);
  readonly categoryName = input<string>('');
  readonly add = output<CustomLine>();
  readonly cancel = output<void>();

  protected form = { category: '', description: '', cost: null as number | null, quantity: 1, type: 'deliverable', notes: '' };

  /** Seed the Category field from the input (available by ngOnInit; the modal
   *  is recreated per open, so a fresh instance seeds each time). */
  ngOnInit(): void {
    this.form.category = this.categoryName();
  }

  protected submit(): void {
    const f = this.form;
    if (!f.description.trim()) return;
    this.add.emit({
      id: `c-${f.description.slice(0, 6)}-${f.quantity}`,
      categoryId: this.categoryId(),
      category: f.category.trim(),
      description: f.description.trim(),
      cost: Number(f.cost) || 0,
      quantity: Math.max(1, Number(f.quantity) || 1),
      install: f.type === 'install',
      notes: f.notes.trim(),
    });
  }
}
