import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrgService } from '../core/services/org.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      <div class="px-6 py-5 border-b border-gray-200">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <i class="pi pi-circle-fill text-white text-sm"></i>
          </div>
          <h1 class="text-lg font-bold text-gray-900">The Ballpark</h1>
        </div>
      </div>
      <div class="px-6 py-3 border-b border-gray-200">
        <div class="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>&#x1F535;</span>
          <span>{{ ballsBalance !== null ? ballsBalance + ' Balls' : 'Loading...' }}</span>
        </div>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <a *ngFor="let item of navItems" [routerLink]="item.route" routerLinkActive="bg-brand-50 text-brand-600"
           [routerLinkActiveOptions]="{exact: item.exact || false}"
           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900">
          <i [class]="'pi ' + item.icon + ' text-lg'"></i>{{ item.label }}
        </a>
      </nav>
      <div class="px-6 py-4 border-t border-gray-200"><p class="text-xs text-gray-400">The Ballpark {{ version }}</p></div>
    </aside>
  `
})
export class SidebarComponent implements OnInit {
  version = environment.version;
  ballsBalance: number | null = null;
  navItems = [
    { label: 'Dashboard', icon: 'pi-th-large', route: '/', exact: true },
    { label: 'Projects', icon: 'pi-folder', route: '/projects', exact: false },
    { label: 'Suppliers', icon: 'pi-truck', route: '/suppliers', exact: false },
    { label: 'Clients', icon: 'pi-users', route: '/clients', exact: false },
    { label: 'Settings', icon: 'pi-cog', route: '/settings', exact: false },
    { label: 'About', icon: 'pi-info-circle', route: '/about', exact: false },
  ];

  constructor(private orgService: OrgService) {}

  ngOnInit() {
    this.orgService.getBallsBalance().subscribe({
      next: (data) => this.ballsBalance = data.balance ?? 0,
      error: () => this.ballsBalance = 0,
    });
  }
}
