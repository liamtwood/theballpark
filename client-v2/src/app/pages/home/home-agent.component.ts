import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { can } from '../../core/auth/permissions';
import { PageConfigService } from '../../core/config/page-config.service';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { PageSettingsDrawerComponent } from '../../shell/page-settings-drawer/page-settings-drawer.component';
import { LauncherGridComponent } from '../../shared/launcher/launcher-grid.component';
import { StatsStripComponent } from './sections/stats-strip.component';
import { UpcomingCardComponent } from './sections/upcoming-card.component';
import { QuickActionsCardComponent } from './sections/quick-actions-card.component';
import { RecentActivityCardComponent } from './sections/recent-activity-card.component';
import { CreditsCardComponent } from './sections/credits-card.component';
import { SavedSuppliersCardComponent } from './sections/saved-suppliers-card.component';
import { heroTitle } from './hero-title';

/** pV2-04 — the agent home at /home: configured hero + cog, stats strip,
 *  three-column body (left sections / centre launcher / right sections),
 *  page-settings drawer. Agent-only this prompt; pV2-05 adds the role
 *  switch + supplier variant. */
@Component({
  selector: 'app-home-agent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeroComponent,
    PageSettingsDrawerComponent,
    LauncherGridComponent,
    StatsStripComponent,
    UpcomingCardComponent,
    QuickActionsCardComponent,
    RecentActivityCardComponent,
    CreditsCardComponent,
    SavedSuppliersCardComponent,
  ],
  host: { class: 'bp-home-agent block' },
  template: `
    <app-page-hero
      [title]="title()"
      [subtitle]="subtitle()"
      [align]="config.heroAlign()"
      [accent]="config.heroColor()"
    >
      @if (isAdmin()) {
        <button
          hero-actions
          type="button"
          class="cursor-pointer rounded-full p-2 text-secondary hover:bg-fill"
          aria-label="Page settings"
          (click)="drawerOpen.set(true)"
        >
          <lucide-icon name="settings" [size]="18" />
        </button>
      }
    </app-page-hero>

    <div class="bp-page-body">
      @if (config.showStats()) {
        <app-stats-strip class="mb-6" />
      }

      <div class="bp-home-agent__body">
        @if (hasLeftColumn()) {
          <div class="flex flex-col gap-4">
            @if (config.showUpcoming()) {
              <app-upcoming-card />
            }
            @if (config.showQuickActions()) {
              <app-quick-actions-card />
            }
            @if (config.showRecentActivity()) {
              <app-recent-activity-card />
            }
          </div>
        }

        <app-launcher-grid class="bp-home-agent__centre" />

        @if (hasRightColumn()) {
          <div class="flex flex-col gap-4">
            @if (config.showCredits()) {
              <app-credits-card />
            }
            @if (config.showSavedSuppliers()) {
              <app-saved-suppliers-card />
            }
          </div>
        }
      </div>
    </div>

    <app-page-settings-drawer [(open)]="drawerOpen" />
  `,
  styles: [
    `
      /* Fixed 3-track grid (v1.66b lesson): side columns own their tracks so
         hiding sections leaves the centre launcher dead-centre. */
      .bp-home-agent__body {
        display: grid;
        grid-template-columns: 300px 1fr 300px;
        gap: 24px;
        align-items: start;
      }
      .bp-home-agent__centre {
        grid-column: 2;
      }
      @media (max-width: 900px) {
        .bp-home-agent__body {
          grid-template-columns: 1fr;
        }
        .bp-home-agent__centre {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class HomeAgentComponent {
  protected readonly auth = inject(AuthService);
  protected readonly config = inject(PageConfigService);

  protected readonly drawerOpen = signal(false);

  /** Cog + drawer are admin-only (server re-checks the PUT regardless). */
  protected readonly isAdmin = computed(() => can(this.auth.role(), 'org.invite_member'));

  protected readonly title = computed(() =>
    heroTitle(this.config.heroTitleMode(), this.auth.user(), this.config.heroTitleFixed())
  );
  protected readonly subtitle = computed(
    () => this.config.heroSubtitle() || (this.auth.user()?.activeOrgName ?? '')
  );

  protected readonly hasLeftColumn = computed(
    () => this.config.showUpcoming() || this.config.showQuickActions() || this.config.showRecentActivity()
  );
  protected readonly hasRightColumn = computed(
    () => this.config.showCredits() || this.config.showSavedSuppliers()
  );
}
