import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CategoryInfo } from './catalogue.types';
import { SelectComponent, SelectOption } from '../select/select.component';
import { ModalComponent } from '../modal/modal.component';

interface Collection { id: string; name: string; ref: string | null; }
/** What the dialog applies: a category (deepest node), collection memberships, and Related links. */
export interface ReclassifyResult { categoryId: string | null; collectionIds: string[]; relatedIds: string[]; }

/** pV2-ITEM-BULK-ACTIONS-01 — the bulk Reclassify picker. Reuses the established
 *  Category ▸ Subcategory ▸ Sub-subcategory cascade (the same /marketplace/categories
 *  + /categories/:id/subcategories endpoints the item editor + Prepare panel drive),
 *  NOT a new taxonomy UX. The DEEPEST chosen node is the item's one home category_id
 *  at any depth (0015). Parent-controlled: renders when `open` is true; emits the
 *  chosen id on Apply. Owner-only (admin content-authoring stays closed — FR-00215). */
@Component({
  selector: 'app-reclassify-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, SelectComponent, FormsModule, LucideAngularModule],
  template: `
    <app-modal [open]="open()" (close)="close.emit()" (shown)="onShow()" width="460px">
      <div modalHeader>
        <h2 class="bp-card-title">Reclassify {{ count() }} {{ count() === 1 ? 'item' : 'items' }}</h2>
        <p class="bp-body mt-1 text-secondary">Pick the category. Choosing a subcategory files them deeper.</p>
      </div>

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

        <!-- pV2-ADDONS-02 Stage 1 — bulk-add the selected items to collections (member).
             Independent of the category pick: you can set either, or both. -->
        <div>
          <span class="bp-field-label mb-1 block font-bold text-text">Collections</span>
          @if (selectedCollections().length) {
            <div class="mb-2 flex flex-wrap gap-1.5">
              @for (c of selectedCollections(); track c.id) {
                <span class="bp-tag-chip inline-flex items-center gap-1">
                  <lucide-icon name="layers" [size]="12" /> {{ c.name }}
                  <button type="button" class="ml-0.5 text-muted hover:text-[var(--color-danger,#dc2626)]"
                          (click)="removeCollection(c)" aria-label="Remove"><lucide-icon name="x" [size]="12" /></button>
                </span>
              }
            </div>
          }
          <div class="flex flex-wrap items-center gap-2">
            @if (availableCollections().length) {
              <app-select ariaLabel="Add to collection" class="block min-w-0 flex-1" [filter]="true" [options]="collectionOptions()"
                [value]="''" placeholder="Add to a collection…" (changed)="pickCollection($event)" />
            }
            <input class="bp-input-field" style="max-width: 11rem;" placeholder="New collection"
                   [ngModel]="newCollectionName()" (ngModelChange)="newCollectionName.set($event)" (keydown.enter)="createCollection()" />
            <button type="button" class="bp-btn-outline bp-body-small" [disabled]="!newCollectionName().trim() || busy()" (click)="createCollection()">
              <lucide-icon name="plus" [size]="14" /> Create
            </button>
          </div>
        </div>

        <!-- pV2-ADDONS-02 — Related items: collections this item POINTS AT (not a member of), so
             their members show as its complements. Pick from the same collection pool. -->
        <div>
          <span class="bp-field-label mb-1 block font-bold text-text">Related items</span>
          @if (selectedRelated().length) {
            <div class="mb-2 flex flex-wrap gap-1.5">
              @for (c of selectedRelated(); track c.id) {
                <span class="bp-tag-chip inline-flex items-center gap-1">
                  <lucide-icon name="sparkles" [size]="12" /> {{ c.name }}
                  <button type="button" class="ml-0.5 text-muted hover:text-[var(--color-danger,#dc2626)]"
                          (click)="removeRelated(c)" aria-label="Remove"><lucide-icon name="x" [size]="12" /></button>
                </span>
              }
            </div>
          }
          @if (availableRelated().length) {
            <app-select ariaLabel="Add related collection" class="block w-full" [filter]="true" [options]="relatedOptions()"
              [value]="''" placeholder="Add a related collection…" (changed)="pickRelated($event)" />
          }
        </div>
      </div>

      <button modalFooter type="button" class="bp-btn--secondary" (click)="close.emit()">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary"
              [disabled]="!deepestId() && !selectedCollections().length && !selectedRelated().length && !itemId()" (click)="apply()">
        Apply
      </button>
    </app-modal>
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
  /** SINGLE-item mode: the item id, so the dialog LOADS + shows its current collections +
   *  related (editable, replace-on-apply). Null = bulk (add-only, nothing pre-selected). */
  readonly itemId = input<string | null>(null);
  readonly close = output<void>();
  /** Emits the deepest chosen category id (or null) + the chosen collection + related ids. */
  readonly confirm = output<ReclassifyResult>();

  protected readonly categories = signal<CategoryInfo[]>([]);
  protected readonly subcats = signal<CategoryInfo[]>([]);
  protected readonly subsubcats = signal<CategoryInfo[]>([]);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly subId = signal<string | null>(null);
  protected readonly subSubId = signal<string | null>(null);

  // pV2-ADDONS-02 Stage 1 — collection memberships to add to the selected items.
  protected readonly collections = signal<Collection[]>([]);
  protected readonly selectedCollections = signal<Collection[]>([]);
  protected readonly newCollectionName = signal('');
  protected readonly busy = signal(false);
  protected readonly availableCollections = computed(() => {
    const on = new Set(this.selectedCollections().map((c) => c.id));
    return this.collections().filter((c) => !on.has(c.id));
  });
  protected readonly collectionOptions = computed<SelectOption[]>(() =>
    this.availableCollections().map((c) => ({ label: c.name, value: c.id })));

  protected pickCollection(id: string): void {
    const c = this.collections().find((x) => x.id === id);
    if (c && !this.selectedCollections().some((x) => x.id === c.id)) this.selectedCollections.update((s) => [...s, c]);
  }
  protected removeCollection(c: Collection): void {
    this.selectedCollections.update((s) => s.filter((x) => x.id !== c.id));
  }

  // Related items — the item POINTS AT these collections (item_related_tags). Same pool as
  // collections; a collection can be a membership or a related link (or both, different items).
  protected readonly selectedRelated = signal<Collection[]>([]);
  protected readonly availableRelated = computed(() => {
    const on = new Set(this.selectedRelated().map((c) => c.id));
    return this.collections().filter((c) => !on.has(c.id));
  });
  protected readonly relatedOptions = computed<SelectOption[]>(() =>
    this.availableRelated().map((c) => ({ label: c.name, value: c.id })));
  protected pickRelated(id: string): void {
    const c = this.collections().find((x) => x.id === id);
    if (c && !this.selectedRelated().some((x) => x.id === c.id)) this.selectedRelated.update((s) => [...s, c]);
  }
  protected removeRelated(c: Collection): void {
    this.selectedRelated.update((s) => s.filter((x) => x.id !== c.id));
  }
  protected createCollection(): void {
    const name = this.newCollectionName().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    this.api.post<Collection>('/api/store/collections', { name }).subscribe({
      next: (c) => { this.busy.set(false); this.newCollectionName.set(''); if (c?.id) { this.collections.update((a) => [...a, c]); this.pickCollection(c.id); } },
      error: () => this.busy.set(false),
    });
  }

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

  /** app-modal (shown) forwards p-dialog onShow — fires reliably when the dialog
   *  becomes visible, so the category load + seed happen here (the [open] input
   *  alone wouldn't signal the open edge). */
  protected async onShow(): Promise<void> {
    // Clear first (before any async GET) so a stale selection from a prior open can never be
    // PUT onto this item if Apply is clicked before the load returns (review 2026-11-27).
    this.selectedCollections.set([]); this.selectedRelated.set([]); this.newCollectionName.set('');
    this.api.get<Collection[]>('/api/store/collections').subscribe((r) => this.collections.set(r ?? []));
    // Single item → LOAD its current collections + related so they show (editable; replaced on
    // Apply). Bulk (no itemId) → nothing pre-selected (add-only, can't show per-item state).
    const id = this.itemId();
    if (id) {
      this.api.get<Collection[]>(`/api/store/collections/item/${id}`).subscribe((r) => this.selectedCollections.set(r ?? []));
      this.api.get<Collection[]>(`/api/store/collections/related/item/${id}`).subscribe((r) => this.selectedRelated.set(r ?? []));
    }
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
    this.confirm.emit({
      categoryId: this.deepestId() ?? null,
      collectionIds: this.selectedCollections().map((c) => c.id),
      relatedIds: this.selectedRelated().map((c) => c.id),
    });
  }
}
