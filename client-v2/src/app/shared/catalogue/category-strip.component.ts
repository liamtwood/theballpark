import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CategoryInfo } from './catalogue.types';

/** pV2-06a/06-subcats — the left category rail as a TREE (v2.16c, Liam's
 *  v1-parity call): "All Categories" + one row per top-level category
 *  (count + chevron), with the ACTIVE category expanded to show its
 *  subcategories indented beneath (v1's rail). Selecting a category
 *  expands it; selecting a subcategory drills (?sub=). Dumb — both
 *  surfaces (marketplace + supplier store) feed it from the shared
 *  MarketplaceStore. Category icons deferred (dynamic lucide names vs the
 *  global pick). */
@Component({
  selector: 'app-category-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (mode() === 'drilldown') {
      <!-- Drill-down: one level at a time. Top = All + categories (chevron
           hints "open"); click drills into a category to show its subcategories
           with a back row. Reverses via the back / "All Categories" row. -->
      <nav class="flex flex-col gap-0.5">
        @if (activeCat(); as cat) {
          <!-- Header: << back to all, then the active-category pill (accent).
               Clicking the pill clears the subcategory (all in category). -->
          <div class="mb-1.5 flex items-center gap-2">
            <button type="button" class="bp-catstrip-back" aria-label="Back to all categories"
                    (click)="categorySelected.emit(null)">
              <lucide-icon name="arrow-big-left" [size]="18" [strokeWidth]="1.75" />
            </button>
            <button type="button" class="bp-catstrip-pill" (click)="subcategorySelected.emit(null)">
              <span class="truncate">{{ cat.name }}</span>
              <span class="shrink-0">{{ cat.count }}</span>
            </button>
          </div>
          <!-- Subcategories — NOT indented (the pill already gives the context). -->
          @for (sub of subcategories(); track sub.id) {
            <button type="button" class="bp-catstrip-row"
                    [class.bp-catstrip-row--active]="activeSubId() === sub.id"
                    (click)="subcategorySelected.emit(activeSubId() === sub.id ? null : sub.id)">
              <span class="truncate">{{ sub.name }}</span>
              <span class="bp-meta">{{ sub.count }}</span>
            </button>
          }
        } @else {
          <button type="button" class="bp-catstrip-row"
                  [class.bp-catstrip-row--active]="!activeId()"
                  (click)="categorySelected.emit(null)">
            <span class="truncate">{{ allLabel() }}</span>
            <span class="bp-meta">{{ totalCount() }}</span>
          </button>
          @for (cat of categories(); track cat.id) {
            <button type="button" class="bp-catstrip-row" (click)="categorySelected.emit(cat.id)">
              <span class="truncate">{{ cat.name }}</span>
              <span class="flex items-center gap-1.5">
                <span class="bp-meta">{{ cat.count }}</span>
                <lucide-icon name="chevron-right" [size]="13" class="text-muted" />
              </span>
            </button>
          }
        }
      </nav>
    } @else {
    <nav class="flex flex-col gap-0.5">
      <button
        type="button"
        class="bp-catstrip-row"
        [class.bp-catstrip-row--active]="!activeId()"
        (click)="categorySelected.emit(null)"
      >
        <span class="truncate">{{ allLabel() }}</span>
        <span class="bp-meta">{{ totalCount() }}</span>
      </button>

      @for (cat of categories(); track cat.id) {
        <button
          type="button"
          class="bp-catstrip-row"
          [class.bp-catstrip-row--active]="activeId() === cat.id && !activeSubId()"
          (click)="categorySelected.emit(cat.id)"
        >
          <span class="truncate">{{ cat.name }}</span>
          <span class="flex items-center gap-1.5">
            <span class="bp-meta">{{ cat.count }}</span>
            <!-- Chevron toggles COLLAPSE independently of selection
                 (v2.16d QC: an expanded category could not be closed). -->
            <span
              class="bp-catstrip-chevron"
              role="button"
              tabindex="0"
              [attr.aria-label]="(isOpen(cat.id) ? 'Collapse ' : 'Expand ') + cat.name"
              (click)="toggleChevron($event, cat.id)"
              (keydown.enter)="toggleChevron($event, cat.id)"
            >
              <lucide-icon
                [name]="isOpen(cat.id) ? 'chevron-down' : 'chevron-right'"
                [size]="13"
                class="text-muted"
              />
            </span>
          </span>
        </button>

        <!-- Subtree — the ACTIVE category's subcategories (v1 rail style:
             indented names; counts stay in the data, off the rail). -->
        @if (isOpen(cat.id) && subcategories().length) {
          <div class="mb-1 flex flex-col gap-0.5">
            @for (sub of subcategories(); track sub.id) {
              <button
                type="button"
                class="bp-catstrip-row bp-catstrip-row--sub"
                [class.bp-catstrip-row--active]="activeSubId() === sub.id"
                (click)="subcategorySelected.emit(activeSubId() === sub.id ? null : sub.id)"
              >
                <span class="truncate">{{ sub.name }}</span>
              </button>
            }
          </div>
        }
      }
    </nav>
    }
  `,
})
export class CategoryStripComponent {
  readonly categories = input.required<readonly CategoryInfo[]>();
  /** 'tree' (default) = expandable v1 rail; 'drilldown' = one level at a time. */
  readonly mode = input<'tree' | 'drilldown'>('tree');
  readonly activeId = input<string | null>(null);
  readonly totalCount = input<number>(0);
  /** Label for the top "all" row. Defaults to "All Categories"; the
   *  in-project supplier fan-out scopes the list to the quote's categories
   *  so it keeps the same label over a narrowed set. */
  readonly allLabel = input<string>('All Categories');
  /** The active category's subcategories (the shared store loads them). */
  readonly subcategories = input<readonly CategoryInfo[]>([]);
  readonly activeSubId = input<string | null>(null);
  readonly categorySelected = output<string | null>();
  readonly subcategorySelected = output<string | null>();

  /** The drilled-into category (drill-down mode) — null at the top level. */
  protected readonly activeCat = computed(
    () => this.categories().find((c) => c.id === this.activeId()) ?? null,
  );

  /** Expansion follows selection (auto-open on select) but the chevron
   *  can collapse without deselecting; re-selecting reopens. */
  private readonly collapsed = linkedSignal<string | null, boolean>({
    source: this.activeId,
    computation: () => false,
  });

  protected isOpen(catId: string): boolean {
    return this.activeId() === catId && !this.collapsed();
  }

  protected toggleChevron(e: Event, catId: string): void {
    if (this.activeId() === catId) {
      // preventDefault too: Enter on the focused chevron span must not
      // also trigger the parent button's activation (closing audit M3).
      e.preventDefault();
      e.stopPropagation();
      this.collapsed.update((c) => !c);
    }
    // Non-active: let the row click select (chevron = same affordance).
  }
}
