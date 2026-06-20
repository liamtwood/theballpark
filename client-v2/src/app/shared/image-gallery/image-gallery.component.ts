import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { LucideAngularModule } from 'lucide-angular';
import { DrawerComponent } from '../drawer/drawer.component';
import { ImagePickerComponent } from '../image-picker/image-picker.component';
import { GalleryImage, PickerResult, PickerTab } from '../../core/media/media.types';

/** pV2-MEDIA-01c — multi-image gallery primitive. Shows a grid of filled
 *  thumbnails (drag-reorder, hover remove + set-primary) plus "+" slots that
 *  open the shared image picker. One definition, N consumers (project first).
 *
 *  The component is dumb about persistence: it emits the new ordered array on
 *  any change (`imagesChange`) and the chosen primary (`primarySet`); the
 *  consumer writes both with its own update endpoint. "Primary" is the
 *  consumer's cover (passed in via `primaryUrl`) — MEDIA.md §12, NOT position 0.
 *
 *    <app-image-gallery
 *      entityType="project" [images]="p.images" [primaryUrl]="p.coverUrl"
 *      (imagesChange)="saveImages($event)" (primarySet)="setPrimary($event)" /> */
@Component({
  selector: 'app-image-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [CdkDropList, CdkDrag, CdkDragHandle, LucideAngularModule, DrawerComponent, ImagePickerComponent],
  template: `
    <div
      class="grid"
      cdkDropList
      cdkDropListOrientation="mixed"
      (cdkDropListDropped)="onDrop($event)"
    >
      @for (img of slots(); track img.url; let i = $index) {
        <div class="tile" cdkDrag>
          <img
            class="thumb"
            [src]="img.url"
            alt=""
            [style.object-position]="img.focalX + '% ' + img.focalY + '%'"
          />
          @if (isPrimary(img)) {
            <span class="badge">Cover</span>
          }
          <div class="actions">
            <button type="button" class="act" cdkDragHandle aria-label="Drag to reorder" title="Drag to reorder">
              <lucide-icon name="grip-vertical" [size]="15" />
            </button>
            <button
              type="button"
              class="act"
              [disabled]="isPrimary(img)"
              (click)="makePrimary(img)"
              aria-label="Set as cover"
              title="Set as cover"
            >
              <lucide-icon name="star" [size]="15" />
            </button>
            <button type="button" class="act" (click)="remove(i)" aria-label="Remove image" title="Remove">
              <lucide-icon name="trash-2" [size]="15" />
            </button>
          </div>
        </div>
      }
      @for (slot of emptySlots(); track $index) {
        <button type="button" class="tile tile--empty" (click)="pickerOpen.set(true)" aria-label="Add image">
          <lucide-icon name="plus" [size]="22" />
        </button>
      }
    </div>

    <app-drawer [(open)]="pickerOpen" title="Add to gallery">
      <app-image-picker
        [entityType]="entityType()"
        [enabledTabs]="photoTabs"
        [searchSeed]="searchSeed()"
        previewAspect="4/3"
        (chosen)="onPick($event)"
        (cancelled)="pickerOpen.set(false)"
      />
    </app-drawer>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
    }
    .tile {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--color-border-hairline);
      background: var(--color-surface);
    }
    .thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .tile--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      border-style: dashed;
      border-color: var(--color-border-medium);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .tile--empty:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .actions {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .tile:hover .actions,
    .tile:focus-within .actions {
      opacity: 1;
    }
    .act {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: var(--color-surface);
      color: var(--color-text);
      border: 1px solid var(--color-border-hairline);
      cursor: pointer;
    }
    .act:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--theme-accent);
      color: var(--theme-accent-contrast);
    }
    /* CDK drag chrome */
    .cdk-drag-preview {
      border-radius: 12px;
      box-shadow: 0 8px 24px var(--color-border-medium);
    }
    .cdk-drag-placeholder {
      opacity: 0.4;
    }
    .cdk-drag-animating,
    .grid.cdk-drop-list-dragging .tile:not(.cdk-drag-placeholder) {
      transition: transform 0.2s cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class ImageGalleryComponent {
  readonly entityType = input<'project' | 'item' | 'supplier' | 'profile'>('project');
  readonly images = input<GalleryImage[]>([]);
  /** Default 5; consumer overrides (MEDIA.md §14). */
  readonly maxSlots = input<number>(5);
  /** The consumer's cover URL — the slot matching it shows the "Cover" badge. */
  readonly primaryUrl = input<string | null>(null);
  /** Seeds the picker's Find search (e.g. the project name). */
  readonly searchSeed = input<string>('');

  /** New ordered array after add / remove / reorder — consumer persists. */
  readonly imagesChange = output<GalleryImage[]>();
  /** Consumer copies this slot into its cover_* columns (MEDIA.md §12). */
  readonly primarySet = output<GalleryImage>();

  /** Galleries are photo strips — no icon tab. */
  protected readonly photoTabs: PickerTab[] = ['upload', 'find'];
  protected readonly pickerOpen = signal(false);

  /** Mutable working copy for drag-reorder; re-syncs when the input changes
   *  (after the consumer persists + re-feeds). `?? []` guards a consumer that
   *  binds an undefined images() (e.g. a stale server response missing the
   *  column) so the primitive never crashes the host view. */
  protected readonly slots = linkedSignal(() => this.images() ?? []);

  protected readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(0, this.maxSlots() - this.slots().length) })
  );

  protected isPrimary(img: GalleryImage): boolean {
    const p = this.primaryUrl();
    return !!p && img.url === p;
  }

  protected onDrop(e: CdkDragDrop<GalleryImage[]>): void {
    if (e.previousIndex === e.currentIndex) return;
    const next = [...this.slots()];
    moveItemInArray(next, e.previousIndex, e.currentIndex);
    this.slots.set(next);
    this.imagesChange.emit(next);
  }

  protected onPick(r: PickerResult): void {
    this.pickerOpen.set(false);
    // Galleries are photos — icon results don't belong here.
    if (r.type !== 'image') return;
    // Skip duplicates (same URL already in the strip).
    if (this.slots().some((s) => s.url === r.url)) return;
    const next: GalleryImage[] = [
      ...this.slots(),
      { url: r.url, focalX: r.focalX, focalY: r.focalY, attribution: r.attribution },
    ];
    this.slots.set(next);
    this.imagesChange.emit(next);
  }

  protected remove(i: number): void {
    const next = this.slots().filter((_, idx) => idx !== i);
    this.slots.set(next);
    this.imagesChange.emit(next);
  }

  protected makePrimary(img: GalleryImage): void {
    if (!this.isPrimary(img)) this.primarySet.emit(img);
  }
}
