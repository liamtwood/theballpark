import { Component, OnInit, Input, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  LucideAngularModule,
  Warehouse, Headset, Spotlight, Signature, Martini, PersonStanding,
  ChevronLeft, ChevronRight,
  // v1.27 — circles, view toggle, search
  Layers, List, LayoutGrid, Table, Search, Inbox
} from 'lucide-angular';
import { MessageService as MsgSvc } from '../../../core/services/message.service';
import { ProjectCategoryService } from '../../../core/services/project-category.service';
import { ProjectService } from '../../../core/services/project.service';
import { OrgService } from '../../../core/services/org.service';
import { ShellContextService } from '../../../core/services/shell-context.service';
import { Project, Message } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import {
  CategoryCirclesComponent, CategoryCircle
} from '../category-circles/category-circles.component';

const STATUSES = [
  { id: 'all',           label: 'All',     color: '' },
  { id: 'action_needed', label: 'Action',  color: '#DC2626' },
  { id: 'follow_up',     label: 'Waiting', color: '#D97706' },
  { id: 'quoted',        label: 'Quoted',  color: '#2563EB' },
  { id: 'booked',        label: 'Booked',  color: '#059669' },
];

interface QuotedItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  accepted: boolean;
}

interface ThreadMessage extends Message {
  supplier_org_id?: string;
  supplier_name?: string;
  category_id?: string;
  category_name?: string;
  msg_status?: string;
  read?: boolean;
  quoted_items?: QuotedItem[];
  project_name?: string;
}

interface VendorThread {
  key: string;
  supplierId: string;
  supplierName: string;
  categoryId: string;
  categoryName: string;
  projectId: string;
  projectName: string;
  latestMsg: ThreadMessage;
  status: string;
  count: number;
  unread: boolean;
  messages: ThreadMessage[];
}

@Component({
  selector: 'app-messages-inbox',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, InputTextModule, DropdownModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, CategoryCirclesComponent
  ],
  providers: [MessageService, DatePipe],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- PROJECT SELECTOR — global mode only -->
      <div class="bp-msg-project-bar" *ngIf="!boundProjectId">
        <p-dropdown
          [(ngModel)]="selectedProjectId"
          [options]="projectOptions"
          optionLabel="name" optionValue="id"
          styleClass="w-full bp-input-edit"
          placeholder="All projects"
          (onChange)="onProjectChange()">
        </p-dropdown>
      </div>

      <!-- ═══════════════ CATEGORY CIRCLES ═══════════════
           Same component the Marketplace tab mounts — single source of
           truth for the circle row (markup, scroll, hover, active,
           sizing). Inputs: in-scope project categories, current
           activeFolder, unread badges, "no-threads = greyed". -->
      <app-category-circles
        *ngIf="categoryFolders.length > 0"
        [categories]="categoryFolders"
        [activeId]="activeFolder"
        size="lg"
        [unscopedIds]="emptyCategoryIds"
        [badgeCounts]="unreadBadgeCounts"
        (select)="onCircleSelect($event)">
      </app-category-circles>

      <!-- ═══════════════ THREE-COLUMN BODY ═══════════════
           Reuses the marketplace bp-cat-body--detail grid: sidebar
           (260) | main (1fr) | detail (md=320). Content inside each
           column is message-specific; the shell is shared. -->
      <div class="bp-cat-body bp-cat-body--detail" data-detail-size="md">

        <!-- ── LEFT SIDEBAR: search + status + suppliers ── -->
        <aside class="bp-cat-sidebar">
          <div class="bp-sidebar-search">
            <lucide-icon name="search" [size]="14" class="bp-sidebar-search-icon"></lucide-icon>
            <input pInputText type="text"
                   [(ngModel)]="searchTerm"
                   (ngModelChange)="onSearchChange()"
                   placeholder="Search..."
                   class="bp-sidebar-search-input"/>
          </div>

          <!-- v1.28: STATUS moved here from the centre column so all the
               filters share one rail. Uses the shared bp-sidebar-item /
               -count primitives — identical look to the suppliers list. -->
          <div class="bp-sidebar-sublabel">Status</div>
          <button *ngFor="let s of statuses"
                  type="button"
                  class="bp-sidebar-item"
                  [class.active]="activeStatus === s.id"
                  (click)="activeStatus = s.id; cdr.detectChanges()">
            <span>{{ s.label }}</span>
            <span class="bp-sidebar-count">{{ s.id === 'all' ? threads.length : countByStatus(s.id) }}</span>
          </button>

          <div class="bp-sidebar-sublabel" style="margin-top:16px">Suppliers</div>
          <button type="button"
                  class="bp-sidebar-item"
                  [class.active]="activeSupplier === 'all'"
                  (click)="activeSupplier = 'all'; cdr.detectChanges()">
            <span>All threads</span>
            <span class="bp-sidebar-count">{{ threads.length }}</span>
          </button>
          <button *ngFor="let s of supplierList"
                  type="button"
                  class="bp-sidebar-item"
                  [class.active]="activeSupplier === s.id"
                  (click)="activeSupplier = s.id; cdr.detectChanges()">
            <span class="bp-msg-supp-name">{{ s.name }}</span>
            <span class="bp-sidebar-count">{{ s.count }}</span>
          </button>
        </aside>

        <!-- ── MAIN: section header + filter + list/card/table ── -->
        <section class="bp-cat-main">
          <div class="bp-cat-section-header">
            <span class="bp-cat-section-title">MESSAGES</span>
            <span class="bp-cat-section-count">
              {{ filteredThreads().length }}
              {{ filteredThreads().length === 1 ? 'thread' : 'threads' }}
            </span>
            <div class="bp-view-toggle">
              <button type="button" class="bp-view-btn"
                      [class.active]="activeView === 'list'"
                      title="List"
                      (click)="activeView = 'list'; cdr.detectChanges()">
                <lucide-icon name="list" [size]="14"></lucide-icon>
              </button>
              <button type="button" class="bp-view-btn"
                      [class.active]="activeView === 'card'"
                      title="Cards"
                      (click)="activeView = 'card'; cdr.detectChanges()">
                <lucide-icon name="layout-grid" [size]="14"></lucide-icon>
              </button>
              <button type="button" class="bp-view-btn"
                      [class.active]="activeView === 'table'"
                      title="Table"
                      (click)="activeView = 'table'; cdr.detectChanges()">
                <lucide-icon name="table" [size]="14"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- v1.28: Status pills moved to the left sidebar — only ONE
               filter rail across the page now. -->

          <!-- Empty state -->
          <div *ngIf="filteredThreads().length === 0" class="bp-msg-empty">
            <lucide-icon name="inbox" [size]="32"></lucide-icon>
            <p *ngIf="!selectedProjectId && !boundProjectId">
              Select a project or send a quote request to see messages here.
            </p>
            <p *ngIf="(selectedProjectId || boundProjectId) && !searchTerm">
              No messages yet. Request quotes from the Marketplace tab.
            </p>
            <p *ngIf="(selectedProjectId || boundProjectId) && searchTerm">
              No threads match "{{ searchTerm }}".
            </p>
          </div>

          <!-- ── LIST VIEW ── -->
          <div *ngIf="activeView === 'list' && filteredThreads().length > 0"
               class="bp-msg-list">
            <div *ngFor="let t of filteredThreads()"
                 class="bp-msg-row"
                 [class.active]="activeThread?.key === t.key"
                 [class.unread]="t.unread"
                 (click)="openThread(t)">
              <div class="bp-msg-avatar">{{ initialsFor(t.supplierName) }}</div>
              <div class="bp-msg-tbody">
                <div class="bp-msg-ttop">
                  <span class="bp-msg-tname">{{ t.supplierName }}</span>
                  <span class="bp-msg-ttime">{{ fmtTime(t.latestMsg.created_at) }}</span>
                </div>
                <div class="bp-msg-tprev">{{ t.latestMsg.body }}</div>
                <div class="bp-msg-tmeta">
                  <span *ngIf="t.status && t.status !== 'all'"
                        class="bp-msg-tbadge"
                        [ngClass]="'bp-badge-' + statusClass(t.status)">
                    {{ statusLabel(t.status) }}
                  </span>
                  <span class="bp-msg-tcat">{{ t.categoryName }}</span>
                  <span *ngIf="!boundProjectId && t.projectName"
                        class="bp-msg-tproj"> · {{ t.projectName }}</span>
                </div>
              </div>
              <span *ngIf="t.unread" class="bp-msg-udot"></span>
            </div>
          </div>

          <!-- ── CARD VIEW ── -->
          <div *ngIf="activeView === 'card' && filteredThreads().length > 0"
               class="bp-msg-cards">
            <div *ngFor="let t of filteredThreads()"
                 class="bp-msg-card-tile"
                 [class.active]="activeThread?.key === t.key"
                 [class.unread]="t.unread"
                 (click)="openThread(t)">
              <div class="bp-msg-card-top">
                <div class="bp-msg-card-av">{{ initialsFor(t.supplierName) }}</div>
                <div class="bp-msg-card-name">{{ t.supplierName }}</div>
                <div class="bp-msg-card-time">{{ fmtTime(t.latestMsg.created_at) }}</div>
              </div>
              <div class="bp-msg-card-prev">{{ t.latestMsg.body }}</div>
              <div class="bp-msg-card-foot">
                <span *ngIf="t.status && t.status !== 'all'"
                      class="bp-msg-tbadge"
                      [ngClass]="'bp-badge-' + statusClass(t.status)">
                  {{ statusLabel(t.status) }}
                </span>
                <span class="bp-msg-tcat">{{ t.categoryName }}</span>
              </div>
            </div>
          </div>

          <!-- ── TABLE VIEW ── -->
          <div *ngIf="activeView === 'table' && filteredThreads().length > 0"
               class="bp-msg-table-wrap">
            <table class="bp-msg-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Last message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of filteredThreads()"
                    [class.active]="activeThread?.key === t.key"
                    [class.unread]="t.unread"
                    (click)="openThread(t)">
                  <td><strong>{{ t.supplierName }}</strong></td>
                  <td>{{ t.categoryName }}</td>
                  <td>
                    <span *ngIf="t.status && t.status !== 'all'"
                          class="bp-msg-tbadge"
                          [ngClass]="'bp-badge-' + statusClass(t.status)">
                      {{ statusLabel(t.status) }}
                    </span>
                  </td>
                  <td class="bp-msg-table-prev">{{ t.latestMsg.body }}</td>
                  <td class="bp-msg-table-time">{{ fmtTime(t.latestMsg.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ── RIGHT: conversation panel (detail column) ── -->
        <section class="bp-cat-detail bp-msg-conv">
          <ng-container *ngIf="!activeThread">
            <div class="bp-msg-conv-empty">
              <lucide-icon name="inbox" [size]="28"></lucide-icon>
              <p>Select a conversation</p>
            </div>
          </ng-container>

          <ng-container *ngIf="activeThread">
            <div class="bp-thread-header">
              <div class="bp-thread-top">
                <button class="bp-back-btn" (click)="closeThread()" title="Back to inbox">
                  <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
                </button>
                <div class="bp-thread-cat-icon" [ngClass]="'bp-cat-' + statusClass(activeThread.status)">
                  <lucide-icon [name]="getCatIcon(activeThread.categoryName)" [size]="16"></lucide-icon>
                </div>
                <div class="bp-thread-info">
                  <div class="bp-thread-name">{{ activeThread.supplierName }}</div>
                  <div class="bp-thread-sub">
                    {{ activeThread.categoryName }}
                    <span *ngIf="!boundProjectId && activeThread.projectName"> · {{ activeThread.projectName }}</span>
                  </div>
                </div>
                <span *ngIf="activeThread.status && activeThread.status !== 'all'"
                      class="bp-msg-tbadge"
                      [ngClass]="'bp-badge-' + statusClass(activeThread.status)">
                  {{ statusLabel(activeThread.status) }}
                </span>
              </div>
              <div class="bp-thread-status-tags">
                <button *ngFor="let s of statuses.slice(1)"
                  class="bp-status-tag"
                  [class.active]="activeThread.status === s.id"
                  [style.--tag-color]="s.color"
                  (click)="setThreadStatus(activeThread, s.id)">
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="bp-thread-msgs" #messageList>
              <ng-container *ngFor="let m of activeThread.messages">
                <div class="bp-date-sep" *ngIf="shouldShowDate(m)">{{ m.created_at | date:'d MMMM yyyy' }}</div>

                <div class="bp-msg-card"
                  [class.bp-msg-read]="m.direction === 'inbound' && m.read"
                  [class.bp-msg-unread]="m.direction === 'inbound' && !m.read"
                  [class.bp-msg-out]="m.direction === 'outbound'">
                  <div class="bp-msg-card-header">
                    <span class="bp-msg-card-sender">{{ m.direction === 'outbound' ? 'You' : activeThread.supplierName }}</span>
                    <span class="bp-msg-card-time">{{ m.created_at | date:'HH:mm' }}</span>
                  </div>
                  <div class="bp-msg-card-body">{{ m.body }}</div>

                  <div *ngIf="m.quoted_items && m.quoted_items.length > 0" class="bp-quoted-items">
                    <div class="bp-quoted-items-label">Quoted items</div>
                    <div *ngFor="let item of m.quoted_items" class="bp-quoted-item">
                      <div class="bp-quoted-item-icon">
                        <lucide-icon [name]="getCatIcon(activeThread.categoryName)" [size]="14"></lucide-icon>
                      </div>
                      <div class="bp-quoted-item-body">
                        <div class="bp-quoted-item-name">{{ item.name }}</div>
                        <div class="bp-quoted-item-desc" *ngIf="item.description">{{ item.description }}</div>
                      </div>
                      <div class="bp-quoted-item-right">
                        <div class="bp-quoted-item-price">{{ item.price | gbp }}</div>
                        <button *ngIf="!item.accepted" class="bp-accept-btn" (click)="acceptItem(activeThread, m, item)">Accept</button>
                        <span *ngIf="item.accepted" class="bp-accepted-tag">✓ Accepted</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="bp-compose">
              <input pInputText [(ngModel)]="newMsg"
                placeholder="Reply to {{ activeThread.supplierName }}..."
                class="bp-compose-input bp-input-edit"
                (keyup.enter)="send()"/>
              <button class="bp-send-btn" [disabled]="!newMsg.trim() || sending" (click)="send()">↑</button>
            </div>
          </ng-container>
        </section>

      </div>

    </ng-container>
    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }

    /* Project selector (global mode) */
    .bp-msg-project-bar {
      padding: 10px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Long supplier names truncate inside the shared bp-sidebar-item. */
    .bp-msg-supp-name {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      flex: 1; min-width: 0;
    }

    /* v1.28: .bp-msg-filter / -btn / -n removed — status filter now
       lives in the left sidebar using shared bp-sidebar-item/-count. */

    /* Empty state */
    .bp-msg-empty {
      padding: 60px 24px;
      text-align: center;
      color: var(--color-text-muted);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      font-size: 12px;
      line-height: 1.55;
    }
    .bp-msg-empty lucide-icon { color: var(--color-text-muted); opacity: 0.6; }
    .bp-msg-empty p { margin: 0; }

    /* ── LIST VIEW ── */
    .bp-msg-list { display: flex; flex-direction: column; }
    .bp-msg-row {
      display: flex; gap: 10px; align-items: flex-start;
      padding: 10px 14px;
      border-bottom: 0.5px solid var(--color-border);
      cursor: pointer;
      transition: background 0.1s;
      position: relative;
    }
    .bp-msg-row:hover { background: var(--theme-bg); }
    .bp-msg-row.active {
      background: var(--theme-bg);
      border-left: 3px solid var(--theme-accent);
      padding-left: 11px;
    }
    .bp-msg-row.unread { background: var(--color-unread-row-bg, var(--theme-bg)); }
    .bp-msg-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 11.5px; font-weight: 600;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-msg-tbody { flex: 1; min-width: 0; }
    .bp-msg-ttop {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 6px;
      margin-bottom: 1px;
    }
    .bp-msg-tname {
      font-size: 12px; font-weight: 600;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-msg-ttime {
      font-size: 10px;
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .bp-msg-tprev {
      font-size: 11px;
      color: var(--color-text-muted);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      margin-bottom: 4px;
    }
    .bp-msg-tmeta {
      display: flex; align-items: center; gap: 6px;
      font-size: 9.5px;
      color: var(--color-text-muted);
    }
    .bp-msg-tcat { font-size: 9.5px; color: var(--color-text-muted); }
    .bp-msg-tproj { color: var(--theme-accent); }
    .bp-msg-tbadge {
      font-size: 9px; font-weight: 600;
      padding: 1px 7px;
      border-radius: 20px;
      letter-spacing: 0.02em;
    }
    .bp-badge-action  { background: var(--color-action-bg);  color: var(--color-action-text); }
    .bp-badge-waiting { background: var(--color-waiting-bg); color: var(--color-waiting-text); }
    .bp-badge-quoted  { background: var(--color-quoted-bg);  color: var(--color-quoted-text); }
    .bp-badge-booked  { background: var(--color-booked-bg);  color: var(--color-booked-text); }
    .bp-badge-default { background: var(--theme-bg);          color: var(--theme-accent); }
    .bp-msg-udot {
      position: absolute;
      top: 14px; right: 14px;
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--theme-accent);
    }

    /* ── CARD VIEW ── */
    .bp-msg-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 14px;
    }
    @media (max-width: 1100px) {
      .bp-msg-cards { grid-template-columns: 1fr; }
    }
    .bp-msg-card-tile {
      border: 0.5px solid var(--color-border);
      border-radius: 10px;
      padding: 12px;
      background: var(--color-surface);
      cursor: pointer;
      transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
    }
    .bp-msg-card-tile:hover {
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      transform: translateY(-1px);
    }
    .bp-msg-card-tile.active {
      border-color: var(--theme-accent);
      background: var(--theme-bg);
    }
    .bp-msg-card-tile.unread { background: var(--color-unread-row-bg, var(--theme-bg)); }
    .bp-msg-card-top {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .bp-msg-card-av {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-msg-card-name {
      font-size: 12px; font-weight: 600;
      color: var(--color-text-primary);
      flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-msg-card-time {
      font-size: 10px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .bp-msg-card-prev {
      font-size: 11px;
      color: var(--color-text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .bp-msg-card-foot {
      display: flex; align-items: center; justify-content: space-between;
      gap: 6px;
    }

    /* ── TABLE VIEW ── */
    .bp-msg-table-wrap { overflow-x: auto; }
    .bp-msg-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      font-family: var(--font-body);
    }
    .bp-msg-table th {
      text-align: left;
      padding: 8px 12px;
      font-size: 10px; font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-muted);
      border-bottom: 0.5px solid var(--color-border);
      background: var(--theme-bg);
    }
    .bp-msg-table td {
      padding: 9px 12px;
      border-bottom: 0.5px solid var(--color-border);
      cursor: pointer;
      color: var(--color-text-primary);
      vertical-align: middle;
    }
    .bp-msg-table tr:hover td { background: var(--theme-bg); }
    .bp-msg-table tr.active td { background: var(--theme-bg); }
    .bp-msg-table tr.unread td { font-weight: 500; }
    .bp-msg-table-prev {
      color: var(--color-text-muted);
      max-width: 260px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-msg-table-time { color: var(--color-text-muted); white-space: nowrap; }

    /* ── RIGHT: CONVERSATION ── */
    .bp-msg-conv {
      display: flex; flex-direction: column;
      background: var(--theme-bg);
      overflow: hidden;
    }
    .bp-msg-conv-empty {
      flex: 1;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px;
      color: var(--color-text-muted);
      font-size: 12px;
      padding: 24px;
      text-align: center;
    }
    .bp-msg-conv-empty lucide-icon { opacity: 0.5; }
    .bp-msg-conv-empty p { margin: 0; }

    .bp-thread-header { background: var(--color-surface); border-bottom: 0.5px solid var(--color-border); padding: 12px 14px; flex-shrink: 0; }
    .bp-thread-top    { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bp-back-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-muted); background: none; border: 0.5px solid var(--color-border); border-radius: 6px; cursor: pointer; font-family: var(--font-body); flex-shrink: 0; padding: 4px 6px; transition: color 0.15s, border-color 0.15s; }
    .bp-back-btn:hover { color: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-thread-cat-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 0.5px solid; }
    .bp-cat-action  { background: var(--color-action-bg); border-color: var(--color-action-border); color: var(--color-action-text); }
    .bp-cat-waiting { background: var(--color-waiting-bg); border-color: var(--color-waiting-border); color: var(--color-waiting-text); }
    .bp-cat-quoted  { background: var(--color-quoted-bg); border-color: var(--color-quoted-border); color: var(--color-quoted-text); }
    .bp-cat-booked  { background: var(--color-booked-bg); border-color: var(--color-booked-border); color: var(--color-booked-text); }
    .bp-cat-default { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-thread-info { flex: 1; min-width: 0; }
    .bp-thread-name { font-family: var(--font-display); font-size: 16px; font-weight: 400; color: var(--color-text-primary); }
    .bp-thread-sub  { font-size: 11px; color: var(--color-text-muted); }
    .bp-thread-status-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .bp-status-tag { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 20px; border: 0.5px solid var(--tag-color); color: var(--tag-color); background: var(--color-surface); cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-status-tag.active { background: var(--tag-color); color: #fff; }
    .bp-thread-msgs { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; background: var(--color-thread-bg, var(--theme-bg)); min-height: 200px; }
    .bp-date-sep { text-align: center; font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0; }
    .bp-msg-card { border-radius: 10px; padding: 10px 12px; border: 0.5px solid; }
    .bp-msg-read   { background: var(--color-msg-read-bg); border-color: var(--color-msg-read-border); }
    .bp-msg-unread { background: var(--color-surface); border-color: var(--color-msg-read-border); border-left: 3px solid var(--theme-accent); border-radius: 0 10px 10px 0; }
    .bp-msg-out    { background: var(--color-msg-out-bg); border-color: var(--color-msg-out-border); }
    .bp-msg-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .bp-msg-card-sender { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-msg-card-body   { font-size: 13px; color: var(--color-text-primary); line-height: 1.5; }
    .bp-quoted-items { margin-top: 10px; border-top: 0.5px solid var(--color-border); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
    .bp-quoted-items-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-quoted-item { display: flex; align-items: center; gap: 10px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 9px 11px; }
    .bp-quoted-item-icon { width: 28px; height: 28px; border-radius: 7px; background: var(--theme-bg); border: 0.5px solid var(--theme-border); display: flex; align-items: center; justify-content: center; color: var(--theme-accent); flex-shrink: 0; }
    .bp-quoted-item-body { flex: 1; min-width: 0; }
    .bp-quoted-item-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-quoted-item-desc { font-size: 11px; color: var(--color-text-muted); }
    .bp-quoted-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .bp-quoted-item-price { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .bp-accept-btn { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: var(--theme-accent); color: #fff; border: none; cursor: pointer; font-family: var(--font-body); }
    .bp-accepted-tag { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: var(--color-booked-bg); color: var(--color-booked-text); border: 0.5px solid var(--color-booked-border); }
    .bp-compose { display: flex; gap: 8px; padding: 12px 14px; border-top: 0.5px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; align-items: center; }
    .bp-compose-input { flex: 1; }
    .bp-send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--theme-accent); border: none; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bp-send-btn:disabled { opacity: 0.4; cursor: default; }
  `]
})
export class MessagesInboxComponent implements OnInit {
  // When used as project tab, pass the project ID directly
  @Input() boundProjectId = '';
  // When used as global inbox, shows project selector
  @Input() showProjectSelector = false;

  loading = true;
  msgs: ThreadMessage[] = [];
  threads: VendorThread[] = [];
  // v1.27b: rich shape so the circles can use the exact same markup as
  // catalogue-grid (cover_image_url → icon_name → initials fallback).
  // Populated from the joined /projects/:id/categories endpoint.
  categoryFolders: Array<{
    id: string;
    name: string;
    icon_name?: string;
    icon_color?: string;
    cover_image_url?: string;
  }> = [];
  projects: Project[] = [];
  projectOptions: any[] = [];
  selectedProjectId = '';
  activeStatus = 'all';
  activeFolder = 'all';
  /** v1.27: supplier filter (left sidebar). 'all' = no filter. */
  activeSupplier: string = 'all';
  /** v1.27: list / card / table view toggle (centre column). */
  activeView: 'list' | 'card' | 'table' = 'list';
  /** v1.27: free-text search across supplier name + latest body +
      quoted item names. Debounced 300ms via onSearchChange. */
  searchTerm = '';
  private searchDebounce: any = null;
  activeThread: VendorThread | null = null;
  newMsg = '';
  sending = false;
  statuses = STATUSES;
  private lastDate = '';
  private orgId = '';

  @ViewChild('messageList') messageList?: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private msgSvc: MsgSvc,
    private projectCategorySvc: ProjectCategoryService,
    private projectSvc: ProjectService,
    private orgSvc: OrgService,
    private shellCtx: ShellContextService,
    private toast: MessageService,
    private datePipe: DatePipe,
    public cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Resolve project ID — from @Input or from parent route
    if (!this.boundProjectId) {
      let r = this.route;
      while (r.parent) r = r.parent;
      this.boundProjectId = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    }

    // Check for projectId from query params (from bottom nav in project context)
    const qpProjectId = this.route.snapshot.queryParams['projectId'];
    if (qpProjectId && !this.boundProjectId) {
      this.boundProjectId = qpProjectId;
    }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) { this.orgId = org.id; }
    });

    if (this.showProjectSelector && !this.boundProjectId) {
      // Global mode — load all projects for selector
      this.projectSvc.getAll().subscribe({
        next: projects => {
          this.projects = projects || [];
          this.projectOptions = [
            { name: 'All Projects', id: '' },
            ...this.projects.map(p => ({ name: p.event_name || p.name, id: p.id }))
          ];
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else if (this.boundProjectId) {
      // Project mode — load categories + messages immediately
      this.loadCategories();
      this.load();
    } else {
      this.loading = false;
    }
  }

  onProjectChange() {
    this.threads = [];
    this.activeThread = null;
    this.categoryFolders = [];
    this.activeFolder = 'all';
    if (this.selectedProjectId) {
      this.loadCategories(this.selectedProjectId);
      this.load(this.selectedProjectId);
    } else {
      this.loadAllMessages();
    }
  }

  loadCategories(pid?: string) {
    const id = pid || this.boundProjectId;
    if (!id) return;
    // v1.27b: use the joined /projects/:id/categories endpoint so the
    // circles display the proper categories.name (instead of the often-
    // null project_categories.name column that surfaced as "Unnamed").
    // Same endpoint that powers the Brief/Marketplace tabs — guarantees
    // the circles only show categories that are IN SCOPE for this
    // project (project_categories.is_active = true).
    this.projectSvc.getCategories(id).subscribe({
      next: cats => {
        // Joined endpoint returns category_name / category_icon_name /
        // category_icon_color / category_cover_image_url. Reshape into
        // the lighter folder type the circle markup uses.
        this.categoryFolders = (cats || []).map(c => ({
          id: c.id,
          name:            (c as any).category_name || c.name || 'Untitled category',
          icon_name:       (c as any).category_icon_name,
          icon_color:      (c as any).category_icon_color,
          cover_image_url: (c as any).category_cover_image_url
        }));
        this.cdr.detectChanges();
      }
    });
  }

  load(pid?: string) {
    const id = pid || this.boundProjectId;
    if (!id) return;
    this.loading = true;
    this.msgSvc.getByProject(id).subscribe({
      next: msgs => {
        this.msgs = (msgs || []) as ThreadMessage[];
        this.buildThreads();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollBottom(), 50);
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadAllMessages() {
    if (!this.orgId) return;
    this.loading = true;
    this.msgSvc.getAllByOrg(this.orgId).subscribe({
      next: msgs => {
        this.msgs = (msgs || []) as ThreadMessage[];
        this.buildThreads();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildThreads() {
    const map: Record<string, VendorThread> = {};
    for (const m of this.msgs) {
      const sid = m.supplier_org_id || 'unknown';
      const cid = m.category_id || '';
      const pid = (m as any).project_id || '';
      const key = sid + '_' + cid + '_' + pid;
      if (!map[key]) {
        map[key] = {
          key, supplierId: sid,
          supplierName: m.supplier_name || 'Unknown Supplier',
          categoryId: cid, categoryName: m.category_name || '',
          projectId: pid, projectName: m.project_name || '',
          latestMsg: m, status: '', count: 0, unread: false, messages: []
        };
      }
      map[key].messages.push(m);
      map[key].count++;
      if (new Date(m.created_at) >= new Date(map[key].latestMsg.created_at)) map[key].latestMsg = m;
      if (m.direction === 'inbound' && !m.read) map[key].unread = true;
      if (m.msg_status) map[key].status = m.msg_status;
    }
    this.threads = Object.values(map).sort((a, b) =>
      new Date(b.latestMsg.created_at).getTime() - new Date(a.latestMsg.created_at).getTime()
    );
  }

  filteredThreads(): VendorThread[] {
    let r = this.threads;
    if (this.activeFolder !== 'all')   r = r.filter(t => t.categoryId === this.activeFolder);
    if (this.activeStatus !== 'all')   r = r.filter(t => t.status === this.activeStatus);
    if (this.activeSupplier !== 'all') r = r.filter(t => t.supplierId === this.activeSupplier);
    const q = (this.searchTerm || '').trim().toLowerCase();
    if (q) r = r.filter(t => this.threadMatchesSearch(t, q));
    return r;
  }

  /** v1.27: search hits supplier name, latest body, every message body,
      and any quoted item name on the thread. Case-insensitive. */
  private threadMatchesSearch(t: VendorThread, q: string): boolean {
    if ((t.supplierName || '').toLowerCase().includes(q)) return true;
    if ((t.categoryName || '').toLowerCase().includes(q)) return true;
    if ((t.latestMsg?.body || '').toLowerCase().includes(q)) return true;
    for (const m of t.messages) {
      if ((m.body || '').toLowerCase().includes(q)) return true;
      for (const qi of (m.quoted_items || [])) {
        if ((qi.name || '').toLowerCase().includes(q)) return true;
      }
    }
    return false;
  }

  /** v1.27: debounce search input so filteredThreads doesn't churn on
      every keystroke. cdr.detectChanges nudges the table/list to re-pull
      filteredThreads() once the term has settled. */
  onSearchChange() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = null;
      this.cdr.detectChanges();
    }, 300);
  }

  countByStatus(id: string) { return this.threads.filter(t => t.status === id).length; }

  /** v1.27: count of all threads in a given project_category. Drives the
      "empty" opacity on category circles. */
  threadCountForCategory(catId: string): number {
    return this.threads.filter(t => t.categoryId === catId).length;
  }

  /** v1.27: count of unread threads in a category — drives the red
      badge on the circle. */
  unreadCountForCategory(catId: string): number {
    return this.threads.filter(t => t.categoryId === catId && t.unread).length;
  }

  /** v1.28: adapters that feed <app-category-circles>. */
  get emptyCategoryIds(): ReadonlySet<string> {
    const s = new Set<string>();
    for (const f of this.categoryFolders) {
      if (this.threadCountForCategory(f.id) === 0) s.add(f.id);
    }
    return s;
  }
  get unreadBadgeCounts(): ReadonlyMap<string, number> {
    const m = new Map<string, number>();
    for (const f of this.categoryFolders) {
      const n = this.unreadCountForCategory(f.id);
      if (n > 0) m.set(f.id, n);
    }
    return m;
  }
  /** Circle-strip select handler. Mirrors the catalogue-grid pattern:
      string id from the shared component, mapped onto activeFolder. */
  onCircleSelect(id: string) {
    this.activeFolder = id;
    this.cdr.detectChanges();
  }

  /** v1.27: distinct suppliers across the current thread set, with the
      thread count per supplier. Powers the left sidebar list. */
  get supplierList(): Array<{ id: string; name: string; count: number }> {
    const map: Record<string, { id: string; name: string; count: number }> = {};
    for (const t of this.threads) {
      const id = t.supplierId || 'unknown';
      if (!map[id]) map[id] = { id, name: t.supplierName || 'Unknown supplier', count: 0 };
      map[id].count++;
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** v1.27: 2-letter initials for avatar bubbles (list + card views). */
  initialsFor(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  openThread(t: VendorThread) {
    this.activeThread = t;
    this.lastDate = '';
    t.unread = false;
    setTimeout(() => this.scrollBottom(), 50);
  }

  closeThread() {
    this.activeThread = null;
    this.lastDate = '';
  }

  setThreadStatus(t: VendorThread, statusId: string) {
    t.status = t.status === statusId ? '' : statusId;
    t.messages.filter(m => m.direction === 'inbound').forEach(m => {
      m.msg_status = t.status;
      this.msgSvc.update(m.id, { msg_status: t.status }).subscribe();
    });
    this.cdr.detectChanges();
  }

  acceptItem(thread: VendorThread, msg: ThreadMessage, item: QuotedItem) {
    item.accepted = true;
    thread.status = 'booked';
    this.msgSvc.update(msg.id, { accepted_item_id: item.id }).subscribe();
    this.toast.add({ severity: 'success', summary: 'Item accepted', detail: `${item.name} added to your estimate.`, life: 3000 });
    this.cdr.detectChanges();
  }

  send() {
    if (!this.newMsg?.trim() || !this.activeThread) return;
    this.sending = true;
    const pid = this.boundProjectId || this.activeThread.projectId;
    this.msgSvc.create({
      project_id: pid, body: this.newMsg, direction: 'outbound', subject: 'Message',
      category_id: this.activeThread.categoryId, supplier_org_id: this.activeThread.supplierId
    }).subscribe({
      next: () => {
        this.newMsg = '';
        this.sending = false;
        const key = this.activeThread?.key;
        this.load(pid);
        setTimeout(() => {
          this.activeThread = this.threads.find(t => t.key === key) || null;
          this.cdr.detectChanges();
        }, 300);
      },
      error: () => {
        this.sending = false;
        this.toast.add({ severity: 'error', summary: 'Failed to send', life: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  shouldShowDate(m: ThreadMessage): boolean {
    const d = m.created_at ? new Date(m.created_at).toDateString() : '';
    if (d !== this.lastDate) { this.lastDate = d; return true; }
    return false;
  }

  fmtTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    if (diff < 7)  return d.toLocaleDateString('en-GB', { weekday: 'long' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  statusLabel(id: string) { return STATUSES.find(s => s.id === id)?.label || ''; }
  statusClass(id: string): string {
    return ({ action_needed: 'action', follow_up: 'waiting', quoted: 'quoted', booked: 'booked' } as any)[id] || 'default';
  }

  getCatIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('structure') || n.includes('set build') || n.includes('stand')) return 'warehouse';
    if (n.includes('lighting')) return 'spotlight';
    if (n.includes('av') || n.includes('audio') || n.includes('technology')) return 'headset';
    if (n.includes('graphics') || n.includes('signage') || n.includes('print') || n.includes('permits')) return 'signature';
    if (n.includes('catering') || n.includes('hospitality') || n.includes('bar')) return 'martini';
    if (n.includes('talent') || n.includes('staffing') || n.includes('entertainment') || n.includes('security')) return 'person-standing';
    return 'warehouse';
  }

  scrollBottom() {
    if (this.messageList?.nativeElement) {
      this.messageList.nativeElement.scrollTop = this.messageList.nativeElement.scrollHeight;
    }
  }
}
