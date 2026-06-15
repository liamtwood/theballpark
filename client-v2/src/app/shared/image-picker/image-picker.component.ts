import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { MediaService } from '../../core/media/media.service';
import { LucideIconsService } from '../../core/media/lucide-icons.service';
import {
  DEFAULT_ICON_COLORS,
  PickerResult,
  PickerTab,
  PreviewAspect,
  UnsplashPhoto,
} from '../../core/media/media.types';

/** pV2-MEDIA-01b — the shared image/icon chooser. Three tabs (My File /
 *  Unsplash / Lucide), then a focal-point step for image results. Pure: emits
 *  a PickerResult discriminated union; the consumer persists it (MEDIA.md
 *  lock §1,§2). Mounts inside <app-drawer>. */
@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (stage() === 'focal' && pending(); as p) {
      <!-- Focal-point step: click the spot to keep in frame (lock §10). -->
      <p class="bp-body-small text-secondary">Click the part of the image to keep in frame.</p>
      <button
        type="button"
        class="bp-focal"
        [style.aspect-ratio]="previewAspect()"
        (click)="setFocal($event)"
        aria-label="Click to set the image focal point"
      >
        <img [src]="p.url" alt="" [style.object-position]="focalPos()" />
        <span class="bp-focal__dot" [style.left.%]="focalX()" [style.top.%]="focalY()"></span>
      </button>
      @if (p.attribution; as a) {
        <p class="bp-caption mt-2">Photo by {{ a.photographerName }} on Unsplash</p>
      }
      <div class="mt-4 flex items-center justify-between">
        <button type="button" class="bp-btn-outline" (click)="backToPick()">Back</button>
        <button type="button" class="bp-btn-grad" (click)="useImage()">Use this image</button>
      </div>
    } @else {
      <!-- Tab bar -->
      <div class="bp-picker__tabs">
        @for (t of tabs(); track t.key) {
          <button type="button" class="bp-picker__tab" [class.bp-picker__tab--active]="activeTab() === t.key" (click)="activeTab.set(t.key)">
            {{ t.label }}
          </button>
        }
      </div>

      @switch (activeTab()) {
        @case ('upload') {
          <label
            class="bp-picker__drop"
            [class.bp-picker__drop--over]="dragOver()"
            (dragover)="onDragOver($event, true)"
            (dragleave)="onDragOver($event, false)"
            (drop)="onDrop($event)"
          >
            <input type="file" class="hidden" accept="image/*" (change)="onFile($event)" [disabled]="uploading()" />
            <lucide-icon name="upload" [size]="22" [strokeWidth]="1.6" />
            <span class="bp-body-small mt-2">{{ uploading() ? 'Uploading…' : 'Drop an image here or click to browse' }}</span>
            <span class="bp-caption mt-1">JPG / PNG / WebP · max 10MB</span>
          </label>
          @if (uploadError()) {
            <p class="bp-body-small mt-2 text-warn">{{ uploadError() }}</p>
          }
        }

        @case ('find') {
          <div class="bp-picker__search">
            <lucide-icon name="search" [size]="16" class="text-muted" />
            <input
              type="text"
              class="bp-picker__search-input"
              placeholder="Search Unsplash…"
              [value]="findQuery()"
              (input)="findQuery.set($any($event.target).value)"
              (keydown.enter)="runSearch()"
            />
            <button type="button" class="bp-btn-grad" (click)="runSearch()" [disabled]="finding()">Search</button>
          </div>
          @if (findResults().length) {
            <div class="bp-picker__grid mt-3">
              @for (r of findResults(); track r.url) {
                <button type="button" class="bp-picker__cell" (click)="pickUnsplash(r)">
                  <img [src]="r.thumb" [alt]="r.description" loading="lazy" />
                </button>
              }
            </div>
            <div class="mt-3 flex justify-center">
              <button type="button" class="bp-btn-outline" (click)="loadMore()" [disabled]="finding()">
                {{ finding() ? 'Loading…' : 'Load more' }}
              </button>
            </div>
            <p class="bp-caption mt-2 text-center">Photos by Unsplash</p>
          } @else if (finding()) {
            <p class="bp-body-small mt-3 text-secondary">Searching…</p>
          } @else if (searched()) {
            <p class="bp-body-small mt-3 text-secondary">No photos found — try another term.</p>
          }
        }

        @case ('icon') {
          <div class="bp-picker__search">
            <lucide-icon name="search" [size]="16" class="text-muted" />
            <input
              type="text"
              class="bp-picker__search-input"
              placeholder="Search icons…"
              [value]="iconQuery()"
              (input)="iconQuery.set($any($event.target).value)"
            />
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (c of palette(); track c) {
              <button type="button" class="bp-swatch" [class.bp-swatch--active]="iconColor() === c" [style.background]="'var(' + c + ')'" (click)="iconColor.set(c)" [attr.aria-label]="'Background ' + c"></button>
            }
          </div>
          @if (iconsRes.isLoading()) {
            <p class="bp-body-small mt-3 text-secondary">Loading icons…</p>
          } @else {
            <div class="bp-picker__icons mt-3">
              @for (i of iconMatches(); track i.name) {
                <button type="button" class="bp-picker__icon" [style.background]="'var(' + iconColor() + ')'" [attr.aria-label]="i.name" (click)="pickIcon(i.name)">
                  <lucide-icon [img]="i.data" [size]="20" [strokeWidth]="1.6" />
                </button>
              }
            </div>
          }
        }
      }
    }
  `,
})
export class ImagePickerComponent {
  private readonly media = inject(MediaService);
  private readonly lucide = inject(LucideIconsService);

  readonly entityType = input<'project' | 'item' | 'supplier' | 'profile'>('project');
  readonly enabledTabs = input<PickerTab[]>(['upload', 'find', 'icon']);
  readonly previewAspect = input<PreviewAspect>('4/3');
  readonly iconPalette = input<readonly string[]>(DEFAULT_ICON_COLORS);

  readonly chosen = output<PickerResult>();
  readonly cancelled = output<void>();

  private static readonly TAB_LABELS: Record<PickerTab, string> = { upload: 'My File', find: 'Find', icon: 'Use Icon' };
  protected readonly tabs = computed(() => this.enabledTabs().map((key) => ({ key, label: ImagePickerComponent.TAB_LABELS[key] })));
  protected readonly activeTab = signal<PickerTab>('upload');

  // ── Focal stage ──
  protected readonly stage = signal<'pick' | 'focal'>('pick');
  protected readonly pending = signal<{ url: string; source: 'upload' | 'unsplash'; attribution?: { photographerName: string; photoUrl: string } } | null>(null);
  protected readonly focalX = signal(50);
  protected readonly focalY = signal(50);
  protected readonly focalPos = computed(() => `${this.focalX()}% ${this.focalY()}%`);

  // ── Upload tab ──
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal('');
  protected readonly dragOver = signal(false);

  protected onDragOver(e: Event, over: boolean): void {
    e.preventDefault();
    this.dragOver.set(over);
  }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.upload(file);
  }
  protected onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void this.upload(file);
  }
  private async upload(file: File): Promise<void> {
    this.uploadError.set('');
    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Image must be under 10MB.');
      return;
    }
    this.uploading.set(true);
    try {
      const { url } = await firstValueFrom(this.media.upload(file, this.entityType()));
      this.enterFocal(url, 'upload');
    } catch {
      this.uploadError.set("Upload failed — please try again.");
    } finally {
      this.uploading.set(false);
    }
  }

  // ── Find (Unsplash) tab ──
  protected readonly findQuery = signal('');
  protected readonly findResults = signal<UnsplashPhoto[]>([]);
  protected readonly finding = signal(false);
  protected readonly searched = signal(false);
  private page = 1;

  protected runSearch(): void {
    this.page = 1;
    this.findResults.set([]);
    void this.fetchPage();
  }
  protected loadMore(): void {
    this.page += 1;
    void this.fetchPage();
  }
  private async fetchPage(): Promise<void> {
    const q = this.findQuery().trim();
    if (!q) return;
    this.finding.set(true);
    try {
      const rows = await firstValueFrom(this.media.searchUnsplash(q, this.page));
      this.findResults.update((cur) => (this.page === 1 ? rows : [...cur, ...rows]));
    } catch {
      /* proxy returns [] on error; nothing to surface */
    } finally {
      this.finding.set(false);
      this.searched.set(true);
    }
  }
  protected pickUnsplash(r: UnsplashPhoto): void {
    this.enterFocal(r.url, 'unsplash', { photographerName: r.photographer, photoUrl: r.photoUrl });
  }

  // ── Icon tab ──
  protected readonly iconQuery = signal('');
  protected readonly palette = computed(() => this.iconPalette());
  protected readonly iconColor = signal<string>(DEFAULT_ICON_COLORS[0]);
  protected readonly iconsRes = resource({
    params: () => (this.activeTab() === 'icon' ? true : undefined),
    loader: () => this.lucide.all(),
  });
  protected readonly iconMatches = computed(() => {
    const all = this.iconsRes.value() ?? [];
    const q = this.iconQuery().trim().toLowerCase();
    return (q ? all.filter((i) => i.name.includes(q)) : all).slice(0, 160);
  });
  protected pickIcon(name: string): void {
    this.chosen.emit({ type: 'icon', name, color: this.iconColor() });
  }

  // ── Focal helpers ──
  private enterFocal(url: string, source: 'upload' | 'unsplash', attribution?: { photographerName: string; photoUrl: string }): void {
    this.pending.set({ url, source, attribution });
    this.focalX.set(50);
    this.focalY.set(50);
    this.stage.set('focal');
  }
  protected setFocal(e: MouseEvent): void {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.focalX.set(Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))));
    this.focalY.set(Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))));
  }
  protected backToPick(): void {
    this.stage.set('pick');
    this.pending.set(null);
  }
  protected useImage(): void {
    const p = this.pending();
    if (!p) return;
    this.chosen.emit({
      type: 'image',
      url: p.url,
      source: p.source,
      focalX: this.focalX(),
      focalY: this.focalY(),
      attribution: p.attribution,
    });
  }
}
