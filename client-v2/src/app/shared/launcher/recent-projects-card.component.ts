import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectCard } from '../../core/projects/project.types';

/** Agent home — the "Recent projects" panel (Liam, 2026-09-09). Rendered as
 *  a launcher grid child spanning two tile columns (under New/Past projects).
 *  Same .bp-card chrome as the tiles; the org's five most-recently-updated
 *  projects, each drilling into /projects/:id, with the codelist status pill
 *  and the ballpark cost. "View all" → the full /projects list. */
@Component({
  selector: 'app-recent-projects-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'bp-card bp-card--lifted bp-recent' },
  template: `
    <div class="bp-recent__body">
      <header class="bp-recent__head">
        <h2 class="bp-card-title bp-recent__title">Recent projects</h2>
        <a routerLink="/projects" class="bp-recent__viewall">View all</a>
      </header>

      @if (loader.isLoading()) {
        <p class="bp-recent__muted">Loading…</p>
      } @else if (loader.error()) {
        <p class="bp-recent__muted">Couldn't load your projects.</p>
      } @else if (recent().length === 0) {
        <p class="bp-recent__muted">No projects yet — start one from New project.</p>
      } @else {
        <ul class="bp-recent__list">
          @for (p of recent(); track p.id) {
            <li>
              <a [routerLink]="['/projects', p.id]" class="bp-recent__row">
                <span class="bp-recent__name">{{ p.name }}</span>
                <span class="bp-recent__cost">
                  {{ p.ballparkCost !== null ? money(p.ballparkCost, p.currency) : '—' }}
                </span>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host(.bp-recent) {
        border-radius: 28px;
        /* Two tile columns wide, sitting under New/Past projects. */
        grid-column: span 2;
      }
      .bp-recent__body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px;
        height: 100%;
      }
      .bp-recent__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .bp-recent__title {
        margin: 0;
      }
      .bp-recent__viewall {
        flex: none;
        padding: 5px 14px;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        color: var(--color-text);
        text-decoration: none;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        /* Same rest shadow as the cards (.bp-card--lifted → --shadow-md). */
        box-shadow: var(--shadow-md);
      }
      .bp-recent__viewall:hover {
        background: var(--color-fill);
        box-shadow: var(--shadow-lg);
      }
      .bp-recent__muted {
        margin: 0;
        color: var(--color-text-secondary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
      }
      .bp-recent__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        /* Fill the card's height and spread the rows evenly (the card stretches
           to the taller Next-steps card beside it). */
        flex: 1;
        justify-content: space-between;
      }
      .bp-recent__row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid var(--color-border-hairline);
        text-decoration: none;
        color: var(--color-text);
      }
      .bp-recent__list li:first-child .bp-recent__row {
        border-top: none;
      }
      .bp-recent__name {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: 500;
      }
      .bp-recent__row:hover .bp-recent__name {
        text-decoration: underline;
      }
      .bp-recent__cost {
        justify-self: end;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      @media (max-width: 1024px) {
        :host(.bp-recent) {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class RecentProjectsCardComponent {
  private readonly projects = inject(ProjectService);

  protected readonly loader = resource<ProjectCard[], true>({
    params: () => true,
    loader: () => firstValueFrom(this.projects.list()),
  });

  /** Four most-recently-updated projects (any status). */
  protected readonly recent = computed(() =>
    [...(this.loader.value() ?? [])]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 4)
  );

  protected money(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency || 'GBP',
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${value}`;
    }
  }
}
