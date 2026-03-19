import { Component, OnInit } from '@angular/core';
import { LucideAngularModule, CircleDot, Sparkles } from 'lucide-angular';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div style="padding: var(--section-pad);">
    <div style="max-width:640px;margin:0 auto;">
      <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:10px;padding:32px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="width:48px;height:48px;background:var(--theme-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <lucide-icon name="circle-dot" [size]="24" style="color:var(--theme-accent);"></lucide-icon>
          </div>
          <div>
            <h1 style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:400;color:var(--color-text-primary);">{{ platformName }}</h1>
            <p style="font-size:var(--text-sm);color:var(--color-text-muted);">{{ version }}</p>
          </div>
        </div>
        <p style="color:var(--color-text-secondary);line-height:1.7;margin-bottom:24px;">{{ platformName }} gives event agencies real market intelligence to estimate, plan and procure production with confidence.</p>
        <div style="background:var(--theme-bg);border-radius:10px;padding:20px;margin-bottom:24px;">
          <h2 style="font-size:var(--text-md);font-weight:600;color:var(--color-text-primary);margin-bottom:12px;">How {{ creditLabel }}s Work</h2>
          <p style="font-size:var(--text-sm);color:var(--theme-text);margin-bottom:12px;">{{ creditLabel }}s are your currency for requesting supplier estimates. Each estimate costs {{ creditLabel.toLowerCase() }}s based on its value:</p>
          <div style="font-size:var(--text-sm);">
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--theme-text);"><span>Under &pound;2,000</span><span style="font-weight:600;">1 {{ creditLabel }}</span></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--theme-text);"><span>&pound;2,000 &ndash; &pound;10,000</span><span style="font-weight:600;">2 {{ creditLabel }}s</span></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--theme-text);"><span>&pound;10,000 &ndash; &pound;30,000</span><span style="font-weight:600;">3 {{ creditLabel }}s</span></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--theme-text);"><span>&pound;30,000+</span><span style="font-weight:600;">4 {{ creditLabel }}s</span></div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:var(--text-xs);color:var(--color-text-muted);">
          <span>Built with</span>
          <span style="background:var(--theme-bg);color:var(--theme-text);padding:2px 8px;border-radius:4px;font-weight:500;">
            <lucide-icon name="sparkles" [size]="10" style="display:inline;vertical-align:middle;margin-right:2px;"></lucide-icon>Claude AI
          </span>
          <span>by Anthropic</span>
        </div>
      </div>
    </div>
    </div>
  `
})
export class AboutComponent implements OnInit {
  readonly icons = { CircleDot, Sparkles };
  platformName = 'The Ballpark';
  creditLabel = 'Ball';
  version = 'v1.0';

  constructor(private config: ConfigService) {}
  ngOnInit() {
    this.platformName = this.config.platformName;
    this.creditLabel = this.config.creditLabel;
  }
}
