import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CodelistService } from '../../core/codelists/codelist.service';
import { CodelistValue, metaColor } from '../../core/codelists/codelist.types';

/** pV2-CODELISTS-01 — the codelist-driven status pill. Give it a list +
 *  code; label, colors and (optional) icon come from the value's rich
 *  meta (docs/CODELISTS.md convention). Type chrome = the .bp-status-pill
 *  table class; the meta colors land as inline styles (the ONE sanctioned
 *  dynamic-style case — values are DATA, not design tokens to hardcode).
 *  Unknown codes render the raw code on neutral chrome (never blank). */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'bp-pill-host' },
  template: `
    <span
      class="bp-status-pill bp-pill"
      [style.color]="fg()"
      [style.background]="bg()"
      [style.font-weight]="strong() ? '700' : null"
    >
      @if (icon(); as i) {
        <lucide-icon [name]="i" [size]="11" />
      }
      {{ label() }}
    </span>
  `,
})
export class StatusPillComponent {
  private readonly codelists = inject(CodelistService);

  /** The codelist name (e.g. 'message_status'). */
  readonly list = input.required<string>();
  /** The value code (e.g. 'sent'). */
  readonly code = input.required<string>();
  /** Render the label bold — the "needsYou" turn signal (Liam 2026-10-30): the
   *  line is waiting on the current user. Purely presentational; the code/label
   *  are unchanged. */
  readonly strong = input<boolean>(false);

  // N pills on one list share ONE fetch: list() memoises the in-flight
  // promise per list, so per-instance resources dedupe at the service
  // (audit F-3 — deliberate, not N+1).
  private readonly valuesRes = resource({
    params: () => this.list(),
    loader: ({ params }) => this.codelists.list(params),
  });

  private readonly value = computed<CodelistValue | null>(
    () => this.valuesRes.value()?.find((v) => v.code === this.code()) ?? null
  );

  protected readonly label = computed(() => this.value()?.label ?? this.code());
  protected readonly icon = computed(() => this.value()?.meta?.icon ?? null);
  // SOLID pill (Liam, v1 parity): meta.color fills the background, text +
  // icon are white. color_soft is no longer used by the pill. Unknown
  // codes fall back to a neutral solid (never blank).
  protected readonly bg = computed(
    () => metaColor(this.value()?.meta?.color) ?? 'var(--color-text-muted)'
  );
  // Readable text on ANY fill: dark text on a light background, white on a dark
  // one — computed from the background's luminance, so a custom light colour the
  // admin picks (e.g. #f8fafc) stays legible (Liam 2026-10-29).
  protected readonly fg = computed(() => {
    const L = this.bgLuminance();
    return L !== null && L > 0.6 ? 'var(--color-text)' : 'var(--bp-text-on-gradient)';
  });

  /** Perceived lightness of the fill, 0 (dark) … 1 (light), or null if it can't
   *  be parsed. Handles hex, rgb() and oklch() (incl. token refs resolved live). */
  private bgLuminance(): number | null {
    const raw = this.value()?.meta?.color || '--color-text-muted';
    const v = raw.startsWith('--')
      ? getComputedStyle(document.documentElement).getPropertyValue(raw).trim()
      : raw.trim();
    if (!v) return null;
    let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    m = v.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    m = v.match(/oklch\(\s*([\d.]+)/i);
    if (m) return parseFloat(m[1]); // oklch lightness ≈ 0..1
    return null;
  }
}
