import {
  Component, Input, Output, EventEmitter, ViewChild, ElementRef,
  AfterViewInit, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule, ChevronLeft, ChevronRight, Layers, SquarePen
} from 'lucide-angular';

/**
 * Shared category-circle strip — single source of truth for the
 * "scrollable row of circles + All pseudo-circle + scroll arrows
 * + optional footer toggle" pattern. Mounted by:
 *
 *   - app-catalogue-grid  (marketplace, suppliers, feedback grids)
 *   - app-messages-inbox  (project Messages tab)
 *
 * The component is dumb: callers pass in the categories to render
 * and the current `activeId`; this component handles the visuals
 * + scroll-arrow state and emits `select` / `edit` / `footerToggle`.
 * Class names + sizing variants live in the shared
 * "CATALOGUE / INBOX SHELL" block in styles.css.
 *
 * If two consumers ever drift visually, the fix lands here once —
 * never duplicate this markup in a consumer.
 */
export interface CategoryCircle {
  id: string;
  name: string;
  cover_image_url?: string;
  logo_url?: string;
  icon?: string;
  icon_name?: string;
  icon_color?: string;
}

@Component({
  selector: 'app-category-circles',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bp-cat-circles-wrap"
         *ngIf="categories.length || showAll"
         [attr.data-circle-size]="size">

      <button type="button"
              class="bp-circles-arrow bp-circles-arrow--left"
              *ngIf="canScrollLeft"
              (click)="scroll(-200)">
        <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
      </button>

      <div class="bp-cat-circles" #strip (scroll)="onScroll()">
        <!-- "All" pseudo-circle -->
        <button *ngIf="showAll"
                type="button"
                class="bp-cat-circle-btn"
                [class.active]="activeId === 'all'"
                (click)="select.emit('all')">
          <div class="bp-cat-circle bp-cat-circle--all">
            <lucide-icon name="layers" [size]="iconSize"></lucide-icon>
          </div>
          <span class="bp-cat-circle-label">All</span>
        </button>

        <!-- Category circles. Fallback chain mirrors catalogue-grid:
             cover_image_url → logo_url → icon_name → icon → initials. -->
        <button *ngFor="let cat of categories"
                type="button"
                class="bp-cat-circle-btn"
                [class.active]="activeId === cat.id"
                [class.bp-cat-circle-btn--unscoped]="unscopedIds.has(cat.id)"
                (click)="select.emit(cat.id)">
          <div class="bp-cat-circle"
               [style.background-image]="cat.cover_image_url ? 'url(' + cat.cover_image_url + ')' : null"
               [style.background-color]="!cat.cover_image_url && !cat.logo_url && cat.icon_name && cat.icon_color ? cat.icon_color : null"
               [class.bp-cat-circle--no-image]="!cat.cover_image_url && !cat.logo_url && !cat.icon_name"
               [class.bp-cat-circle--logo]="!!cat.logo_url && !cat.cover_image_url">
            <img *ngIf="cat.logo_url && !cat.cover_image_url"
                 [src]="cat.logo_url" [alt]="cat.name"
                 class="bp-cat-circle-logo-img"/>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && cat.icon_name"
                         [name]="cat.icon_name" [size]="iconSize"
                         class="bp-cat-circle-lucide"></lucide-icon>
            <lucide-icon *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && cat.icon"
                         [name]="cat.icon" [size]="iconSize"
                         class="bp-cat-circle-icon"></lucide-icon>
            <span *ngIf="!cat.cover_image_url && !cat.logo_url && !cat.icon_name && !cat.icon"
                  class="bp-cat-circle-initials">{{ (cat.name || '?').charAt(0) }}</span>
            <button *ngIf="showEdit"
                    type="button"
                    class="bp-cat-circle-edit"
                    (click)="onEdit($event, cat)"
                    title="Edit image">
              <lucide-icon name="square-pen" [size]="12"></lucide-icon>
            </button>
            <span *ngIf="badgeFor(cat.id) as n"
                  class="bp-cat-circle-badge">{{ n }}</span>
          </div>
          <span class="bp-cat-circle-label">{{ cat.name }}</span>
        </button>
      </div>

      <button type="button"
              class="bp-circles-arrow bp-circles-arrow--right"
              *ngIf="canScrollRight"
              (click)="scroll(200)">
        <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
      </button>

      <button *ngIf="footerToggleLabel"
              type="button"
              class="bp-circles-toggle"
              (click)="footerToggle.emit()">
        {{ footerToggleLabel }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: contents; }
  `]
})
export class CategoryCirclesComponent implements AfterViewInit, OnChanges {
  /** Ordered list of categories to render (caller decides scoped-only
      vs all). */
  @Input() categories: CategoryCircle[] = [];
  /** Currently active circle — 'all' or a category id. */
  @Input() activeId: string = 'all';
  /** Circle size — sm/md/lg map to 56/72/96px (see styles.css). */
  @Input() size: 'sm' | 'md' | 'lg' = 'lg';
  /** Render the "All" pseudo-circle at the start of the strip. */
  @Input() showAll = true;
  /** Render the small edit-pencil overlay on each circle. */
  @Input() showEdit = false;
  /** IDs to render greyed via .bp-cat-circle-btn--unscoped. Catalogue
      uses this for "not in project_categories"; Messages uses it for
      "no threads in this category". Both look the same. */
  @Input() unscopedIds: ReadonlySet<string> = new Set();
  /** Optional unread/count badge per id (Messages tab uses this). */
  @Input() badgeCounts: ReadonlyMap<string, number> = new Map();
  /** Renders a right-aligned text toggle (e.g. "Show all categories"
      on the Build/Estimate tab). Omit to hide. */
  @Input() footerToggleLabel?: string;

  /** Fires with 'all' or a category id. */
  @Output() select = new EventEmitter<string>();
  /** Fires with the clicked category when the edit pencil is used.
      Only emitted when [showEdit]=true. */
  @Output() edit = new EventEmitter<CategoryCircle>();
  /** Fires when the optional footer toggle button is clicked. */
  @Output() footerToggle = new EventEmitter<void>();

  @ViewChild('strip') stripRef?: ElementRef<HTMLDivElement>;
  canScrollLeft = false;
  canScrollRight = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() { setTimeout(() => this.checkScroll(), 0); }
  ngOnChanges(c: SimpleChanges) {
    if (c['categories']) setTimeout(() => this.checkScroll(), 0);
  }

  /** Lucide icon size for the circle strip — scales with `size`.
      Same values catalogue-grid was using before extraction. */
  get iconSize(): number {
    if (this.size === 'sm') return 20;
    if (this.size === 'md') return 26;
    return 34;
  }

  onScroll() { this.checkScroll(); }

  scroll(delta: number) {
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(() => this.checkScroll(), 350);
  }

  private checkScroll() {
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    this.canScrollLeft  = el.scrollLeft > 0;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    this.cdr.detectChanges();
  }

  onEdit(ev: MouseEvent, cat: CategoryCircle) {
    ev.stopPropagation();
    this.edit.emit(cat);
  }

  badgeFor(id: string): number | null {
    const n = this.badgeCounts.get(id);
    return n && n > 0 ? n : null;
  }
}
