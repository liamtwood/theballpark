import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ballpark-settings-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="bp-hero">
      <h1 class="bp-hero-org-name">Ballpark</h1>
      <p class="bp-hero-page-label">PLATFORM SETTINGS</p>
      <div class="bp-hero-tabs">
        <button *ngFor="let tab of tabs"
          class="bp-hero-tab" [class.active]="isActive(tab.path)"
          (click)="navigate(tab.path)">
          {{ tab.label }}
        </button>
      </div>
    </div>
    <router-outlet></router-outlet>
  `,
  // No component-specific styles — hero CSS is in styles.css
  styles: []
})
export class BallparkSettingsShellComponent {
  tabs = [
    { label: 'Categories', path: 'categories' },
    { label: 'Marketplace', path: 'marketplace' }
  ];

  constructor(private router: Router) {}

  navigate(path: string) { this.router.navigate(['/ballpark-settings', path]); }
  isActive(path: string) { return this.router.url.includes(`/ballpark-settings/${path}`); }
}
