import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectCard, relativeAge } from '../../core/projects/project.types';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';

/** pV2-PROJECTS-01 — the project card, rebuilt to v1 parity (Liam,
 *  2026-06-13; reference: projects-list.component.ts): tall cover with a
 *  status-gradient fallback + zoom, client chip bottom-left, ref eyebrow,
 *  name, solid status pill, suppliers + relative time, and the big
 *  gradient "Ballpark" total. Chrome from `.bp-card` (RP-07); the v1
 *  internals are global `.bp-projcard__*` classes. Whole card → /projects/:id.
 *  (The v1 ⋯ menu + "N New" notif badge are out until their actions /
 *  inbox data exist in v2.) */
@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, StatusPillComponent],
  host: { class: 'bp-card bp-card--lifted' },
  template: `
    <a [routerLink]="[linkBase(), project().id]" class="block no-underline text-text" [attr.aria-label]="project().name">
      @let proj = project();
      <!-- Plain card (no cover image, Liam 2026-09-09): name + client, status
           pill, ballpark figure, then venue + head count. -->
      <div class="flex flex-col gap-3 p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="bp-card-title truncate">{{ proj.name }}</div>
            @if (proj.clientName) {
              <div class="bp-meta truncate">{{ proj.clientName }}</div>
            }
          </div>
          <app-status-pill class="shrink-0" list="project_status" [code]="proj.status" />
        </div>

        <div class="bp-projcard__total">{{ (proj.ballparkCost ?? 0) | currency: proj.currency : 'symbol' : '1.0-0' }}</div>

        <div class="flex items-center gap-4">
          @if (proj.location) {
            <span class="bp-meta inline-flex items-center gap-1">
              <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" /> {{ proj.location }}
            </span>
          }
          @if (proj.guestCount !== null) {
            <span class="bp-meta inline-flex items-center gap-1">
              <lucide-icon name="users" [size]="14" [strokeWidth]="1.75" /> {{ proj.guestCount }} guests
            </span>
          }
        </div>
      </div>
    </a>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<ProjectCard>();
  /** Stable "now" passed by the list (one Date read per render, not per card). */
  readonly now = input<number>(0);
  /** Whole-card destination base. Agency list → /projects/:id (default);
   *  the supplier quoting list points it at /inbox/:projectId. */
  readonly linkBase = input<string>('/projects');

  protected readonly age = computed(() => relativeAge(this.project().updatedAt, this.now()));
}
