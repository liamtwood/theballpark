import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, ChevronLeft, ChevronRight, Heart, Plus, SquarePen, Share2, MapPin } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { marked } from 'marked';

import { ItemService } from '../../../../core/services/item.service';
import { SupplierService } from '../../../../core/services/supplier.service';
import { OrgService } from '../../../../core/services/org.service';
import { CategoryService } from '../../../../core/services/category.service';
import { CodelistService } from '../../../../core/services/codelist.service';
import { ProjectItemService } from '../../../../core/services/project-item.service';
import { FavouriteService } from '../../../../core/services/favourite.service';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ItemDrawerComponent } from '../../../../shared/components/item-drawer/item-drawer.component';
import { Item, Org } from '../../../../models';

@Component({
  selector: 'app-item-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, ToastModule, LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, ItemDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <!-- NOT FOUND -->
    <ng-container *ngIf="!loading && !item">
      <div class="bp-itempage-empty">
        <p>Item not found.</p>
        <a routerLink="/suppliers">← Back to {{ catalogueLabel }}</a>
      </div>
    </ng-container>

    <!-- ITEM CONTENT -->
    <div class="bp-itempage" *ngIf="!loading && item">

      <!-- Back link -->
      <a class="bp-itempage-back" (click)="goBack()">
        <lucide-icon name="chevron-left" [size]="12"></lucide-icon>
        Back
      </a>

      <!-- Two-column layout -->
      <div class="bp-itempage-layout">

        <!-- ═══ LEFT: Image gallery ═══ -->
        <div class="bp-itempage-gallery">
          <div class="bp-itempage-hero" [class.bp-itempage-hero--empty]="!galleryImages.length">

            <ng-container *ngIf="galleryImages.length; else heroPlaceholder">
              <img [src]="galleryImages[currentImg]" alt="" />
            </ng-container>
            <ng-template #heroPlaceholder>
              <div class="bp-itempage-hero-initial">{{ (item.name || '?').charAt(0) }}</div>
            </ng-template>

            <ng-container *ngIf="galleryImages.length > 1">
              <button class="bp-itempage-nav bp-itempage-nav--prev" (click)="prevImg()" title="Previous">
                <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
              </button>
              <button class="bp-itempage-nav bp-itempage-nav--next" (click)="nextImg()" title="Next">
                <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
              </button>
              <span class="bp-itempage-counter">{{ currentImg + 1 }} / {{ galleryImages.length }}</span>
            </ng-container>
          </div>

          <div class="bp-itempage-thumbs" *ngIf="galleryImages.length > 1">
            <button *ngFor="let url of galleryImages; let i = index"
              class="bp-itempage-thumb"
              [class.active]="i === currentImg"
              (click)="selectImg(i)">
              <img [src]="url" alt="" />
            </button>
          </div>
        </div>

        <!-- ═══ RIGHT: Details ═══ -->
        <div class="bp-itempage-details">

          <div class="bp-itempage-cat">{{ item.category_name }}</div>
          <h1 class="bp-itempage-name">{{ item.name }}</h1>

          <span *ngIf="item.tier" class="bp-itempage-tier" [ngClass]="'bp-itempage-tier--' + item.tier">
            ✦ {{ tierLabel(item.tier) }}
          </span>

          <!-- Supplier row -->
          <div class="bp-itempage-supp" *ngIf="supplier">
            <div class="bp-itempage-supp-logo">{{ supplierInitials() }}</div>
            <span class="bp-itempage-supp-name">{{ supplier.name }}</span>
            <span class="bp-itempage-supp-loc" *ngIf="supplier.city">· {{ supplier.city }}</span>
            <a class="bp-itempage-supp-link" [routerLink]="['/suppliers', supplier.id]">View supplier →</a>
          </div>

          <!-- Price block -->
          <div class="bp-itempage-price" *ngIf="item.base_price != null">
            <div class="bp-itempage-price-row">
              <span class="bp-itempage-price-main">{{ item.base_price | gbp }}</span>
              <span class="bp-itempage-price-unit" *ngIf="item.unit">per {{ unitLabel(item.unit) }}</span>
            </div>
            <div class="bp-itempage-price-range" *ngIf="item.min_price != null && item.max_price != null">
              Range: {{ item.min_price | gbp }} – {{ item.max_price | gbp }}
            </div>
            <div class="bp-itempage-price-detail" *ngIf="item.min_price != null || item.max_price != null">
              <div class="bp-itempage-price-cell">
                <div class="bp-itempage-price-label">Min</div>
                <div class="bp-itempage-price-value">{{ item.min_price != null ? (item.min_price | gbp) : '—' }}</div>
              </div>
              <div class="bp-itempage-price-cell">
                <div class="bp-itempage-price-label">Ballpark</div>
                <div class="bp-itempage-price-value bp-itempage-price-value--accent">{{ item.base_price | gbp }}</div>
              </div>
              <div class="bp-itempage-price-cell">
                <div class="bp-itempage-price-label">Max</div>
                <div class="bp-itempage-price-value">{{ item.max_price != null ? (item.max_price | gbp) : '—' }}</div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="bp-itempage-actions">
            <button class="bp-itempage-btn bp-itempage-btn--primary" (click)="addToProject()">
              <lucide-icon name="plus" [size]="14"></lucide-icon> Add to project
            </button>
            <button class="bp-itempage-btn bp-itempage-btn--secondary" (click)="toggleWishlist()"
                    [class.is-active]="isFav">
              <lucide-icon name="heart" [size]="14"></lucide-icon>
              {{ isFav ? 'Wishlisted' : 'Wishlist' }}
            </button>
            <button class="bp-itempage-btn bp-itempage-btn--icon" (click)="openEdit()" title="Edit">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
            <button class="bp-itempage-btn bp-itempage-btn--icon" (click)="copyLink()" title="Share">
              <lucide-icon name="share-2" [size]="14"></lucide-icon>
            </button>
          </div>

          <!-- Description -->
          <div class="bp-itempage-section" *ngIf="item.description">
            <div class="bp-itempage-section-label">Description</div>
            <div class="bp-itempage-section-text" [innerHTML]="descriptionHtml"></div>
          </div>

          <!-- Specs table -->
          <div class="bp-itempage-specs">
            <div class="bp-itempage-spec-row">
              <div class="bp-itempage-spec-label">Category</div>
              <div class="bp-itempage-spec-value">{{ item.category_name || '—' }}</div>
            </div>
            <div class="bp-itempage-spec-row">
              <div class="bp-itempage-spec-label">Subcategory</div>
              <!-- v1.34: items.subcategory doesn't exist on the model today;
                   render an em-dash until a subcategory field lands. -->
              <div class="bp-itempage-spec-value">—</div>
            </div>
            <div class="bp-itempage-spec-row">
              <div class="bp-itempage-spec-label">Lead time</div>
              <div class="bp-itempage-spec-value">{{ leadTimeLabel() }}</div>
            </div>
            <div class="bp-itempage-spec-row">
              <div class="bp-itempage-spec-label">Unit</div>
              <div class="bp-itempage-spec-value">{{ unitLabel(item.unit) || '—' }}</div>
            </div>
            <div class="bp-itempage-spec-row">
              <div class="bp-itempage-spec-label">Time unit</div>
              <div class="bp-itempage-spec-value">{{ timeUnitLabel() }}</div>
            </div>
            <div class="bp-itempage-spec-row" *ngIf="item.tier">
              <div class="bp-itempage-spec-label">Tier</div>
              <div class="bp-itempage-spec-value">
                <span class="bp-itempage-tier bp-itempage-tier--small" [ngClass]="'bp-itempage-tier--' + item.tier">
                  {{ tierLabel(item.tier) }}
                </span>
              </div>
            </div>
            <div class="bp-itempage-spec-row" *ngIf="item.external_url">
              <div class="bp-itempage-spec-label">External link</div>
              <div class="bp-itempage-spec-value">
                <a [href]="item.external_url" target="_blank" rel="noopener">{{ shortUrl(item.external_url) }} →</a>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div class="bp-itempage-section" *ngIf="item.tags && item.tags.length">
            <div class="bp-itempage-section-label">Tags</div>
            <div class="bp-itempage-tags">
              <span *ngFor="let t of item.tags" class="bp-itempage-tag">{{ t }}</span>
            </div>
          </div>

          <!-- Supplier card -->
          <div class="bp-itempage-section" *ngIf="supplier">
            <div class="bp-itempage-section-label">Supplier</div>
            <a class="bp-itempage-supp-card" [routerLink]="['/suppliers', supplier.id]">
              <div class="bp-itempage-supp-cover"
                   [style.background-image]="supplier.cover_image_url ? 'url(' + supplier.cover_image_url + ')' : null">
              </div>
              <div class="bp-itempage-supp-body">
                <div class="bp-itempage-supp-card-name">{{ supplier.name }}</div>
                <div class="bp-itempage-supp-card-loc" *ngIf="supplier.city">
                  <lucide-icon name="map-pin" [size]="11"></lucide-icon> {{ supplier.city }}
                </div>
                <div class="bp-itempage-supp-card-desc" *ngIf="supplier.description">{{ supplier.description }}</div>
                <span class="bp-itempage-supp-card-link">View full catalogue →</span>
              </div>
            </a>
          </div>

        </div>
      </div>

      <!-- ═══ Related items ═══ -->
      <div class="bp-itempage-related" *ngIf="related.length">
        <div class="bp-itempage-related-title">More from {{ item.category_name }}</div>
        <div class="bp-itempage-related-grid">
          <a *ngFor="let r of related"
             class="bp-itempage-related-card"
             [routerLink]="['/items', r.id]"
             [state]="{ backUrl: backUrl }">
            <div class="bp-itempage-related-img"
                 [style.background-image]="r.image_url ? 'url(' + r.image_url + ')' : null">
              <div *ngIf="!r.image_url" class="bp-itempage-related-img-initial">{{ (r.name || '?').charAt(0) }}</div>
            </div>
            <div class="bp-itempage-related-body">
              <div class="bp-itempage-related-name">{{ r.name }}</div>
              <div>
                <span class="bp-itempage-related-price">{{ r.base_price | gbp }}</span>
                <span class="bp-itempage-related-unit" *ngIf="r.unit">{{ unitLabel(r.unit) }}</span>
              </div>
              <div class="bp-itempage-related-supp" *ngIf="supplierNameOf(r)">{{ supplierNameOf(r) }}</div>
            </div>
          </a>
        </div>
      </div>
    </div>

    <!-- ITEM EDIT DRAWER (reused) -->
    <app-item-drawer
      [(visible)]="showEditDrawer"
      [item]="item"
      (saved)="onItemSaved($event)"
      (cancelled)="showEditDrawer = false">
    </app-item-drawer>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }

    .bp-itempage { max-width: 1100px; margin: 0 auto; padding: 24px var(--section-pad); }
    .bp-itempage-empty {
      text-align: center; padding: 80px 0; color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    .bp-itempage-empty a { color: var(--theme-accent); display: inline-block; margin-top: 8px; }

    /* Back link */
    .bp-itempage-back {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); color: var(--color-text-muted);
      cursor: pointer; margin-bottom: 16px; text-decoration: none;
      transition: color 0.15s;
    }
    .bp-itempage-back:hover { color: var(--theme-accent); }

    /* ── Layout ── */
    .bp-itempage-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }

    /* ── Gallery ── */
    .bp-itempage-gallery { position: sticky; top: 20px; align-self: start; }
    .bp-itempage-hero {
      width: 100%; aspect-ratio: 1;
      border-radius: var(--radius-card);
      overflow: hidden;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      margin-bottom: 10px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .bp-itempage-hero img { width: 100%; height: 100%; object-fit: cover; }
    .bp-itempage-hero-initial {
      font-family: var(--font-display); font-size: 80px;
      color: var(--color-text-muted);
    }
    .bp-itempage-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--color-text-muted);
      transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .bp-itempage-nav:hover { color: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-itempage-nav--prev { left: 10px; }
    .bp-itempage-nav--next { right: 10px; }
    .bp-itempage-counter {
      position: absolute; bottom: 10px; right: 10px;
      background: rgba(0,0,0,0.6); color: #fff;
      font-size: 10px; padding: 2px 8px;
      border-radius: var(--radius-pill);
    }
    .bp-itempage-thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
    .bp-itempage-thumb {
      width: 72px; height: 72px; padding: 0;
      border-radius: var(--radius-button); overflow: hidden;
      cursor: pointer; border: 2px solid transparent;
      transition: border-color 0.15s;
      background: var(--color-surface); flex-shrink: 0;
    }
    .bp-itempage-thumb.active { border-color: var(--theme-accent); }
    .bp-itempage-thumb:hover { border-color: var(--theme-accent); opacity: 0.7; }
    .bp-itempage-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* ── Details ── */
    .bp-itempage-details { padding-top: 4px; min-width: 0; }
    .bp-itempage-cat {
      font-size: 10px; font-weight: 500; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--theme-accent);
      margin-bottom: 4px;
    }
    .bp-itempage-name {
      font-family: var(--font-display); font-size: 26px;
      font-weight: 400; line-height: 1.2; margin: 0 0 6px;
      color: var(--color-text-primary);
    }

    /* Tier badge */
    .bp-itempage-tier {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 500;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      margin-bottom: 12px;
    }
    .bp-itempage-tier--small { font-size: 10px; padding: 2px 8px; margin-bottom: 0; }
    .bp-itempage-tier--basic   { background: #F3F4F6; color: #6B7280; }
    .bp-itempage-tier--mid     { background: #EDE9FE; color: #5B21B6; }
    .bp-itempage-tier--premium { background: #FEF3C7; color: #92400E; }

    /* Supplier row */
    .bp-itempage-supp {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 16px;
    }
    .bp-itempage-supp-logo {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--theme-bg); color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 500;
      flex-shrink: 0;
    }
    .bp-itempage-supp-name { font-size: var(--text-sm); font-weight: 500; color: var(--color-text-primary); }
    .bp-itempage-supp-loc { font-size: var(--text-xs); color: var(--color-text-muted); }
    .bp-itempage-supp-link {
      font-size: var(--text-xs); color: var(--theme-accent);
      margin-left: auto; cursor: pointer; text-decoration: none;
    }
    .bp-itempage-supp-link:hover { text-decoration: underline; }

    /* Price block */
    .bp-itempage-price {
      padding: 16px 18px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-card);
      margin-bottom: 16px;
    }
    .bp-itempage-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .bp-itempage-price-main { font-family: var(--font-display); font-size: 28px; color: var(--color-text-primary); }
    .bp-itempage-price-unit { font-size: var(--text-sm); color: var(--color-text-muted); }
    .bp-itempage-price-range { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 10px; }
    .bp-itempage-price-detail { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .bp-itempage-price-cell {
      text-align: center; padding: 8px;
      background: var(--theme-bg);
      border-radius: 6px;
    }
    .bp-itempage-price-label {
      font-size: 9px; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
      margin-bottom: 2px;
    }
    .bp-itempage-price-value { font-family: var(--font-display); font-size: 15px; color: var(--color-text-primary); }
    .bp-itempage-price-value--accent { color: var(--theme-accent); }

    /* Actions */
    .bp-itempage-actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .bp-itempage-btn {
      padding: 11px; font-size: var(--text-sm); font-weight: 500;
      border-radius: var(--radius-button);
      cursor: pointer; font-family: var(--font-body);
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all 0.15s;
    }
    .bp-itempage-btn--primary {
      flex: 1; border: none;
      background: var(--theme-accent); color: #fff;
    }
    .bp-itempage-btn--primary:hover { opacity: 0.9; }
    .bp-itempage-btn--secondary {
      flex: 1;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface); color: var(--color-text-primary);
    }
    .bp-itempage-btn--secondary:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-itempage-btn--secondary.is-active { color: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-itempage-btn--icon {
      width: 42px; padding: 11px; flex-shrink: 0;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface); color: var(--color-text-muted);
    }
    .bp-itempage-btn--icon:hover { border-color: var(--theme-accent); color: var(--theme-accent); }

    /* Sections */
    .bp-itempage-section { margin-bottom: 20px; }
    .bp-itempage-section-label {
      font-size: 10px; font-weight: 500; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--theme-accent);
      margin-bottom: 8px; padding-bottom: 6px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-itempage-section-text {
      font-size: var(--text-sm); line-height: 1.7;
      color: var(--color-text-secondary);
    }
    .bp-itempage-section-text :first-child { margin-top: 0; }
    .bp-itempage-section-text p { margin: 0 0 8px; }
    .bp-itempage-section-text ul, .bp-itempage-section-text ol { margin: 0 0 8px 18px; }

    /* Specs table */
    .bp-itempage-specs {
      border: 0.5px solid var(--color-border);
      border-radius: 10px; overflow: hidden;
      margin-bottom: 20px;
    }
    .bp-itempage-spec-row {
      display: flex;
      border-bottom: 0.5px solid var(--color-border);
      font-size: var(--text-xs);
    }
    .bp-itempage-spec-row:last-child { border-bottom: none; }
    .bp-itempage-spec-label {
      width: 140px; padding: 8px 14px;
      background: var(--theme-bg);
      color: var(--color-text-muted);
      font-weight: 500; flex-shrink: 0;
    }
    .bp-itempage-spec-value { padding: 8px 14px; flex: 1; color: var(--color-text-primary); }
    .bp-itempage-spec-value a { color: var(--theme-accent); text-decoration: none; }
    .bp-itempage-spec-value a:hover { text-decoration: underline; }

    /* Tags */
    .bp-itempage-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-itempage-tag {
      font-size: 10px; padding: 3px 8px;
      border-radius: var(--radius-pill);
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
    }

    /* Supplier card — v1.34b: constrained width + taller cover for a more
       square card silhouette (matches the dashboard saved-suppliers shape). */
    .bp-itempage-supp-card {
      display: block; text-decoration: none;
      max-width: 320px;
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-card);
      overflow: hidden; background: var(--color-surface);
      transition: box-shadow 0.15s;
    }
    .bp-itempage-supp-card:hover { box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .bp-itempage-supp-cover {
      height: 180px; background: var(--theme-bg);
      background-size: cover; background-position: center;
    }
    .bp-itempage-supp-body { padding: 14px 16px; }
    .bp-itempage-supp-card-name { font-size: var(--text-sm); font-weight: 500; color: var(--color-text-primary); margin-bottom: 2px; }
    .bp-itempage-supp-card-loc {
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin-bottom: 8px; display: inline-flex; align-items: center; gap: 4px;
    }
    .bp-itempage-supp-card-desc {
      font-size: var(--text-xs); color: var(--color-text-muted);
      line-height: 1.5; margin-bottom: 10px;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
    .bp-itempage-supp-card-link {
      font-size: var(--text-xs); color: var(--theme-accent);
      font-weight: 500;
    }

    /* Related items */
    .bp-itempage-related {
      margin-top: 32px; padding-top: 20px;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-itempage-related-title {
      font-family: var(--font-display); font-size: 18px;
      color: var(--color-text-primary); margin-bottom: 14px;
    }
    .bp-itempage-related-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    }
    .bp-itempage-related-card {
      display: block; text-decoration: none;
      border: 0.5px solid var(--color-border);
      border-radius: 10px; overflow: hidden;
      background: var(--color-surface);
      transition: box-shadow 0.15s, transform 0.15s;
      color: var(--color-text-primary);
    }
    .bp-itempage-related-card:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transform: translateY(-1px);
    }
    .bp-itempage-related-img {
      height: 120px; background: var(--theme-bg);
      background-size: cover; background-position: center;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-itempage-related-img-initial {
      font-family: var(--font-display); font-size: 32px;
      color: var(--color-text-muted);
    }
    .bp-itempage-related-body { padding: 10px 12px; }
    .bp-itempage-related-name {
      font-size: var(--text-xs); font-weight: 500;
      margin-bottom: 2px;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
      line-height: 1.3;
    }
    .bp-itempage-related-price { font-family: var(--font-display); font-size: 14px; color: var(--color-text-primary); }
    .bp-itempage-related-unit { font-size: 10px; color: var(--color-text-muted); margin-left: 4px; }
    .bp-itempage-related-supp { font-size: 10px; color: var(--color-text-muted); margin-top: 2px; }

    /* Responsive */
    @media (max-width: 768px) {
      .bp-itempage-layout { grid-template-columns: 1fr; gap: 24px; }
      .bp-itempage-gallery { position: static; }
      .bp-itempage-related-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class ItemDetailPageComponent implements OnInit {
  item: Item | null = null;
  supplier: Org | null = null;
  related: Item[] = [];
  galleryImages: string[] = [];
  currentImg = 0;
  isFav = false;
  loading = true;
  showEditDrawer = false;
  descriptionHtml: SafeHtml = '';
  catalogueLabel = 'catalogue';
  /** v1.34: project context via ?projectId= query param. When present the
      Add-to-project button targets that project. When absent we just toast. */
  private projectId = '';
  /** v1.34c: back-target URL stamped into history.state by whichever surface
      navigated us here (marketplace / shop front / project marketplace tab).
      Persisted across related-item clicks so the user always returns to
      their original entry point, never the previous item or the shop front. */
  backUrl = '/suppliers';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private itemSvc: ItemService,
    private supplierSvc: SupplierService,
    private orgSvc: OrgService,
    private categorySvc: CategoryService,
    private codelistSvc: CodelistService,
    private projectItemSvc: ProjectItemService,
    private favSvc: FavouriteService,
    private msg: MessageService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.queryParams['projectId'] || '';

    // v1.34c: capture backUrl from history.state on first hit. We do NOT
    // overwrite on subsequent related-item clicks within the same session
    // because the related-item routerLink propagates the same backUrl via
    // [state] — so chained nav still returns to the original entry point.
    const state = (window.history.state || {}) as { backUrl?: string };
    if (state.backUrl) this.backUrl = state.backUrl;
    else if (this.projectId) this.backUrl = `/projects/${this.projectId}/marketplace`;
    else this.backUrl = '/suppliers';

    this.codelistSvc.getByName('item_unit').subscribe(() => this.cdr.markForCheck());
    this.codelistSvc.getByName('item_time_unit').subscribe(() => this.cdr.markForCheck());

    this.route.params.subscribe(params => {
      const id = params['id'];
      if (!id) { this.loading = false; this.cdr.markForCheck(); return; }
      this.loadItem(id);
    });
  }

  private loadItem(id: string) {
    this.loading = true;
    this.itemSvc.getById(id).pipe(
      catchError(() => of(null as Item | null))
    ).subscribe(item => {
      this.item = item;
      if (!item) { this.loading = false; this.cdr.markForCheck(); return; }

      this.galleryImages = this.buildGallery(item);
      this.currentImg = 0;
      this.descriptionHtml = this.renderDescription(item.description);
      this.isFav = this.favSvc.isItemFavourited(item.id);

      const supplier$ = item.org_id
        ? this.orgSvc.getById(item.org_id).pipe(catchError(() => of(null as Org | null)))
        : of(null as Org | null);
      const related$ = item.category_id
        ? this.supplierSvc.getItems({ category_id: item.category_id }).pipe(catchError(() => of([])))
        : of([]);

      forkJoin({ supplier: supplier$, related: related$ }).subscribe(({ supplier, related }) => {
        this.supplier = supplier;
        this.related = (related || [])
          .filter((r: any) => r.id !== item.id)
          .slice(0, 4);
        this.loading = false;
        this.cdr.markForCheck();
      });
    });
  }

  private buildGallery(item: Item): string[] {
    if (item.images && item.images.length) {
      return [...item.images]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(i => i.url)
        .filter(Boolean);
    }
    if (item.image_url) return [item.image_url];
    return [];
  }

  private renderDescription(md?: string): SafeHtml {
    if (!md) return '';
    const html = marked.parse(md, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  selectImg(idx: number) { this.currentImg = idx; this.cdr.markForCheck(); }
  nextImg() { this.currentImg = (this.currentImg + 1) % this.galleryImages.length; this.cdr.markForCheck(); }
  prevImg() {
    this.currentImg = (this.currentImg - 1 + this.galleryImages.length) % this.galleryImages.length;
    this.cdr.markForCheck();
  }

  tierLabel(tier?: string | null): string {
    if (!tier) return '';
    const fromCodelist = this.codelistSvc.getLabel('item_tier', tier);
    if (fromCodelist && fromCodelist !== tier) return fromCodelist;
    return ({ basic: 'Core', mid: 'Signature', premium: 'Premium' } as Record<string, string>)[tier] || tier;
  }

  unitLabel(unit?: string | null): string {
    if (!unit) return '';
    return this.codelistSvc.getDisplay(unit, ['item_unit']) || unit;
  }

  timeUnitLabel(): string {
    if (!this.item?.time_unit) return '—';
    return this.codelistSvc.getDisplay(this.item.time_unit, ['item_time_unit']) || this.item.time_unit;
  }

  leadTimeLabel(): string {
    const days = this.item?.lead_time_days;
    if (!days && days !== 0) return '—';
    if (days % 7 === 0 && days >= 7) {
      const weeks = days / 7;
      return `${weeks} week${weeks === 1 ? '' : 's'}`;
    }
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  supplierInitials(): string {
    const name = this.supplier?.name || '';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
  }

  shortUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40);
  }

  supplierNameOf(item: Item): string {
    return (item as any)?.supplier_name || (item as any)?.org_name || '';
  }

  addToProject() {
    if (!this.item) return;
    if (!this.projectId) {
      this.msg.add({ severity: 'info', summary: 'Select a project first', detail: 'Open a project to add items.' });
      return;
    }
    this.projectItemSvc.add(this.projectId, this.item.id, 'selected').subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Added to project' }),
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add item' })
    });
  }

  toggleWishlist() {
    if (!this.item) return;
    if (this.projectId) {
      this.projectItemSvc.add(this.projectId, this.item.id, 'liked').subscribe({
        next: () => {
          this.isFav = true;
          this.msg.add({ severity: 'success', summary: 'Wishlisted' });
          this.cdr.markForCheck();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Could not wishlist' })
      });
      return;
    }
    this.favSvc.toggleItem(this.item.id).subscribe({
      next: result => {
        this.isFav = result.favourited;
        this.msg.add({ severity: 'success', summary: result.favourited ? 'Wishlisted' : 'Removed from wishlist' });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not update wishlist' })
    });
  }

  openEdit() { this.showEditDrawer = true; }

  onItemSaved(updated: Item) {
    if (updated) {
      this.item = { ...this.item, ...updated };
      this.galleryImages = this.buildGallery(this.item);
      this.descriptionHtml = this.renderDescription(this.item.description);
      this.currentImg = 0;
      this.cdr.markForCheck();
    }
    this.showEditDrawer = false;
  }

  copyLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => this.msg.add({ severity: 'success', summary: 'Link copied' }),
        () => this.msg.add({ severity: 'error', summary: 'Could not copy link' })
      );
    } else {
      this.msg.add({ severity: 'info', summary: url });
    }
  }

  /** v1.34c: navigate explicitly to the stamped backUrl rather than using
      history.back(). This skips the supplier shop front when the user
      arrived via a shop front (the user's complaint: Back from item
      details was landing on supplier home instead of the marketplace
      where they were browsing). Also survives chained related-item
      clicks because the backUrl is propagated forward in [state]. */
  goBack() {
    this.router.navigateByUrl(this.backUrl);
  }
}
