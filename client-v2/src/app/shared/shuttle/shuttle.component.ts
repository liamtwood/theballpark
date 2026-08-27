import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

/** A browsable source item on the LEFT of the shuttle. */
export interface ShuttleItem {
  id: string;
  name: string;
  price: number | null;
  /** Left-list grouping band (e.g. subcategory / category). */
  groupName?: string | null;
  /** Optional thumbnail (only shown when [showThumbs]). */
  coverUrl?: string | null;
}

/** A staged pick on the RIGHT of the shuttle. `id` is the pick's own id. */
export interface ShuttlePick {
  id: string;
  name: string;
  cost: number | null;
  qty: number;
  /** Right-list grouping band. */
  groupName?: string | null;
}

/** pV2-BUILDUP-02 — the shared "shuttle": browse a source on the LEFT, click to
 *  stage picks on the RIGHT (with qty + remove). Pure presentation over the two
 *  lists — the host owns the state and reacts to (add)/(remove)/(qtyChange).
 *  Extracted from the explore add-line dialog so the marketplace explore and the
 *  Customize component picker share ONE implementation. */
@Component({
  selector: 'app-shuttle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="grid gap-0 md:grid-cols-[1fr_1px_1fr]">
      <!-- LEFT: browse the source, grouped, click to add. -->
      <div class="min-w-0 md:pr-4">
        <input class="bp-input-field" [placeholder]="leftPlaceholder()" [ngModel]="query()" (ngModelChange)="query.set($event)" autocomplete="off" />
        @if (leftCats().length > 1) {
          <select class="bp-input-field mt-2 w-full" [ngModel]="catFilter()" (ngModelChange)="catFilter.set($event)">
            <option [ngValue]="null">All categories</option>
            @for (g of leftCats(); track g) { <option [ngValue]="g">{{ g }}</option> }
          </select>
        }
        <div class="mt-2 overflow-y-auto rounded-[var(--radius-card)] border border-hairline" [style.height]="height()">
          @if (leftGroups().length) {
            @for (grp of leftGroups(); track grp.name) {
              <div class="border-b border-hairline bg-fill px-3 py-1.5">
                <span class="bp-meta truncate font-medium text-text">{{ grp.name }}</span>
              </div>
              @for (it of grp.items; track it.id) {
                <button type="button"
                        class="group grid w-full items-center gap-2.5 border-b border-hairline px-3 py-1.5 text-left last:border-b-0"
                        [class]="showThumbs() ? 'grid-cols-[36px_1fr_auto_20px]' : 'grid-cols-[1fr_auto_20px]'"
                        [class.hover:bg-fill]="!isPicked(it.id)"
                        [class.opacity-55]="isPicked(it.id)"
                        [disabled]="isPicked(it.id)"
                        (click)="add.emit(it)">
                  @if (showThumbs()) {
                    @if (it.coverUrl) {
                      <img class="h-8 w-9 rounded object-cover" [src]="it.coverUrl" alt="" loading="lazy" decoding="async" />
                    } @else { <div class="h-8 w-9 rounded bg-fill"></div> }
                  }
                  <span class="min-w-0 truncate text-md font-medium text-text">{{ it.name }}</span>
                  <span class="text-md text-text">{{ it.price === null ? 'POA' : ('£' + (it.price | number: '1.0-0')) }}</span>
                  @if (isPicked(it.id)) {
                    <lucide-icon name="check" [size]="15" class="text-success" />
                  } @else {
                    <lucide-icon name="plus" [size]="15" class="text-muted opacity-0 group-hover:opacity-100" />
                  }
                </button>
              }
            }
          } @else {
            <p class="bp-caption px-3 py-3">{{ emptyLeft() }}</p>
          }
        </div>
      </div>

      <!-- Vertical shuttle divider. -->
      <div class="hidden bg-hairline md:block"></div>

      <!-- RIGHT: the staged picks — grouped, band only when >1 group. -->
      <div class="min-w-0 md:pl-4">
        <span class="bp-field-label">{{ rightTitle() }}</span>
        <div class="mt-2 overflow-y-auto rounded-[var(--radius-card)] border border-hairline" [style.height]="height()">
          @if (picks().length) {
            @for (grp of pickGroups(); track grp.name) {
              <div class="flex items-center justify-between border-b border-hairline bg-fill px-3 py-1.5">
                <span class="bp-meta truncate font-semibold text-text">{{ grp.name }}</span>
                <span class="bp-meta">£{{ grp.total | number: '1.0-0' }}</span>
              </div>
              @for (p of grp.items; track p.id) {
                <div class="grid grid-cols-[1fr_auto_64px_28px] items-center gap-2 border-b border-hairline px-3 py-1.5 last:border-b-0">
                  <span class="min-w-0 truncate text-md font-medium text-text">{{ p.name }}</span>
                  <span class="bp-meta shrink-0">{{ p.cost === null ? 'POA' : ('£' + (p.cost | number: '1.0-0')) }}</span>
                  <input type="number" class="bp-input-field text-right" [ngModel]="p.qty" (ngModelChange)="qtyChange.emit({ id: p.id, qty: $event })" />
                  <button type="button" class="rounded-md p-1 text-muted hover:text-danger" aria-label="Remove" (click)="remove.emit(p.id)">
                    <lucide-icon name="x" [size]="15" />
                  </button>
                </div>
              }
            }
          } @else {
            <p class="bp-caption px-3 py-6 text-center">{{ emptyRight() }}</p>
          }
        </div>
        <div class="mt-2 flex items-center justify-end">
          <span class="bp-meta">{{ picks().length }} item{{ picks().length === 1 ? '' : 's' }} · £{{ total() | number: '1.0-0' }}</span>
        </div>
      </div>
    </div>
  `,
})
export class ShuttleComponent {
  readonly available = input<ShuttleItem[]>([]);
  readonly picks = input<ShuttlePick[]>([]);
  /** Source ids already staged — rendered ✓/disabled on the left (add-once). */
  readonly pickedIds = input<readonly string[]>([]);
  readonly leftPlaceholder = input<string>('Filter…');
  readonly rightTitle = input<string>('Added items');
  readonly showThumbs = input<boolean>(false);
  readonly emptyLeft = input<string>('Nothing to browse here.');
  readonly emptyRight = input<string>('Click items on the left to add them here.');
  /** Height of each pane's scroll area. */
  readonly height = input<string>('320px');
  /** Seeds the category filter (the launched category) — still user-overridable. */
  readonly initialCat = input<string | null>(null);

  readonly add = output<ShuttleItem>();
  readonly remove = output<string>();
  readonly qtyChange = output<{ id: string; qty: number }>();

  protected readonly query = signal('');
  /** Defaults to the launched category (initialCat); the user can change it. */
  protected readonly catFilter = linkedSignal<string | null>(() => this.initialCat());
  /** Distinct category bands available on the left, for the filter dropdown. */
  protected readonly leftCats = computed(() => [...new Set(this.available().map((i) => i.groupName || 'Other'))]);

  /** Left source, filtered by the query + category, grouped by groupName. */
  protected readonly leftGroups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cf = this.catFilter();
    const items = this.available().filter((i) =>
      (!q || i.name.toLowerCase().includes(q)) && (cf == null || (i.groupName || 'Other') === cf)
    );
    return this.group(items, (i) => i.groupName);
  });
  protected readonly pickGroups = computed(() => {
    const groups = this.group(this.picks(), (p) => p.groupName);
    return groups.map((g) => ({
      ...g,
      total: g.items.reduce((s, p) => s + (Number(p.cost) || 0) * Math.max(1, Number(p.qty) || 1), 0),
    }));
  });
  protected readonly total = computed(() =>
    this.picks().reduce((s, p) => s + (Number(p.cost) || 0) * Math.max(1, Number(p.qty) || 1), 0)
  );

  protected isPicked(id: string): boolean { return this.pickedIds().includes(id); }

  private group<T>(items: T[], key: (t: T) => string | null | undefined): { name: string; items: T[] }[] {
    const out: { name: string; items: T[] }[] = [];
    const idx = new Map<string, { name: string; items: T[] }>();
    for (const it of items) {
      const name = key(it) || 'Other';
      let g = idx.get(name);
      if (!g) { g = { name, items: [] }; idx.set(name, g); out.push(g); }
      g.items.push(it);
    }
    return out;
  }
}
