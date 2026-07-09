import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { InboxService } from '../../core/inbox/inbox.service';
import { COMPLETED_STATUSES, ProjectCard } from '../../core/projects/project.types';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { ProjectCardComponent } from './project-card.component';

/** pV2-PROJECTS-01 / pV2-INBOX-01 — /projects. For an agency this is the
 *  project list: Current | Completed buckets the org's own projects by
 *  status. For a supplier (pV2-INBOX-01 slice 1) the same screen lists
 *  the quote-request projects an agency has reached out about — sourced
 *  from the gated inbox feed, no status tabs — and each card drills into
 *  that project's Inbox (/inbox/:projectId). Viewport-fit, full-width,
 *  eventLabel everywhere user-visible. */
@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, TabBandComponent, ProjectCardComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/home' }" [title]="heroTitle()" [subtitle]="heroSubtitle()">
      @if (!isSupplier()) {
        <app-tab-band hero-actions [tabs]="tabs()" [active]="bucket()" (activeChange)="bucket.set($event === 'completed' ? 'completed' : 'current')" />
      }
    </app-page-hero>

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        @if (loader.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (loader.error()) {
          <p class="bp-body-small text-warn">Couldn't load your {{ labelPlural().toLowerCase() }}.</p>
        } @else if (visible().length === 0) {
          <p class="bp-body-small text-secondary">{{ emptyCopy() }}</p>
        } @else {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            @for (p of visible(); track p.id) {
              <app-project-card [project]="p" [now]="now()" [linkBase]="isSupplier() ? '/inbox' : '/projects'" />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectsPageComponent {
  private readonly projects = inject(ProjectService);
  private readonly inbox = inject(InboxService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageConfig = inject(PageConfigService);

  /** Suppliers get the inbox-derived quote-request list, not the agency
   *  status buckets. */
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');

  /** ?bucket= drills from the supplier Projects hub (quoting/live/completed). */
  private readonly bucketParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('bucket') ?? '')),
    { initialValue: '' }
  );

  /** eventLabel drives the user-visible noun (Project / Event / Job). */
  protected readonly labelPlural = computed(() => `${this.pageConfig.eventLabel()}s`);
  protected readonly heroTitle = computed(() => {
    if (!this.isSupplier()) return this.labelPlural();
    return SUPPLIER_BUCKET_TITLES[this.bucketParam()] ?? this.labelPlural();
  });
  protected readonly heroSubtitle = computed(() =>
    this.isSupplier()
      ? `${this.labelPlural()} an agency has asked you to quote.`
      : `Your ${this.labelPlural().toLowerCase()} — current work and completed history.`
  );

  protected readonly bucket = signal<'current' | 'completed'>('current');
  protected readonly now = signal(Date.now());

  // The data source switches on viewer type: agency → their own projects;
  // supplier → the gated inbox feed (quote-request projects).
  protected readonly loader = resource<ProjectCard[], boolean>({
    params: () => this.isSupplier(),
    loader: ({ params: supplier }) =>
      firstValueFrom(supplier ? this.inbox.supplierProjects() : this.projects.list()),
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
    // Supplier feed is already the quote-request set — no status bucketing
    // (live/completed supplier buckets are a later slice).
    if (this.isSupplier()) return this.all();
    const completed = this.bucket() === 'completed';
    return this.all().filter((p) => COMPLETED_STATUSES.has(p.status) === completed);
  });

  protected readonly emptyCopy = computed(() => {
    if (this.isSupplier()) return 'No quote requests yet — an agency will reach out here.';
    return this.bucket() === 'completed'
      ? `No completed ${this.labelPlural().toLowerCase()} yet.`
      : `No ${this.labelPlural().toLowerCase()} yet — start one from the home screen.`;
  });
}

/** Supplier hub bucket → hero title (the feed is the same quote-request
 *  list for now; live/completed filtering is a later slice). */
const SUPPLIER_BUCKET_TITLES: Record<string, string> = {
  quoting: 'Quoting',
  live: 'Live Projects',
  completed: 'Completed Projects',
};
