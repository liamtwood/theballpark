import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { COMPLETED_STATUSES, ProjectCard } from '../../core/projects/project.types';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { ProjectCardComponent } from './project-card.component';

/** pV2-PROJECTS-01 — /projects: the agency project list. Viewport-fit
 *  shell (hero + tab band anchored, grid scrolls) but full-width — no
 *  left/right rails (PROJECTS.md). Current | Completed bucket the org's
 *  projects by status. eventLabel everywhere user-visible. */
@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, TabBandComponent, ProjectCardComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/home' }" [title]="heroTitle()" [subtitle]="heroSubtitle()">
      <app-tab-band hero-actions [tabs]="tabs()" [active]="bucket()" (activeChange)="bucket.set($event === 'completed' ? 'completed' : 'current')" />
    </app-page-hero>

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        @if (loader.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (loader.error()) {
          <p class="bp-body-small text-warn">Couldn't load your {{ labelPlural().toLowerCase() }}.</p>
        } @else if (visible().length === 0) {
          <p class="bp-body-small text-secondary">
            {{ bucket() === 'completed' ? 'No completed ' + labelPlural().toLowerCase() + ' yet.' : 'No ' + labelPlural().toLowerCase() + ' yet — start one from the home screen.' }}
          </p>
        } @else {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            @for (p of visible(); track p.id) {
              <app-project-card [project]="p" [now]="now()" />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectsPageComponent {
  private readonly projects = inject(ProjectService);
  private readonly pageConfig = inject(PageConfigService);

  /** eventLabel drives the user-visible noun (Project / Event / Job). */
  protected readonly labelPlural = computed(() => `${this.pageConfig.eventLabel()}s`);
  protected readonly heroTitle = computed(() => this.labelPlural());
  protected readonly heroSubtitle = computed(
    () => `Your ${this.labelPlural().toLowerCase()} — current work and completed history.`
  );

  protected readonly bucket = signal<'current' | 'completed'>('current');
  protected readonly now = signal(Date.now());

  protected readonly loader = resource<ProjectCard[], void>({
    loader: () => firstValueFrom(this.projects.list()),
  });

  private readonly all = computed(() => this.loader.value() ?? []);

  protected readonly tabs = computed<TabBandTab[]>(() => {
    const list = this.all();
    const completed = list.filter((p) => COMPLETED_STATUSES.has(p.status)).length;
    return [
      { key: 'current', label: 'Current', badge: list.length - completed },
      { key: 'completed', label: 'Completed', badge: completed },
    ];
  });

  protected readonly visible = computed(() => {
    const completed = this.bucket() === 'completed';
    return this.all().filter((p) => COMPLETED_STATUSES.has(p.status) === completed);
  });
}
