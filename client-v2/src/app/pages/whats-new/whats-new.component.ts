import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

interface ChangeItem {
  subject: string;
  hash: string;
}
interface ChangeGroup {
  type: string;
  label: string;
  items: ChangeItem[];
}
/** Curated customer-facing notes (docs/release-notes/<version>.md), grouped by
 *  product area. Null when a version has none — then the commit list shows. */
interface ChangeNote {
  area: string;
  items: string[];
}
interface ChangeVersion {
  version: string;
  date: string;
  notes: ChangeNote[] | null;
  groups: ChangeGroup[];
}
interface Changelog {
  previewVersion: string;
  pending: ChangeVersion[];
  released: ChangeVersion[];
}

/** Version history — the in-app view of CHANGELOG.md, reached from the user
 *  menu (above Sign out). Reads `public/changelog.json`, which
 *  `npm run changelog` derives from the versioned git history — so this page
 *  and CHANGELOG.md can't disagree.
 *
 *  The point is the SPLIT: "On dev — not yet on preview" is the demo list
 *  (features to show a customer before the next promote); the rest is what
 *  preview already has (Liam, 2026-07-17). */
@Component({
  selector: 'app-whats-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, LucideAngularModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/home', history: true }" title="What's new" subtitle="Version history" />

    <div class="bp-page-body">
      @if (log.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (log.error()) {
        <p class="bp-body-small text-warn">Couldn't load the version history.</p>
      } @else if (log.value(); as c) {
        <div class="mx-auto flex max-w-2xl flex-col gap-6">
          <!-- Pending — the demo list. -->
          <section>
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="bp-card-title text-lg">On dev — not yet on preview</h2>
              <span class="bp-pill bp-pill--warn shrink-0">{{ c.pending.length }} version{{ c.pending.length === 1 ? '' : 's' }}</span>
            </div>
            @if (c.pending.length) {
              <p class="bp-caption mt-1">Live on dev only — ready to demo before the next promote.</p>
              <div class="mt-3 flex flex-col gap-2.5">
                @for (v of c.pending; track v.version) {
                  <div class="bp-card p-4">
                    <ng-container [ngTemplateOutlet]="versionBlock" [ngTemplateOutletContext]="{ $implicit: v }" />
                  </div>
                }
              </div>
            } @else {
              <p class="bp-caption mt-1 inline-flex items-center gap-1.5">
                <lucide-icon name="check" [size]="14" class="text-accent" />
                Nothing pending — dev and preview are level.
              </p>
            }
          </section>

          <!-- Already on preview. -->
          <section>
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="bp-card-title text-lg">On preview</h2>
              <span class="bp-pill bp-pill--success shrink-0">{{ c.previewVersion }}</span>
            </div>
            <p class="bp-caption mt-1">Already promoted — what the customer can see today.</p>
            <div class="mt-3 flex flex-col gap-2.5">
              @for (v of releasedShown(); track v.version) {
                <div class="bp-card p-4">
                  <ng-container [ngTemplateOutlet]="versionBlock" [ngTemplateOutletContext]="{ $implicit: v }" />
                </div>
              }
            </div>
            @if (c.released.length > releasedShown().length) {
              <button type="button" class="bp-btn-outline mt-3 w-full" (click)="showAll.set(true)">
                Show all {{ c.released.length }} versions
              </button>
            }
          </section>
        </div>
      }
    </div>

    <!-- One version: number + date, then the curated notes (grouped by product
         area) when they exist — else the raw commit groups as a fallback. -->
    <ng-template #versionBlock let-v>
      <div class="flex items-baseline justify-between gap-3">
        <span class="bp-list-title">{{ v.version }}</span>
        <span class="bp-meta shrink-0">{{ v.date }}</span>
      </div>
      @if (v.notes) {
        @for (n of v.notes; track n.area) {
          <div class="mt-3">
            <span class="bp-field-label">{{ n.area }}</span>
            <ul class="mt-1.5 flex list-disc flex-col gap-1.5 pl-4">
              @for (item of n.items; track item) {
                <li class="bp-body-small text-secondary">{{ item }}</li>
              }
            </ul>
          </div>
        }
      } @else {
        @for (g of v.groups; track g.type) {
          <div class="mt-2.5">
            <span class="bp-field-label">{{ g.label }}</span>
            <ul class="mt-1 flex flex-col gap-1">
              @for (i of g.items; track i.hash) {
                <li class="bp-body-small text-secondary">{{ i.subject }}</li>
              }
            </ul>
          </div>
        }
      }
    </ng-template>
  `,
})
export class WhatsNewComponent {
  private readonly http = inject(HttpClient);

  /** Cache-bust on the build chip: the file is regenerated per ship, and a
   *  stale cached copy would silently show the wrong demo list. */
  protected readonly log = resource<Changelog, void>({
    loader: () =>
      firstValueFrom(this.http.get<Changelog>(`/changelog.json?v=${encodeURIComponent(environment.versionChip)}`)),
  });

  /** Preview history is long — show the recent slice, expand on demand. */
  protected readonly showAll = signal(false);
  protected readonly releasedShown = computed(() => {
    const all = this.log.value()?.released ?? [];
    return this.showAll() ? all : all.slice(0, 8);
  });
}
