import { ChangeDetectionStrategy, Component } from '@angular/core';

/** pV2-06d (v2.15b) — the three-region catalogue layout shell, ONE
 *  definition (was duplicated between marketplace-page and the supplier
 *  Store tab — chat audit). Slots: [strip] left rail, default middle,
 *  [rail] right rail (hidden below xl, same breakpoint everywhere). */
@Component({
  selector: 'app-catalogue-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[210px_1fr] gap-6 xl:grid-cols-[210px_1fr_300px]' },
  template: `
    <ng-content select="[strip]" />
    <div class="min-w-0"><ng-content /></div>
    <div class="hidden xl:block"><ng-content select="[rail]" /></div>
  `,
})
export class CatalogueLayoutComponent {}
