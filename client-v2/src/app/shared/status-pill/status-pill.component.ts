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
  protected readonly fg = computed(
    () => metaColor(this.value()?.meta?.color) ?? 'var(--color-text-secondary)'
  );
  protected readonly bg = computed(
    () => metaColor(this.value()?.meta?.color_soft) ?? 'var(--color-fill)'
  );
}
