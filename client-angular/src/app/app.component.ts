import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-sidebar></app-sidebar>
      <main class="ml-64 min-h-screen">
        <div class="p-8"><router-outlet></router-outlet></div>
      </main>
    </div>
  `
})
export class AppComponent {}
