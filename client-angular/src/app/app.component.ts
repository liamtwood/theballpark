import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { TopNavComponent } from './layout/top-nav.component';
import { ConfigService } from './core/services/config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent],
  template: `
    <div [class]="layoutClass">
      <app-top-nav></app-top-nav>
      <div class="bp-main">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .bp-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  layoutClass = 'layout-centre';
  private sub?: Subscription;

  constructor(private config: ConfigService) {}

  ngOnInit() {
    this.sub = this.config.config$.subscribe(() => {
      this.layoutClass = this.config.heroAlign === 'center' ? 'layout-centre' : 'layout-left';
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
