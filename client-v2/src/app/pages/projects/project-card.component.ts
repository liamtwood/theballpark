import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectCard, ProjectUpdate, relativeAge } from '../../core/projects/project.types';
import { ProjectService } from '../../core/projects/project.service';
import { CodelistService } from '../../core/codelists/codelist.service';
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
  imports: [CurrencyPipe, FormsModule, RouterLink, LucideAngularModule, StatusPillComponent],
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
          <!-- Status: the coloured pill. On the agency's own list a transparent
               codelist-fed select is laid over it (click to change; the wrapper
               swallows the click so the card doesn't navigate). Suppliers see
               it read-only — they don't own the agency's project. -->
          @if (editable()) {
            <div class="relative shrink-0" (click)="$event.stopPropagation(); $event.preventDefault()" title="Change status">
              <app-status-pill list="project_status" [code]="status()" />
              <select
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Change project status"
                [disabled]="saving()"
                [ngModel]="status()"
                (ngModelChange)="changeStatus($event)"
              >
                @for (o of statusOptions(); track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </div>
          } @else {
            <app-status-pill class="shrink-0" list="project_status" [code]="status()" />
          }
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

  /** Status is editable only on the agency's own list (linkBase /projects);
   *  the supplier quoting list (/inbox) shows it read-only. */
  protected readonly editable = computed(() => this.linkBase() === '/projects');

  private readonly projects = inject(ProjectService);
  private readonly codelists = inject(CodelistService);

  /** Local status (reflects the input, overridable optimistically on change). */
  protected readonly status = linkedSignal(() => this.project().status);
  protected readonly saving = signal(false);

  /** The project_status codelist options (memoised — one fetch for all cards). */
  private readonly statusRes = resource({ loader: () => this.codelists.list('project_status') });
  protected readonly statusOptions = computed(
    () => this.statusRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? [],
  );

  /** Persist a new status (optimistic; reverts on failure). */
  protected async changeStatus(next: string): Promise<void> {
    const prev = this.status();
    if (!next || next === prev) return;
    this.status.set(next);
    this.saving.set(true);
    try {
      await firstValueFrom(this.projects.update(this.project().id, { status: next as ProjectUpdate['status'] }));
    } catch {
      this.status.set(prev);
    } finally {
      this.saving.set(false);
    }
  }
}
