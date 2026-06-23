import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectCard, relativeAge } from '../../core/projects/project.types';
import { EntityIconComponent } from '../../shared/entity-icon/entity-icon.component';

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
  imports: [CurrencyPipe, RouterLink, EntityIconComponent],
  host: { class: 'bp-card bp-card--zoom' },
  template: `
    <a [routerLink]="['/projects', project().id]" class="block no-underline text-text" [attr.aria-label]="project().name">
      <!-- Cover: image (focal-anchored) → icon fallback → status gradient. -->
      @let proj = project();
      <div class="bp-projcard__cover">
        @if (proj.coverUrl) {
          <div class="bp-projcard__img" [style.background-image]="coverBg()" [style.background-position]="focalPos()"></div>
        } @else if (proj.iconName) {
          <div class="bp-projcard__iconwrap">
            <app-entity-icon [name]="proj.iconName" [color]="proj.iconColor" [size]="44" />
          </div>
        } @else {
          <div
            class="bp-projcard__img"
            [class.bp-projcard__img--active]="proj.status !== 'draft'"
            [class.bp-projcard__img--draft]="proj.status === 'draft'"
          ></div>
        }
        @if (proj.clientLogoUrl) {
          <img class="bp-projcard__logo" [src]="proj.clientLogoUrl" alt="" />
        }
        @if (proj.clientName) {
          <span class="bp-projcard__client-chip">{{ proj.clientName }}</span>
        }
        @if (proj.unsplashPhotographerName) {
          <span class="bp-projcard__attr">Photo: {{ proj.unsplashPhotographerName }}</span>
        }
      </div>

      <div class="flex flex-col gap-2 px-4 pb-4 pt-3.5">
        @if (project().ref) {
          <span class="bp-ref-eyebrow self-start">{{ project().ref }}</span>
        }
        <div class="truncate text-md font-semibold text-text">{{ project().name }}</div>
        <div class="flex items-center justify-between">
          <span class="bp-meta">{{ project().supplierCount }} supplier{{ project().supplierCount === 1 ? '' : 's' }}</span>
          <span class="bp-meta">{{ age() }}</span>
        </div>
        <div class="mt-0.5">
          <span class="bp-projcard__total">{{ (project().ballparkCost ?? 0) | currency: project().currency : 'symbol' : '1.0-0' }} Ballpark</span>
        </div>
      </div>
    </a>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<ProjectCard>();
  /** Stable "now" passed by the list (one Date read per render, not per card). */
  readonly now = input<number>(0);

  protected readonly age = computed(() => relativeAge(this.project().updatedAt, this.now()));
  protected readonly coverBg = computed(() => {
    const url = this.project().coverUrl;
    return url ? `url(${url})` : null;
  });
  protected readonly focalPos = computed(() => `${this.project().coverFocalX}% ${this.project().coverFocalY}%`);
}
