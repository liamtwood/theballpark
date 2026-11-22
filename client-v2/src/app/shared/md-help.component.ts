import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';

/** A tiny "formatting help" affordance for any markdown-enabled field: a ? button
 *  that pops a reference of the `| md` pipe's syntax (bold/italic/bullets +
 *  #/##/### headings + !! Shout Out). Drop <app-md-help /> next to a field label.
 *  Self-contained; closes on outside click or Escape. */
@Component({
  selector: 'app-md-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <span class="bp-mdhelp">
      <button type="button" class="bp-mdhelp__btn" (click)="toggle($event)"
              [attr.aria-expanded]="open()" aria-label="Formatting help" title="Formatting help">?</button>
      @if (open()) {
        <div class="bp-mdhelp__pop" role="dialog" aria-label="Markdown formatting">
          <div class="bp-mdhelp__title">Formatting you can use</div>
          <dl class="bp-mdhelp__grid">
            <dt><code>**bold**</code></dt><dd><strong>bold</strong></dd>
            <dt><code>*italic*</code></dt><dd><em>italic</em></dd>
            <dt><code>- item</code></dt><dd>bulleted list</dd>
            <dt><code># Heading</code></dt><dd>Heading 1</dd>
            <dt><code>## Heading</code></dt><dd>Heading 2</dd>
            <dt><code>### Heading</code></dt><dd>Heading 3</dd>
            <dt><code>!! Text</code></dt><dd>Shout Out (bold, centred)</dd>
          </dl>
          <div class="bp-mdhelp__foot">A blank line adds a gap. Put each on its own line.</div>
        </div>
      }
    </span>
  `,
  styles: [`
    .bp-mdhelp { position: relative; display: inline-flex; vertical-align: middle; }
    .bp-mdhelp__btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; padding: 0;
      border: 1px solid var(--color-border-hairline); border-radius: 50%;
      background: transparent; color: var(--color-text-secondary); cursor: pointer;
      font-size: 11px; font-weight: 700; line-height: 1;
    }
    .bp-mdhelp__btn:hover { color: var(--color-text); border-color: var(--color-text-secondary); background: var(--color-fill); }
    .bp-mdhelp__pop {
      position: absolute; z-index: 50; top: calc(100% + 6px); left: 0;
      width: 248px; padding: 12px 14px;
      background: var(--color-surface, #fff); color: var(--color-text);
      border: 1px solid var(--color-border-hairline); border-radius: var(--radius-card, 12px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.14);
    }
    .bp-mdhelp__title { font-weight: 600; font-size: var(--text-sm); margin-bottom: 8px; }
    .bp-mdhelp__grid {
      display: grid; grid-template-columns: auto 1fr; gap: 5px 12px;
      margin: 0; align-items: baseline;
    }
    .bp-mdhelp__grid dt { margin: 0; }
    .bp-mdhelp__grid dd { margin: 0; font-size: var(--text-sm); color: var(--color-text-secondary); }
    .bp-mdhelp__grid code {
      font-family: var(--font-mono); font-size: var(--text-xs);
      background: var(--color-fill); padding: 1px 5px; border-radius: 5px; white-space: nowrap;
    }
    .bp-mdhelp__foot {
      margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--color-border-hairline);
      font-size: var(--text-xs); color: var(--color-text-secondary);
    }
  `],
})
export class MdHelpComponent {
  readonly open = signal(false);

  protected toggle(ev: Event): void {
    ev.stopPropagation();
    this.open.update((v) => !v);
  }

  @HostListener('document:click')
  protected onDocClick(): void { if (this.open()) this.open.set(false); }

  @HostListener('document:keydown.escape')
  protected onEsc(): void { if (this.open()) this.open.set(false); }
}
