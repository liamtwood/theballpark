import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Sun, Moon, Settings, House, User } from 'lucide-angular';
import { ConfigService } from '../core/services/config.service';
import { OrgService } from '../core/services/org.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <nav class="bp-nav">
      <div class="bp-nav-left">
        <a routerLink="/" class="bp-nav-logo">
          <img *ngIf="logoUrl" [src]="logoUrl" alt="Logo" class="bp-nav-logo-img"/>
          <ng-container *ngIf="!logoUrl">
            <span class="bp-logo-text">{{ logoFirst }}</span><span class="bp-logo-accent">{{ logoSecond }}</span>
          </ng-container>
        </a>
        <span class="bp-nav-tagline">{{ tagline }}</span>
      </div>
      <div class="bp-nav-right">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="bp-nav-link">
          <lucide-icon name="house" [size]="14"></lucide-icon> Home
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="bp-nav-link">
          <lucide-icon name="settings" [size]="14"></lucide-icon> Settings
        </a>
        <span class="bp-credits-pill">{{ ballsBalance }} {{ creditLabel }}s left</span>
        <button class="bp-mode-btn" (click)="toggleMode()" [title]="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <lucide-icon [name]="isDark ? 'moon' : 'sun'" [size]="14"></lucide-icon>
        </button>
        <div class="bp-nav-avatar"><lucide-icon name="user" [size]="14"></lucide-icon></div>
      </div>
    </nav>
    <div class="bp-nav-version">{{ version }}</div>
  `,
  styles: [`
    .bp-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 var(--section-pad); height: var(--nav-height);
      border-bottom: 0.5px solid var(--color-border); background: var(--color-surface);
      position: sticky; top: 0; z-index: 100;
    }
    .bp-nav-left { display: flex; align-items: center; }
    .bp-nav-logo { display: flex; align-items: baseline; text-decoration: none; gap: 0; }
    .bp-nav-logo-img { height: 28px; width: auto; object-fit: contain; }
    .bp-logo-text {
      font-family: var(--font-display); font-size: var(--text-lg); font-weight: 400;
      color: var(--color-text-primary); letter-spacing: -0.01em;
    }
    .bp-logo-accent {
      font-family: var(--font-display); font-size: var(--text-lg); font-weight: 400;
      color: var(--theme-accent); letter-spacing: -0.01em;
    }
    .bp-nav-tagline {
      font-family: var(--font-body); font-size: 10px; font-weight: 400;
      color: var(--color-text-muted); margin-left: 10px;
      text-transform: uppercase; letter-spacing: 0.07em;
    }
    .bp-nav-right { display: flex; align-items: center; gap: 24px; }
    .bp-nav-link {
      font-size: var(--text-base); color: var(--color-text-muted);
      cursor: pointer; text-decoration: none; transition: color 0.15s;
      display: flex; align-items: center; gap: 5px;
    }
    .bp-nav-link:hover { color: var(--color-text-primary); }
    .bp-nav-link.active { color: var(--color-text-primary); font-weight: 500; }
    .bp-credits-pill {
      background: var(--theme-bg); color: var(--theme-text);
      font-size: var(--text-sm); font-weight: 600;
      padding: 5px 14px; border-radius: 20px; cursor: pointer; white-space: nowrap;
    }
    .bp-mode-btn {
      width: 30px; height: 30px; border-radius: 50%;
      border: 0.5px solid var(--color-border); background: var(--color-surface);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--color-text-secondary);
    }
    .bp-nav-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--color-black); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; flex-shrink: 0;
    }
    .bp-nav-version {
      position: fixed; bottom: 8px; right: 12px;
      font-size: 10px; color: var(--color-text-muted); z-index: 50;
    }
  `]
})
export class TopNavComponent implements OnInit, OnDestroy {
  readonly icons = { Sun, Moon, Settings, House, User };

  logoFirst = 'The Ball';
  logoSecond = 'park';
  logoUrl = '';
  tagline = 'Exhibition Costing';
  creditLabel = 'Ball';
  ballsBalance = 0;
  initials = 'U';
  isDark = false;
  version = environment.version;

  private sub?: Subscription;

  constructor(private configService: ConfigService, private orgService: OrgService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.sub = this.configService.config$.subscribe(() => {
      const logo = this.configService.splitLogoName();
      this.logoFirst = logo.first;
      this.logoSecond = logo.second;
      this.tagline = this.configService.tagline;
      this.creditLabel = this.configService.creditLabel;
      this.isDark = this.configService.isDarkMode;
      this.logoUrl = this.configService.logoUrl;
      this.cdr.detectChanges();
    });

    this.orgService.getBallsBalance().subscribe({
      next: (data) => { this.ballsBalance = data.balance ?? 0; this.cdr.detectChanges(); },
      error: () => this.ballsBalance = 0,
    });

    this.orgService.getCurrentOrg().subscribe({
      next: (org) => {
        if (org?.name) {
          this.initials = org.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  toggleMode() {
    const current = this.configService.current;
    let newMode: 'light' | 'dark';
    if (current.mode === 'system') {
      newMode = this.configService.isDarkMode ? 'light' : 'dark';
    } else {
      newMode = current.mode === 'dark' ? 'light' : 'dark';
    }
    this.configService.update({ mode: newMode });
  }
}
