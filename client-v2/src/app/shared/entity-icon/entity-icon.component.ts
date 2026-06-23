import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LucideIconsService } from '../../core/media/lucide-icons.service';

/** pV2-MEDIA-01b — renders a stored (arbitrary) Lucide icon as a soft-pastel
 *  square. The icon node is resolved lazily via LucideIconsService and drawn
 *  with <lucide-icon [img]>, so the chosen icon need not be in the curated
 *  app.config set (keeps the main bundle lean — lock §5). The cover-less
 *  fallback for project/category faces. */
@Component({
  selector: 'app-entity-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <span class="bp-entity-icon" [style.background]="bg()">
      @if (data.value(); as d) {
        <lucide-icon [img]="d" [size]="size()" [strokeWidth]="1.6" />
      }
    </span>
  `,
})
export class EntityIconComponent {
  private readonly icons = inject(LucideIconsService);
  readonly name = input.required<string>();
  /** A CSS custom-property name (token); falls back to the first pastel. */
  readonly color = input<string | null>(null);
  readonly size = input<number>(28);

  protected readonly bg = computed(() => `var(${this.color() || '--bp-pastel-1'})`);
  protected readonly data = resource({
    params: () => this.name(),
    loader: ({ params }) => this.icons.byName(params),
  });
}
