import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { ProjectCard, relativeAge } from '../../core/projects/project.types';

/** pV2-PROJECTS-01 — the project card per CARDS.md image 8: cover (or
 *  soft placeholder), optional brand/event-type chip overlay, ref eyebrow,
 *  name, codelist-driven status pill, meta row (suppliers + age), and the
 *  "£X Ballpark" accent-gradient price. Chrome from `.bp-card .bp-card--zoom`
 *  (one-definition; RP-07). The whole card routes to /projects/:id. */
@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, StatusPillComponent],
  host: { class: 'bp-card bp-card--zoom' },
  template: `
    <a [routerLink]="['/projects', project().id]" class="block no-underline text-text" [attr.aria-label]="project().name">
      @if (project().coverUrl) {
        <img class="bp-item-card__img" [src]="project().coverUrl" [alt]="''" loading="lazy" decoding="async" />
      } @else {
        <div class="bp-item-card__img bp-item-card__img--empty">
          <lucide-icon name="folder-open" [size]="22" [strokeWidth]="1.5" />
        </div>
      }
      @if (project().eventType) {
        <span class="bp-tag-chip absolute left-3 top-3">{{ project().eventType }}</span>
      }

      <div class="min-w-0 px-3.5 pb-3.5 pt-3">
        @if (project().ref) {
          <div class="bp-ref-eyebrow">{{ project().ref }}</div>
        }
        <div class="mt-0.5 line-clamp-2 text-md font-semibold text-text">{{ project().name }}</div>
        <div class="mt-2">
          <app-status-pill list="project_status" [code]="project().status" />
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="bp-meta">{{ project().supplierCount }} supplier{{ project().supplierCount === 1 ? '' : 's' }}</span>
          <span class="bp-meta">{{ age() }}</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="bp-price-large">{{ (project().ballparkCost ?? 0) | currency: project().currency : 'symbol' : '1.0-0' }}</span>
          <span class="bp-meta">Ballpark</span>
        </div>
      </div>
    </a>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<ProjectCard>();
  /** Stable "now" passed by the list (one Date read per render, not per card). */
  readonly now = input<number>(0);

  protected readonly age = computed(() => relativeAge(this.project().createdAt, this.now()));
}
