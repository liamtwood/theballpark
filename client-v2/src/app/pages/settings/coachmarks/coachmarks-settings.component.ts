import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { Coachmark, CoachmarkService } from '../../../core/coachmark.service';

/** Ballpark-admin surface (settings/coachmarks) — list the coachmarks the app
 *  has registered and TWEAK each one's description / toggle it active. Adding new
 *  coachmarks stays a dev task for now (they auto-appear here once shown). */
@Component({
  selector: 'app-coachmarks-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageHeroComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero [back]="{ label: 'Home', href: '/home' }" title="Coachmarks"
                   subtitle="Help bubbles shown around the app" />

    <div class="bp-page-body">
      <div class="bp-settings-body mx-auto w-full px-4 pt-4">
        @if (loading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (rows().length === 0) {
          <p class="bp-body-small text-secondary">No coachmarks yet — they appear here the first time one is shown in the app.</p>
        } @else {
          @for (c of rows(); track c.id) {
            <div class="bp-card p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="bp-list-title">{{ c.page }} <span class="text-muted">· {{ c.name }}</span></span>
                <label class="inline-flex cursor-pointer items-center gap-2 bp-body-small text-secondary">
                  <input type="checkbox" class="bp-check" [ngModel]="c.isActive" (ngModelChange)="c.isActive = $event" /> Active
                </label>
              </div>
              <textarea class="bp-coach-edit mt-3" rows="2" placeholder="Bubble text…"
                        [ngModel]="c.description" (ngModelChange)="c.description = $event"></textarea>
              <div class="mt-2 flex items-center gap-3">
                <button type="button" class="bp-btn-grad" [disabled]="saving() === c.id" (click)="save(c)">
                  {{ saving() === c.id ? 'Saving…' : 'Save' }}
                </button>
                @if (savedId() === c.id) { <span class="bp-body-small text-success">Saved ✓</span> }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .bp-coach-edit {
      width: 100%; min-height: 64px;
      border-radius: var(--radius-field);
      border: 1px solid var(--color-border-hairline);
      background: var(--color-fill);
      padding: 10px 12px;
      font-size: var(--text-md); font-family: var(--bp-font);
      color: var(--color-text); outline: none; resize: vertical;
    }
    .bp-coach-edit:focus { border-color: var(--theme-accent); }
  `],
})
export class CoachmarksSettingsComponent {
  private readonly svc = inject(CoachmarkService);

  protected readonly rows = signal<Coachmark[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal<string | null>(null);
  protected readonly savedId = signal<string | null>(null);

  constructor() {
    this.svc.list().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected save(c: Coachmark): void {
    this.saving.set(c.id);
    this.svc.update(c.id, { description: c.description, isActive: c.isActive }).subscribe({
      next: () => {
        this.saving.set(null);
        this.savedId.set(c.id);
        setTimeout(() => this.savedId.set(null), 1500);
      },
      error: () => this.saving.set(null),
    });
  }
}
