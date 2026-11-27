import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../core/api.service';

interface Collection { id: string; name: string; ref: string | null; }

/** pV2-ADDONS-02 — the item editor's Collections / Related-items picker. An item can belong
 *  to any number of org-scoped collections (`variant='collection'`, membership) OR point at
 *  collections as Related items (`variant='related'`, item_related_tags) — the base is NOT a
 *  member of those. Same create-or-pick UX + picklist; only the junction endpoint differs.
 *  Create-or-pick; each change autosaves. Self-contained (its own API calls) so the
 *  1800-line item editor doesn't grow. */
@Component({
  selector: 'app-collections-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="mt-4">
      <div class="bp-field-label">{{ label() }}</div>
      @if (selected().length) {
        <div class="mt-1 flex flex-wrap gap-1.5">
          @for (c of selected(); track c.id) {
            <span class="bp-tag-chip inline-flex items-center gap-1">
              <lucide-icon name="layers" [size]="12" /> {{ c.name }}
              @if (editing()) {
                <button type="button" class="ml-0.5 text-muted hover:text-[var(--color-danger,#dc2626)]"
                        (click)="remove(c)" [attr.aria-label]="'Remove ' + c.name"><lucide-icon name="x" [size]="12" /></button>
              }
            </span>
          }
        </div>
      } @else if (!editing()) {
        <div class="bp-body-small text-muted">{{ emptyText() }}</div>
      }

      @if (editing()) {
        <div class="mt-2 flex flex-wrap items-center gap-2">
          @if (available().length) {
            <select class="bp-input-field bp-body-small" style="max-width: 16rem;"
                    (change)="onPick($any($event.target).value); $any($event.target).value = ''">
              <option value="">{{ pickText() }}</option>
              @for (c of available(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
          }
          <input class="bp-input-field bp-body-small" style="max-width: 13rem;" placeholder="New collection name"
                 [ngModel]="newName()" (ngModelChange)="newName.set($event)" (keydown.enter)="createAndAdd()" />
          <button type="button" class="bp-btn-outline bp-body-small" [disabled]="!newName().trim() || busy()" (click)="createAndAdd()">
            <lucide-icon name="plus" [size]="14" /> Create
          </button>
        </div>
      }
    </div>
  `,
})
export class CollectionsPickerComponent {
  private readonly api = inject(ApiService);
  /** The item being edited (BPIN or UUID — the server resolves it). */
  readonly itemId = input.required<string>();
  readonly editing = input<boolean>(true);
  /** 'collection' = membership (item_tags); 'related' = points-at (item_related_tags). */
  readonly variant = input<'collection' | 'related'>('collection');

  protected readonly label = computed(() => (this.variant() === 'related' ? 'Related items' : 'Collections'));
  protected readonly emptyText = computed(() => (this.variant() === 'related' ? 'No related collections' : 'No collections'));
  protected readonly pickText = computed(() => (this.variant() === 'related' ? 'Add a related collection…' : 'Add to a collection…'));
  /** The per-item junction endpoint — membership vs related. Picklist + create are shared. */
  private readonly itemBase = computed(() =>
    `/api/store/collections${this.variant() === 'related' ? '/related' : ''}/item/${this.itemId()}`);

  protected readonly all = signal<Collection[]>([]);
  protected readonly selected = signal<Collection[]>([]);
  protected readonly newName = signal('');
  protected readonly busy = signal(false);

  /** Collections not yet on this item — the "add existing" dropdown. */
  protected readonly available = computed(() => {
    const on = new Set(this.selected().map((c) => c.id));
    return this.all().filter((c) => !on.has(c.id));
  });

  constructor() {
    effect(() => {
      const id = this.itemId();
      if (!id) return;
      this.api.get<Collection[]>('/api/store/collections').subscribe((r) => this.all.set(r ?? []));
      this.api.get<Collection[]>(this.itemBase()).subscribe((r) => this.selected.set(r ?? []));
    });
  }

  private save(): void {
    const ids = this.selected().map((c) => c.id);
    this.api.put(this.itemBase(), { collectionIds: ids }).subscribe();
  }

  protected onPick(id: string): void {
    const c = this.all().find((x) => x.id === id);
    if (c) this.add(c);
  }
  protected add(c: Collection): void {
    if (this.selected().some((x) => x.id === c.id)) return;
    this.selected.update((s) => [...s, c]);
    this.save();
  }
  protected remove(c: Collection): void {
    this.selected.update((s) => s.filter((x) => x.id !== c.id));
    this.save();
  }
  protected createAndAdd(): void {
    const name = this.newName().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    this.api.post<Collection>('/api/store/collections', { name }).subscribe({
      next: (c) => { this.busy.set(false); this.newName.set(''); if (c?.id) { this.all.update((a) => [...a, c]); this.add(c); } },
      error: () => this.busy.set(false),
    });
  }
}
