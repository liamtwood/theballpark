import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { QuoteLine } from '../../core/projects/project.types';
import { lineItemized, quoteLineToCatalogueItem } from './quote-line.util';
import { currencySymbol, detailsCalcLine } from '../../shared/details-format';

/** The edited line fields the parent persists. `cost` is the per-unit rate;
 *  the parent decides whether that's a direct base_price write (agent's own
 *  line) or a negotiation proposal (supplier's revised card). */
export interface LineEdit {
  name?: string;
  cost: number | null;
  unit: string | null;
  categoryId: string | null;
  description: string | null;
  services: string | null;
  details: string | null;
}

/** pV2-BUILDUP-04 — the shared inline line editor: the reused editable
 *  item-preview card (name / cost / unit / description / services) + an editable
 *  category + the Details free-text field (markdown + qty@price/N×M auto-total),
 *  with Save/Cancel. Used by the inbox revised card (supplier) AND the Final
 *  Quote rail (agent's own lines) so the two can't drift. The parent owns
 *  persistence (it gets a LineEdit on `save`). */
@Component({
  selector: 'app-line-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ItemPreviewComponent],
  host: { class: 'block' },
  template: `
    @if (previewItem(); as pi) {
      <!-- ONE widget: the same item-preview card, fields enabled in place
           (name / cost / unit / category / description / services / details). -->
      <app-item-preview [item]="pi" [showStoreLink]="false" [showFromPrefix]="false"
                        [editable]="true" [priceEditable]="showPrice()"
                        [categories]="categories()" [categoryId]="edCategoryId()"
                        [detailsEditable]="true" [details]="edDetails()"
                        [currencyCode]="line().supplierCurrency ?? null"
                        [itemized]="itemized()"
                        closeIcon="x" closeLabel="Cancel" (closed)="cancel.emit()"
                        (nameChange)="edName.set($event)" (descChange)="edDesc.set($event)" (servicesChange)="edServices.set($event)"
                        (priceChange)="edCost.set($event)" (unitChange)="edUnit.set($event)"
                        (categoryChange)="edCategoryId.set($event)" (detailsChange)="edDetails.set($event)" />
    }
    <div class="mt-4 flex gap-2.5 border-t border-hairline pt-4">
      <button type="button" class="bp-btn-outline flex-1" (click)="cancel.emit()">Cancel</button>
      <button type="button" class="bp-btn-grad flex-1" [disabled]="saving()" (click)="onSave()">{{ saving() ? 'Saving…' : 'Save' }}</button>
    </div>
  `,
})
export class LineEditorComponent implements OnInit {
  readonly line = input.required<QuoteLine>();
  /** Project categories for the category picker (empty = hide the picker). */
  readonly categories = input<{ id: string; name: string }[]>([]);
  /** Whether the price/unit are editable (off if the card shouldn't reprice). */
  readonly showPrice = input<boolean>(true);
  readonly saving = input<boolean>(false);
  readonly save = output<LineEdit>();
  readonly cancel = output<void>();

  protected readonly edName = signal('');
  protected readonly edCost = signal<number | null>(null);
  protected readonly edUnit = signal<string | null>(null);
  protected readonly edCategoryId = signal<string | null>(null);
  protected readonly edDesc = signal('');
  protected readonly edServices = signal('');
  protected readonly edDetails = signal('');

  ngOnInit(): void {
    const l = this.line();
    this.edName.set(l.name ?? '');
    this.edCost.set(l.basePrice ?? null);
    this.edUnit.set(l.unit ?? null);
    this.edCategoryId.set(l.categoryId ?? null);
    this.edDesc.set(l.description ?? '');
    this.edServices.set(l.installDescription ?? '');
    this.edDetails.set(l.details ?? '');
  }

  /** The derived Itemized rows (read-only) — shown in edit too for continuity. */
  protected readonly itemized = computed(() => lineItemized(this.line()));
  /** The line overlaid with the in-progress edits, as the card's CatalogueItem. */
  protected readonly previewItem = computed<CatalogueItem | null>(() => {
    const l = this.line();
    return {
      ...quoteLineToCatalogueItem(l),
      name: this.edName() || l.name || '',
      description: this.edDesc(),
      installDescription: this.edServices(),
      basePrice: this.edCost(),
      unit: this.edUnit(),
    };
  });

  private sym(): string { return currencySymbol(this.line().supplierCurrency); }

  protected onSave(): void {
    const details = this.edDetails().split('\n').map((l) => detailsCalcLine(l, this.sym())).join('\n').trim();
    this.save.emit({
      name: this.edName().trim() || undefined,
      cost: this.edCost(),
      unit: this.edUnit()?.trim() || null,
      categoryId: this.edCategoryId(),
      description: this.edDesc().trim() || null,
      services: this.edServices().trim() || null,
      details: details || null,
    });
  }
}
