import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** Curated customer-facing notes (docs/release-notes/<version>.md), grouped by
 *  product area. Versions without a notes file aren't in the payload at all. */
interface ChangeNote {
  area: string;
  items: string[];
}
interface ChangeVersion {
  version: string;
  date: string;
  notes: ChangeNote[];
}
/** The two sections are EXPLICIT in the file — this page renders them verbatim
 *  and computes no split, so it can't disagree with reality on any environment
 *  (audit 2026-07-17 B3). Whatever branch `npm run changelog` runs on decides. */
interface Changelog {
  dev: ChangeVersion[];
  preview: ChangeVersion[];
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
          <!-- Coming next — the demo list (empty on preview builds). -->
          <section>
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="bp-card-title text-lg">On dev — not yet on preview</h2>
              @if (c.dev.length) {
                <span class="bp-pill bp-pill--warn shrink-0">{{ c.dev.length }} version{{ c.dev.length === 1 ? '' : 's' }}</span>
              }
            </div>
            @if (c.dev.length) {
              <p class="bp-caption mt-1">Live on dev only — ready to demo before the next promote.</p>
              <div class="mt-3 flex flex-col gap-2.5">
                @for (v of c.dev; track v.version) {
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
              @if (c.preview.length) {
                <span class="bp-pill bp-pill--success shrink-0">{{ c.preview.length }} version{{ c.preview.length === 1 ? '' : 's' }}</span>
              }
            </div>
            @if (c.preview.length) {
              <p class="bp-caption mt-1">Already promoted — what the customer can see today.</p>
              <div class="mt-3 flex flex-col gap-2.5">
                @for (v of previewShown(); track v.version) {
                  <div class="bp-card p-4">
                    <ng-container [ngTemplateOutlet]="versionBlock" [ngTemplateOutletContext]="{ $implicit: v }" />
                  </div>
                }
              </div>
              @if (c.preview.length > previewShown().length) {
                <button type="button" class="bp-btn-outline mt-3 w-full" (click)="showAll.set(true)">
                  Show all {{ c.preview.length }} versions
                </button>
              }
            } @else {
              <p class="bp-caption mt-1">Nothing documented yet.</p>
            }
          </section>
        </div>
      }
    </div>

    <!-- One version: number + date, then its curated notes by product area. -->
    <ng-template #versionBlock let-v>
      <div class="flex items-baseline justify-between gap-3">
        <span class="bp-list-title">{{ v.version }}</span>
        <span class="bp-meta shrink-0">{{ v.date }}</span>
      </div>
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

  /** Preview history grows over time — show the recent slice, expand on demand. */
  protected readonly showAll = signal(false);
  protected readonly previewShown = computed(() => {
    const all = this.log.value()?.preview ?? [];
    return this.showAll() ? all : all.slice(0, 8);
  });
}
