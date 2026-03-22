import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { OrgService } from '../../core/services/org.service';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="bp-hero">
      <h1 class="bp-hero-org-name">{{ orgName }}</h1>
      <p class="bp-hero-page-label">SETTINGS</p>
      <div class="bp-hero-tabs">
        <button *ngFor="let tab of tabs"
          class="bp-hero-tab" [class.active]="isActive(tab.path)"
          (click)="navigate(tab.path)">
          {{ tab.label }}
        </button>
      </div>
    </div>
    <div class="bp-shell-content">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    :host          { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .bp-hero       { flex-shrink: 0; }
    .bp-shell-content { flex: 1; overflow-y: auto; }
  `]
})
export class SettingsShellComponent {
  orgName = '';

  tabs = [
    { label: 'Organisation', path: 'organisation' },
    { label: 'Team',         path: 'team' },
    { label: 'Subscription', path: 'subscription' }
  ];

  constructor(private router: Router, private orgSvc: OrgService) {
    this.orgSvc.getCurrentOrg().subscribe(org => { if (org) this.orgName = org.name; });
  }

  navigate(path: string) { this.router.navigate(['/settings', path]); }
  isActive(path: string) { return this.router.url.includes(`/settings/${path}`); }
}
