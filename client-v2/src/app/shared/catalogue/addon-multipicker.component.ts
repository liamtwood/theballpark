import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { VariantChild, unitLabelFor } from './variants.util';
import { WhatsIncludedComponent } from './whats-included.component';
import { QtyInputComponent } from '../../pages/projects/qty-input.component';

/** One chosen option line (add-on / space). Maps 1:1 to the `kind='addon'` quote line
 *  the composition build creates. */
export interface AddedAddon {
  id?: string | null;
  name: string;
  cost: number;
  unit: string | null;
  timeUnit: string | null;
  qty: number;
}

/** The main item, shown as the anchor (first) row once an option is added — you can't have
 *  an option without the base item (Liam 2026-11-25). The list owns its qty (starts at 1);
 *  `price` null = priced on the CTA / not counted in the extras total. */
export interface BaseLine {
  name: string;
  unit: string | null;
  timeUnit: string | null;
  serves: number | null;
  price: number | null;
}

/** What the buyer has configured: the base item's qty + the chosen options. */
export interface AddonOrder {
  baseQty: number;
  addons: AddedAddon[];
}

/** pV2-ADDONS-01 — multi-pick for options (add-ons AND spaces — same pattern, Liam
 *  2026-11-25): pick one from the dropdown, click Add → it joins the "order" list at qty 1;
 *  adjust qty per row. As soon as an option is added, the **main item anchors the list** as
 *  the first row (you can't have an option without the base). Each row previews its own quote
 *  line. Uses the project's qty stepper; emits the configured order. */
@Component({
  selector: 'app-addon-multipicker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, WhatsIncludedComponent, QtyInputComponent],
  template: `
    <div class="bp-addon-pick">
      <span class="bp-addon-pick__label">{{ label() }}</span>
      <div class="bp-addon-pick__row">
        <select class="bp-input-field bp-addon-pick__select" [value]="pick()" (change)="onPick($any($event.target).value)">
          <option value="">Choose a {{ labelLower() }}…</option>
          @for (a of addons(); track a.id ?? a.name) {
            <option [value]="a.id ?? a.name">{{ a.name }}@if (a.cost) { — {{ a.cost | currency: 'GBP' : 'symbol' : '1.0-0' }}@if (unitOf(a); as u) {&nbsp;{{ u }}}}</option>
          }
        </select>
        <button type="button" class="bp-btn--secondary bp-addon-pick__add" [disabled]="!pick()" (click)="add()">
          <lucide-icon name="plus" [size]="15" /> Add
        </button>
      </div>

      <!-- Preview the chosen option's "What's included" before adding (its image swaps the
           hero via imageChange) — the SAME component the variant picker uses. -->
      <app-whats-included [descriptions]="pickedDescriptions()" />

      @if (added().length) {
        <div class="bp-addon-pick__list">
          <!-- The main item anchors the list — no trash (you can't drop the base). -->
          @if (base(); as b) {
            <div class="bp-addon-pick__item">
              <span class="bp-addon-pick__name">{{ b.name }}</span>
              <app-qty-input class="bp-addon-pick__qty" [value]="baseQty()" [label]="b.name" (qtyCommit)="setBaseQty($event)" />
              <span class="bp-addon-pick__qtyunit">{{ qtyUnit(b) }}</span>
              <span class="bp-addon-pick__price">@if (b.price != null) { {{ b.price * baseQty() | currency: 'GBP' : 'symbol' : '1.0-0' }} }</span>
              <span class="bp-addon-pick__rm-spacer"></span>
            </div>
          }
          @for (x of added(); track $index) {
            <div class="bp-addon-pick__item">
              <span class="bp-addon-pick__name">{{ x.name }}</span>
              <app-qty-input class="bp-addon-pick__qty" [value]="x.qty" [label]="x.name" (qtyCommit)="setQty($index, $event)" />
              <span class="bp-addon-pick__qtyunit">{{ qtyUnit(x) }}</span>
              <span class="bp-addon-pick__price">{{ x.cost * x.qty | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
              <button type="button" class="bp-addon-pick__rm" (click)="removeAt($index)" aria-label="Remove"><lucide-icon name="trash-2" [size]="15" /></button>
            </div>
          }
          <div class="bp-addon-pick__total">
            <span class="bp-addon-pick__total-label">Total (excluding VAT)</span>
            <span class="bp-addon-pick__price">{{ total() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
            <span class="bp-addon-pick__rm-spacer"></span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bp-addon-pick { display: flex; flex-direction: column; gap: 0.6rem; }
      .bp-addon-pick__label {
        font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.05em;
        text-transform: uppercase; color: var(--color-text-secondary);
      }
      .bp-addon-pick__row { display: flex; align-items: stretch; gap: 0.5rem; }
      /* Dropdown chevron with proper breathing room (Liam 2026-11-25). */
      .bp-addon-pick__select {
        flex: 1 1 auto; min-width: 0;
        appearance: none; -webkit-appearance: none;
        padding-right: 2.75rem;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
        background-repeat: no-repeat; background-position: right 1rem center; background-size: 1rem;
      }
      .bp-addon-pick__add { flex: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem; }
      .bp-addon-pick__list { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.2rem; }
      /* Shared columns across item rows + total so prices line up: name(flex) · qty · qty-unit · price · trash. */
      .bp-addon-pick__item, .bp-addon-pick__total { display: flex; align-items: center; gap: 0.6rem; }
      .bp-addon-pick__name, .bp-addon-pick__total-label { flex: 1 1 auto; min-width: 0; font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bp-addon-pick__total-label { font-weight: 600; }
      .bp-addon-pick__unit { color: var(--color-text-secondary); font-size: var(--text-xs); }
      .bp-addon-pick__qty { flex: none; }
      .bp-addon-pick__qtyunit { flex: none; width: 3.25rem; font-size: var(--text-sm); color: var(--color-text-secondary); }
      .bp-addon-pick__price { width: 5.5rem; flex: none; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
      .bp-addon-pick__rm, .bp-addon-pick__rm-spacer { width: 1.75rem; flex: none; }
      .bp-addon-pick__rm { display: inline-flex; align-items: center; justify-content: center; color: var(--color-text-muted); cursor: pointer; }
      .bp-addon-pick__rm:hover { color: var(--color-danger, #dc2626); }
      .bp-addon-pick__total { margin-top: 0.2rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border-hairline); }
    `,
  ],
})
export class AddonMultipickerComponent {
  readonly addons = input<VariantChild[]>([]);
  /** The main item (anchor row) — shown once an option is added. */
  readonly base = input<BaseLine | null>(null);
  readonly label = input<string>('Add-on');
  /** The configured order (base qty + chosen options) — the cart preview. */
  readonly orderChange = output<AddonOrder>();
  /** The chosen option's cover — the host swaps the hero image to it (as a variant does). */
  readonly imageChange = output<string | null>();

  protected readonly pick = signal<string>('');
  /** The option currently chosen in the dropdown (for the description + image preview). */
  protected readonly pickedAddon = computed<VariantChild | null>(() => this.addons().find((a) => (a.id ?? a.name) === this.pick()) ?? null);
  /** The chosen option's description(s) for the shared "What's included" block. */
  protected readonly pickedDescriptions = computed<string[]>(() => {
    const d = this.pickedAddon()?.description;
    return d ? [String(d)] : [];
  });
  protected readonly baseQty = signal<number>(1);
  protected readonly added = signal<AddedAddon[]>([]);
  protected readonly labelLower = computed(() => this.label().toLowerCase());
  protected readonly total = computed(() => {
    const b = this.base();
    const baseTotal = b?.price != null ? b.price * this.baseQty() : 0;
    return baseTotal + this.added().reduce((s, x) => s + x.cost * x.qty, 0);
  });

  private emit(): void { this.orderChange.emit({ baseQty: this.baseQty(), addons: this.added() }); }

  protected unitOf(a: { unit?: string | null; timeUnit?: string | null; serves?: number | null; attributes?: { capacity?: number | null } | null }): string {
    return unitLabelFor(a?.unit, a?.timeUnit, a?.serves, a?.attributes?.capacity);
  }
  /** The count-unit shown after the qty for a time-based line ("3 Weeks"); '' otherwise. */
  protected qtyUnit(a: { unit?: string | null; timeUnit?: string | null }): string {
    if (a?.unit !== 'time' || !a?.timeUnit) return '';
    const w = String(a.timeUnit).replace(/_/g, ' ');
    const plural = /s$/i.test(w) ? w : w + 's';
    return plural.charAt(0).toUpperCase() + plural.slice(1);
  }
  /** Dropdown selection — swap the hero to the chosen option's cover (parity with variants). */
  protected onPick(val: string): void {
    this.pick.set(val);
    this.imageChange.emit(this.cover(this.pickedAddon()));
  }
  private cover(a: VariantChild | null): string | null {
    const imgs = Array.isArray(a?.images) ? a!.images : [];
    return (imgs.find((i) => i?.is_hero)?.url ?? imgs[0]?.url) ?? null;
  }
  /** Add the dropdown's pick at qty 1 (adjust in the list). */
  protected add(): void {
    const key = this.pick();
    const a = this.addons().find((x) => (x.id ?? x.name) === key);
    if (!a) return;
    this.added.update((list) => [
      ...list,
      { id: a.id, name: a.name, cost: Number(a.cost) || 0, unit: a.unit ?? null, timeUnit: a.timeUnit ?? null, qty: 1 },
    ]);
    this.pick.set('');
    this.emit();
  }
  protected setBaseQty(q: number): void { this.baseQty.set(Math.max(1, Math.floor(q) || 1)); this.emit(); }
  protected setQty(i: number, q: number): void {
    const n = Math.max(1, Math.floor(q) || 1);
    this.added.update((list) => list.map((x, idx) => (idx === i ? { ...x, qty: n } : x)));
    this.emit();
  }
  protected removeAt(i: number): void {
    this.added.update((list) => list.filter((_, x) => x !== i));
    this.emit();
  }
}
