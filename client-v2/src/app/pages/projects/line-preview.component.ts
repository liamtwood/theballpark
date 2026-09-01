import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { QuoteLine } from '../../core/projects/project.types';
import { lineCost, quoteLineToCatalogueItem } from './quote-line.util';

/** pV2-PREVIEW-01 — the ONE project-side item preview. Maps a QuoteLine onto
 *  `app-item-preview` with the project treatment in a single place (client-facing
 *  TOTAL, no store-link, "Item description" label, and the Client description /
 *  Details blocks), so every read-only surface — the inbox cards and the estimate
 *  rail — renders identically and can't drift. Customize mounts app-item-preview
 *  directly (it's the editable, live-total editor variant of the same component). */
@Component({
  selector: 'app-line-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ItemPreviewComponent],
  host: { class: 'block' },
  template: `
    @if (previewItem(); as pi) {
      <app-item-preview
        [item]="pi"
        [categoryName]="line()?.categoryName ?? null"
        [showStoreLink]="false" [showFromPrefix]="false"
        descriptionLabel="Item description"
        [lineTotal]="total()"
        [clientDescription]="line()?.quoteDescription ?? null"
        [clientDescriptionEditable]="clientDescriptionEditable()"
        [details]="line()?.details ?? null"
        [currencyCode]="line()?.supplierCurrency ?? null"
        [closeIcon]="closeIcon()" [closeLabel]="closeLabel()"
        (closed)="closed.emit()" (editClientDescription)="editClientDescription.emit()" />
    }
  `,
})
export class LinePreviewComponent {
  readonly line = input<QuoteLine | null>(null);
  readonly closeIcon = input<string>('x');
  readonly closeLabel = input<string>('Close preview');
  /** Show a pencil on the Client description block (the host opens its editor). */
  readonly clientDescriptionEditable = input<boolean>(false);
  readonly closed = output<void>();
  readonly editClientDescription = output<void>();
  /** The client-facing line TOTAL (what they'll pay) — the preview headline. */
  protected readonly total = computed(() => { const l = this.line(); return l ? lineCost(l) : null; });
  protected readonly previewItem = computed(() => { const l = this.line(); return l ? quoteLineToCatalogueItem(l) : null; });
}
