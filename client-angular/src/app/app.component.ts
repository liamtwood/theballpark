import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from './layout/top-nav.component';
import { LucideAngularModule, MessageSquare } from 'lucide-angular';
import { FeedbackDialogComponent } from './shared/components/feedback-dialog/feedback-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent, LucideAngularModule, FeedbackDialogComponent],
  template: `
    <app-top-nav></app-top-nav>
    <router-outlet></router-outlet>

    <!-- Floating feedback button -->
    <button class="bp-feedback-fab" (click)="showFeedback = true" title="Log feedback">
      <lucide-icon name="message-square" [size]="22"></lucide-icon>
    </button>

    <app-feedback-dialog
      [(visible)]="showFeedback"
      (submitted)="onFeedbackSubmitted()">
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
    .bp-feedback-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    }
  `]
})
export class AppComponent {
  showFeedback = false;

  onFeedbackSubmitted() {}
}
