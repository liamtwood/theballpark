/**
 * v1.65e2 (p0015) — Admin persona home page.
 *
 * Beth Pizey (Ballpark · Admin) lands here when she's the active
 * persona. Mirrors the dashboard's parchment + .bp-dash-card chrome
 * so the visual language stays consistent across personas.
 *
 * Content is a placeholder welcome card + quick links into the
 * existing /ballpark-settings sub-pages (Categories / Marketplace /
 * Orgs / Early Access / Feedback). Real admin stats (org count,
 * pending feedback, recent orgs) lands in a follow-up commit.
 *
 * Route: /admin-home  (registered in app.routes.ts)
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bp-admin-home-ground">
      <div class="bp-admin-home">
        <!-- Welcome card -->
        <div class="bp-dash-card">
          <div class="bp-section-header">
            <lucide-icon name="house" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Welcome back</span>
          </div>
          <p class="bp-admin-greeting">
            {{ personaSvc.active.name }} — {{ personaSvc.active.subtitle }}.
            Platform-wide admin tools live below.
          </p>
        </div>

        <!-- Quick links into ballpark-settings -->
        <div class="bp-dash-card">
          <div class="bp-section-header">
            <lucide-icon name="zap" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Admin tools</span>
          </div>
          <a routerLink="/ballpark-settings/categories" class="bp-admin-link">
            <lucide-icon name="folder" [size]="14"></lucide-icon>
            <span>Categories</span>
          </a>
          <a routerLink="/ballpark-settings/marketplace" class="bp-admin-link">
            <lucide-icon name="store" [size]="14"></lucide-icon>
            <span>Marketplace</span>
          </a>
          <a routerLink="/ballpark-settings/orgs" class="bp-admin-link">
            <lucide-icon name="building-2" [size]="14"></lucide-icon>
            <span>Orgs</span>
          </a>
          <a routerLink="/ballpark-settings/early-access" class="bp-admin-link">
            <lucide-icon name="sparkles" [size]="14"></lucide-icon>
            <span>Early access</span>
          </a>
          <a routerLink="/ballpark-settings/feedback" class="bp-admin-link">
            <lucide-icon name="message-square" [size]="14"></lucide-icon>
            <span>Feedback</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp-admin-home-ground {
      background: var(--theme-bg);
      padding: 24px 20px;
      min-height: calc(100vh - var(--nav-height) - 64px);
    }
    .bp-admin-home {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .bp-admin-greeting {
      margin: 0;
      font-size: 15px;
      line-height: 1.5;
      color: var(--color-text-primary);
    }
    .bp-admin-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button);
      color: var(--color-text-secondary);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .bp-admin-link + .bp-admin-link { margin-top: 8px; }
    .bp-admin-link:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-soft);
    }
    .bp-admin-link lucide-icon {
      color: var(--theme-accent);
      flex-shrink: 0;
    }
  `]
})
export class AdminHomeComponent implements OnInit, OnDestroy {
  constructor(
    public  personaSvc: PersonaService,
    private shellCtx: ShellContextService
  ) {}

  ngOnInit() {
    this.shellCtx.set({
      heroTitle: 'Ballpark',
      heroSub:   'ADMIN',
      pills:     [],
      tabs:      []
    });
  }

  ngOnDestroy() {
    this.shellCtx.reset();
  }
}
