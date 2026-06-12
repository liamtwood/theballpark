import { ChangeDetectionStrategy, Component } from '@angular/core';

/** pV2-06d (v2.15b) — the three-region catalogue layout shell, ONE
 *  definition (was duplicated between marketplace-page and the supplier
 *  Store tab — chat audit). Slots: [strip] left rail, default middle,
 *  [rail] right rail.
 *
 *  Viewport-fit + independent column scroll (pV2-CARDS-01 QC laptop
 *  pass): inside a `.bp-vpfit` page each region scrolls WITHIN itself —
 *  the page never scrolls. Responsive: mobile (<md) = single column, no
 *  rails, natural page scroll; laptop (xl) = 260px right rail; wide
 *  (2xl) = 300px. */
@Component({
  selector: 'app-catalogue-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[210px_1fr] xl:grid-cols-[210px_1fr_260px] 2xl:grid-cols-[210px_1fr_300px]',
  },
  template: `
    <div class="hidden min-h-0 md:block md:overflow-y-auto">
      <ng-content select="[strip]" />
    </div>
    <div class="min-h-0 min-w-0 md:overflow-y-auto">
      <ng-content />
    </div>
    <div class="hidden min-h-0 xl:block xl:overflow-y-auto">
      <ng-content select="[rail]" />
    </div>
  `,
})
export class CatalogueLayoutComponent {}
