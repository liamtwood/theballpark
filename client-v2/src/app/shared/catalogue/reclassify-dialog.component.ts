import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CategoryInfo } from './catalogue.types';
import { SelectComponent, SelectOption } from '../select/select.component';

/** pV2-ITEM-BULK-ACTIONS-01 — the bulk Reclassify picker. Reuses the established
 *  Category ▸ Subcategory ▸ Sub-subcategory cascade (the same /marketplace/categories
 *  + /categories/:id/subcategories endpoints the item editor + Prepare panel drive),
 *  NOT a new taxonomy UX. The DEEPEST chosen node is the item's one home category_id
 *  at any depth (0015). Parent-controlled: renders when `open` is true; emits the
 *  chosen id on Apply. Owner-only (admin content-authoring stays closed — FR-00215). */
@Component({
  selector: 'app-reclassify-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, SelectComponent],
  template: `
    <p-dialog
      [visible]="open()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '460px' }"
    >
      <ng-template pTemplate="header">
        <div>
          <h2 class="bp-card-title">Reclassify {{ count() }} {{ count() === 1 ? 'item' : 'items' }}</h2>
          <p class="bp-body mt-1 text-secondary">Pick the category. Choosing a subcategory files them deeper.</p>
        </div>
      </ng-template>

      <div class="flex flex-col gap-3 py-1">
        <div>
          <span class="bp-field-label mb-1 block font-bold text-text">Category</span>
          <app-select ariaLabel="Category" class="block w-full" [filter]="true" [options]="categoryOptions()"
            [value]="categoryId() ?? ''" placeholder="Choose a category"
            (changed)="onCategory($event)" />
        </div>
        @if (subOptions().length) {
          <div>
            <span class="bp-field-label mb-1 block font-bold text-text">Subcategory</span>
            <app-select ariaLabel="Subcategory" class="block w-full" [filter]="true" [options]="subOptions()"
              [value]="subId() ?? ''" placeholder="(whole category)"
              (changed)="onSub($event)" />
          </div>
        }
        @if (subSubOptions().length) {
          <div>
            <span class="bp-field-label mb-1 block font-bold text-text">Sub-subcategory</span>
            <app-select ariaLabel="Sub-subcategory" class="block w-full" [filter]="true" [options]="subSubOptions()"
              [value]="subSubId() ?? ''" placeholder="(whole subcategory)"
              (changed)="onSubSub($event)" />
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="close.emit()">Cancel</button>
        <button type="button" class="bp-btn-grad" [disabled]="!deepestId()" (click)="apply()">
          Reclassify
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class ReclassifyDialogComponent {
  private readonly catalogue = inject(CatalogueService);

  /** Parent toggles visibility; how many items are selected (for the title). */
  readonly open = input<boolean>(false);
  readonly count = input<number>(0);
  readonly close = output<void>();
  /** Emits the DEEPEST chosen category id (the item's home node at any depth). */
  readonly confirm = output<string>();

  protected readonly categories = signal<CategoryInfo[]>([]);
  protected readonly subcats = signal<CategoryInfo[]>([]);
  protected readonly subsubcats = signal<CategoryInfo[]>([]);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly subId = signal<string | null>(null);
  protected readonly subSubId = signal<string | null>(null);

  private loaded = false;

  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ label: c.name, value: c.id })));
  protected readonly subOptions = computed<SelectOption[]>(() =>
    this.subcats().map((c) => ({ label: c.name, value: c.id })));
  protected readonly subSubOptions = computed<SelectOption[]>(() =>
    this.subsubcats().map((c) => ({ label: c.name, value: c.id })));

  /** The deepest explicit pick — what reclassify writes. */
  protected readonly deepestId = computed(() => this.subSubId() || this.subId() || this.categoryId());

  protected onVisible(v: boolean): void {
    if (v) { this.ensureLoaded(); } else { this.close.emit(); }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try { this.categories.set(await this.catalogue.categories()); } catch { /* empty list → the picker just shows nothing */ }
  }

  protected async onCategory(id: string): Promise<void> {
    this.categoryId.set(id || null);
    this.subId.set(null); this.subSubId.set(null);
    this.subcats.set([]); this.subsubcats.set([]);
    if (id) { try { this.subcats.set(await this.catalogue.subcategories(id)); } catch { /* none */ } }
  }
  protected async onSub(id: string): Promise<void> {
    this.subId.set(id || null);
    this.subSubId.set(null); this.subsubcats.set([]);
    if (id) { try { this.subsubcats.set(await this.catalogue.subcategories(id)); } catch { /* none */ } }
  }
  protected onSubSub(id: string): void {
    this.subSubId.set(id || null);
  }

  protected apply(): void {
    const id = this.deepestId();
    if (id) this.confirm.emit(id);
  }
}
