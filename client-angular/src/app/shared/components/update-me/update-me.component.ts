import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';

/**
 * Dev-only "UPDATE ME" debt marker. Renders ONLY when
 * environment.production === false — never ships to users.
 *
 * Drop above hand-rolled page chrome to flag that it should adopt a
 * shared component (app-page-header / app-section-card / app-edit-section)
 * on the next refactor pass. Greppable via `grep -rn "<app-update-me"`.
 * See WORKING_STANDARDS.md → "Marking debt with <app-update-me>".
 */
@Component({
  selector: 'app-update-me',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div *ngIf="!isProduction" class="bp-update-me-banner" aria-label="Update me marker">
      <lucide-icon name="alert-triangle" [size]="14"></lucide-icon>
      <span>
        <strong>UPDATE ME</strong> — adopt
        <code>&lt;{{ reason }}&gt;</code>
        when next refactoring this page<span *ngIf="note" class="bp-update-me-note"> ({{ note }})</span>
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bp-update-me-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: var(--theme-soft);
      border: 1px dashed var(--color-action-text);
      border-radius: var(--radius-button);
      font-size: 12px;
      line-height: 1.4;
      color: var(--color-action-text);
    }
    .bp-update-me-banner lucide-icon {
      flex: 0 0 auto;
      display: inline-flex;
      color: var(--color-action-text);
    }
    .bp-update-me-banner strong { font-weight: 600; letter-spacing: 0.02em; }
    .bp-update-me-banner code {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--color-action-bg);
    }
    .bp-update-me-note { opacity: 0.85; }
  `],
})
export class UpdateMeComponent {
  @Input() reason!: string;
  @Input() note?: string;
  readonly isProduction = environment.production;
}
