import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ApiService } from '../../core/api.service';
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
      (onShow)="onShow()"
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
        @if (subcats().length) {
          <div>
            <span class="bp-field-label mb-1 block font-bold text-text">Subcategory</span>
            <app-select ariaLabel="Subcategory" class="block w-full" [filter]="true" [options]="subOptions()"
              [value]="subId() ?? ''" placeholder="(whole category)"
              (changed)="onSub($event)" />
          </div>
        }
        @if (subsubcats().length) {
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
  private readonly api = inject(ApiService);

  /** Parent toggles visibility; how many items are selected (for the title). */
  readonly open = input<boolean>(false);
  readonly count = input<number>(0);
  /** The first selected item's home category id — preselects the cascade on open. */
  readonly seedCategoryId = input<string | null>(null);
  readonly close = output<void>();
  /** Emits the DEEPEST chosen category id (the item's home node at any depth). */
  readonly confirm = output<string>();

  protected readonly categories = signal<CategoryInfo[]>([]);
  protected readonly subcats = signal<CategoryInfo[]>([]);
  protected readonly subsubcats = signal<CategoryInfo[]>([]);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly subId = signal<string | null>(null);
  protected readonly subSubId = signal<string | null>(null);

  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ label: c.name, value: c.id })));
  // The explicit empty option is what lets a seeded drill be CLEARED back to a
  // shallower node (A1): picking '(whole category)' emits onSub('') → subId null →
  // deepestId() falls to the top categoryId. Without it, a sub-level seed can't be
  // undone (re-picking the same top category is a no-op), so an item homed at L2
  // could never be re-filed to its whole top-level category.
  protected readonly subOptions = computed<SelectOption[]>(() => [
    { label: '(whole category)', value: '' },
    ...this.subcats().map((c) => ({ label: c.name, value: c.id })),
  ]);
  protected readonly subSubOptions = computed<SelectOption[]>(() => [
    { label: '(whole subcategory)', value: '' },
    ...this.subsubcats().map((c) => ({ label: c.name, value: c.id })),
  ]);

  /** The deepest explicit pick — what reclassify writes. */
  protected readonly deepestId = computed(() => this.subSubId() || this.subId() || this.categoryId());

  protected onVisible(v: boolean): void {
    if (!v) this.close.emit();
  }

  /** p-dialog (onShow) fires reliably when the dialog becomes visible — the
   *  [visible] input alone does NOT emit (visibleChange), so the category load +
   *  seed must happen here, not in onVisible (that's why the picker was empty). */
  protected async onShow(): Promise<void> {
    await this.ensureLoaded();
    await this.seedFromItem();
  }

  private async ensureLoaded(): Promise<void> {
    // No open-once latch: categories() is session-cached by CatalogueService and
    // busted on any catalogue write, so re-reading each open is cheap AND picks up a
    // category created elsewhere this session (A4). A transient failure just leaves
    // the list empty (logged); the next open retries.
    try { this.categories.set(await this.catalogue.categories()); }
    catch (err) { console.warn('[reclassify] categories load failed', err); }
  }

  /** Preselect the Category ▸ Subcategory ▸ Sub-subcategory cascade from the first
   *  selected item's home node (its ancestor path), so the dialog opens on the item's
   *  current classification (Liam 2026-10-28). Reset-then-seed so a reopen with a
   *  different selection never shows a stale pick; falls back to empty. */
  private async seedFromItem(): Promise<void> {
    this.categoryId.set(null); this.subId.set(null); this.subSubId.set(null);
    this.subcats.set([]); this.subsubcats.set([]);
    const leaf = this.seedCategoryId();
    if (!leaf) return;
    try {
      // root → leaf ancestor path (same endpoint the item editor uses to rebuild the cascade).
      const path = await firstValueFrom(this.api.get<CategoryInfo[]>(`/api/marketplace/categories/${leaf}/path`));
      if (!path?.length) return;
      this.categoryId.set(path[0].id);
      if (path.length > 1) {
        this.subcats.set(await this.catalogue.subcategories(path[0].id));
        this.subId.set(path[1].id);
        if (path.length > 2) {
          this.subsubcats.set(await this.catalogue.subcategories(path[1].id));
          this.subSubId.set(path[2].id);
        }
      }
    } catch { /* path unavailable → leave the cascade empty */ }
  }

  protected async onCategory(id: string): Promise<void> {
    this.categoryId.set(id || null);
    this.subId.set(null); this.subSubId.set(null);
    this.subcats.set([]); this.subsubcats.set([]);
    if (id) { try { this.subcats.set(await this.catalogue.subcategories(id)); } catch (err) { console.warn('[reclassify] subcategory load failed', err); } }
  }
  protected async onSub(id: string): Promise<void> {
    this.subId.set(id || null);
    this.subSubId.set(null); this.subsubcats.set([]);
    if (id) { try { this.subsubcats.set(await this.catalogue.subcategories(id)); } catch (err) { console.warn('[reclassify] sub-subcategory load failed', err); } }
  }
  protected onSubSub(id: string): void {
    this.subSubId.set(id || null);
  }

  protected apply(): void {
    const id = this.deepestId();
    if (id) this.confirm.emit(id);
  }
}
