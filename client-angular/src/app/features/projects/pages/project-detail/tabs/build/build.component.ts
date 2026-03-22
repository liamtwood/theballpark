import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-build',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bp-tab-stub">
      <div class="bp-stub-icon">🏗️</div>
      <h3 class="bp-stub-title">Build</h3>
      <p class="bp-stub-body">Browse the supplier catalogue and add items to your estimate.</p>
      <p class="bp-stub-coming">Coming next</p>
    </div>
  `,
  styles: [`
    .bp-tab-stub    { text-align: center; padding: 80px 24px; }
    .bp-stub-icon   { font-size: 48px; margin-bottom: 16px; }
    .bp-stub-title  { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 8px; }
    .bp-stub-body   { font-size: 14px; color: var(--color-text-muted); margin-bottom: 16px; }
    .bp-stub-coming { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); }
  `]
})
export class BuildComponent {}
