/**
 * v1.65dz (p0015) — Persona switcher dropdown.
 *
 * Mounted in the top-nav under the user avatar. Clicking the avatar
 * toggles the dropdown; clicking a persona row sets the active persona
 * via PersonaService (which the rest of the app subscribes to) and
 * routes to that persona's landing surface.
 *
 * Hidden entirely when PersonaService.canSwitch is false (real
 * production user, single persona).
 *
 * Visual chrome mirrors the p0015 mockup: white card, soft shadow,
 * tick on the active row, coloured initial avatars.
 */

import { Component, EventEmitter, Input, Output, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PersonaService, Persona } from '../../../core/services/persona.service';

@Component({
  selector: 'app-persona-dropdown',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="bp-persona-dd" (click)="$event.stopPropagation()">
      <div class="bp-persona-dd-head">Switch persona</div>
      <button *ngFor="let p of personaSvc.list()"
              type="button"
              class="bp-persona-row"
              [class.bp-persona-row--active]="p.id === personaSvc.active.id"
              (click)="select(p)">
        <span class="bp-persona-avatar"
              [style.background]="p.avatarColor">
          {{ p.initials }}
        </span>
        <span class="bp-persona-body">
          <span class="bp-persona-name">{{ p.name }}</span>
          <span class="bp-persona-sub">{{ p.subtitle }}</span>
        </span>
        <lucide-icon *ngIf="p.id === personaSvc.active.id"
                     name="check" [size]="14" class="bp-persona-tick"></lucide-icon>
      </button>
    </div>
  `,
  styles: [`
    /* Anchored absolute under the avatar. Caret arrow lifts above the
       card via the ::before. */
    .bp-persona-dd {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 280px;
      background: var(--color-surface);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-md);
      padding: 8px;
      z-index: 200;
    }
    .bp-persona-dd::before {
      content: '';
      position: absolute;
      top: -6px; right: 14px;
      width: 12px; height: 12px;
      background: var(--color-surface);
      transform: rotate(45deg);
      box-shadow: -1px -1px 0 var(--color-border);
    }
    .bp-persona-dd-head {
      padding: 6px 10px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      text-transform: uppercase;
    }
    .bp-persona-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      background: transparent;
      border: none;
      border-radius: var(--radius-button);
      cursor: pointer;
      text-align: left;
      font-family: var(--font-body);
    }
    .bp-persona-row:hover { background: var(--color-fill); }
    .bp-persona-row--active { background: var(--theme-soft); }
    .bp-persona-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .bp-persona-body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .bp-persona-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      line-height: 1.2;
    }
    .bp-persona-sub {
      font-size: 11px;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
      margin-top: 2px;
    }
    .bp-persona-tick {
      color: var(--theme-accent);
      flex-shrink: 0;
    }
  `]
})
export class PersonaDropdownComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  constructor(public personaSvc: PersonaService, private router: Router) {}

  /** v1.66ap — every persona lands on the canonical /home. The dashboard
      renders that role's (platform, role) profile — sections, hero,
      labels — so the home surface differs by role without a different
      route. (Was: agency → /, admin → /ballpark-settings, supplier →
      /suppliers/:id — all pre-/home.) */
  select(p: Persona) {
    this.personaSvc.set(p.id);
    this.open = false;
    this.openChange.emit(false);
    this.router.navigateByUrl('/home');
  }

  /** Close on outside click. The top-nav avatar handler stops
      propagation on the avatar itself, so a click anywhere else
      bubbles to document and trips this. */
  @HostListener('document:click')
  onDocClick() {
    if (this.open) {
      this.open = false;
      this.openChange.emit(false);
    }
  }
}
