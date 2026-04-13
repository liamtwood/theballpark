import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from './layout/top-nav.component';
import { LucideAngularModule } from 'lucide-angular';
import { FeedbackDialogComponent } from './shared/components/feedback-dialog/feedback-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopNavComponent, LucideAngularModule, FeedbackDialogComponent],
  template: `
    <app-top-nav></app-top-nav>
    <router-outlet></router-outlet>

    <!-- Floating feedback button -->
    <button class="bp-feedback-fab" (click)="openFeedback()" (contextmenu)="onFabContext($event)" title="Log feedback">
      <lucide-icon name="message-square" [size]="22"></lucide-icon>
    </button>

    <!-- Quick type menu (right-click) -->
    <div class="bp-fab-menu" *ngIf="showQuickMenu" [style.bottom.px]="menuBottom" [style.right.px]="24">
      <button class="bp-fab-menu-item" (click)="openFlow('bug')">
        <lucide-icon name="bug" [size]="14"></lucide-icon> Bug
      </button>
      <button class="bp-fab-menu-item" (click)="openFlow('note')">
        <lucide-icon name="clipboard-pen" [size]="14"></lucide-icon> Note
      </button>
      <button class="bp-fab-menu-item" (click)="openFlow('question')">
        <lucide-icon name="circle-help" [size]="14"></lucide-icon> Question
      </button>
    </div>

    <app-feedback-dialog
      [(visible)]="showFeedback"
      [initialFlow]="initialFlow"
      (submitted)="onFeedbackSubmitted($event)">
    </app-feedback-dialog>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    .bp-feedback-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 1000;
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--theme-accent); color: #fff;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .bp-feedback-fab:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }

    .bp-fab-menu {
      position: fixed; z-index: 1001;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 10px; padding: 6px 0; min-width: 160px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }
    .bp-fab-menu-item {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 8px 16px; font-size: 13px; font-weight: 500;
      border: none; background: transparent; cursor: pointer;
      color: var(--color-text-primary); font-family: var(--font-body);
      transition: background 0.1s;
    }
    .bp-fab-menu-item:hover { background: var(--theme-bg); }
  `]
})
export class AppComponent {
  showFeedback = false;
  showQuickMenu = false;
  initialFlow: 'bug' | 'note' | 'question' | 'action' | null = null;
  menuBottom = 80;

  openFeedback() {
    this.showQuickMenu = false;
    this.initialFlow = null;
    this.showFeedback = true;
  }

  onFabContext(event: MouseEvent) {
    event.preventDefault();
    this.menuBottom = window.innerHeight - event.clientY + 8;
    this.showQuickMenu = !this.showQuickMenu;

    if (this.showQuickMenu) {
      const close = () => { this.showQuickMenu = false; document.removeEventListener('click', close); };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  openFlow(flow: 'bug' | 'note' | 'question') {
    this.showQuickMenu = false;
    this.initialFlow = flow;
    this.showFeedback = true;
  }

  onFeedbackSubmitted(_event: any) {}
}
