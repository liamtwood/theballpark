import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { HomeLauncherComponent } from '../../shared/launcher/home-launcher.component';
import { NextStep, NextStepsCardComponent } from '../../shared/launcher/next-steps-card.component';
import { RecentProjectsCardComponent } from '../../shared/launcher/recent-projects-card.component';
import { tilesForOrgType } from '../../shared/launcher/launcher-tiles';
import { heroTitle } from './hero-title';

interface ItemCounts {
  draft: number;
  pending: number;
  rejected: number;
  readyToPromote: number;
  live: number;
  total: number;
}

/** pV2-04b — the launcher home at /home. Agency + supplier get the two grid
 *  cards below the tiles: Recent projects (persona-aware) + Next steps. The
 *  agency Next steps is three quick links; the supplier Next steps is the
 *  status action list — ready-to-promote / needs-attention / drafts, each with
 *  a live count deep-linking into My Shop pre-filtered. Ballpark admins get the
 *  bare launcher. */
@Component({
  selector: 'app-home-agent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent, RecentProjectsCardComponent, NextStepsCardComponent],
  host: { class: 'bp-home-agent block' },
  template: `
    <app-home-launcher
      [eyebrow]="eyebrow()"
      [title]="title()"
      [subtitle]="config.heroSubtitle()"
      [align]="config.heroAlign()"
      [tiles]="tiles()"
    >
      <!-- One @if per projected node: a control-flow block with >1 root node
           is not projected into the [gridExtra] slot (Angular NG8011). -->
      @if (showCards()) {
        <app-recent-projects-card gridExtra />
      }
      @if (showCards()) {
        <app-next-steps-card gridExtra [items]="nextSteps()" [note]="nextStepsNote()" />
      }
    </app-home-launcher>
  `,
})
export class HomeAgentComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly config = inject(PageConfigService);

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );

  /** Home eyebrow (admin-driven; default resolves to "<ORG TYPE> WORKSPACE").
   *  The eyebrow style uppercases it. */
  protected readonly eyebrow = computed(() => (this.auth.user()?.activeOrgType ? this.config.heroEyebrow() : ''));

  protected readonly tiles = computed(() => tilesForOrgType(this.auth.user()?.activeOrgType));

  private readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');

  /** Recent + Next steps show for agencies and suppliers, not ballpark admins. */
  protected readonly showCards = computed(() => {
    const t = this.auth.user()?.activeOrgType;
    return t === 'agency' || t === 'supplier';
  });

  /** Supplier item-status rollup — feeds the Next-steps count badges. Only
   *  fetched for suppliers. */
  private readonly counts = resource<ItemCounts | null, boolean>({
    params: () => this.isSupplier(),
    loader: ({ params: supplier }) =>
      supplier ? firstValueFrom(this.api.get<ItemCounts>('/api/store/items/counts')) : Promise.resolve(null),
  });

  protected readonly nextSteps = computed<readonly NextStep[]>(() =>
    this.isSupplier() ? this.supplierSteps() : AGENCY_STEPS,
  );
  protected readonly nextStepsNote = computed(() => (this.isSupplier() ? '' : AGENCY_NOTE));

  /** The supplier "what needs me" list: their shop, a coming-soon bulk import,
   *  then the three status actions with live counts, each deep-linking into My
   *  Shop pre-filtered. */
  private readonly supplierSteps = computed<readonly NextStep[]>(() => {
    const shop = `/suppliers/${this.auth.user()?.activeOrgId ?? ''}`;
    const c = this.counts.value();
    const steps: NextStep[] = [
      { icon: 'store', label: 'My Shop', href: '/store', description: 'View and manage your shopfront' },
      { icon: 'upload', label: 'Upload items from a file', comingSoon: true, description: 'Bulk-add products from a spreadsheet' },
      { icon: 'circle-check', label: 'Ready to promote', href: shop, query: { tab: 'store', status: 'approved', active: 'inactive' }, count: c?.readyToPromote ?? 0, description: 'These are ready to promote to My Shop' },
      { icon: 'triangle-alert', label: 'Needs attention', href: shop, query: { tab: 'store', status: 'rejected' }, count: c?.rejected ?? 0, description: 'Edit and resubmit these for approval' },
      { icon: 'file-text', label: 'Drafts', href: shop, query: { tab: 'store', status: 'draft' }, count: c?.draft ?? 0, description: 'These need to be submitted for approval' },
    ];
    return steps;
  });
}

/** Agency Next steps — three quick links + the indicative-estimate disclaimer. */
const AGENCY_STEPS: readonly NextStep[] = [
  { icon: 'circle-plus', label: 'Start a new project from a brief', href: '/projects/new' },
  { icon: 'store', label: 'Browse approved suppliers', href: '/marketplace' },
  { icon: 'user', label: 'Complete your profile so approval is quicker', href: '/settings/profile' },
];
const AGENCY_NOTE =
  'Ballpark estimates are indicative and subject to supplier confirmation, final scope, availability, delivery requirements and VAT.';
