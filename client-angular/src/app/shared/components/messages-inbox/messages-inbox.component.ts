import { Component, OnInit, Input, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
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
import { ClientService } from '../../../core/services/client.service';
import { OrgService } from '../../../core/services/org.service';
import { ShellContextService } from '../../../core/services/shell-context.service';
import { CartDrawerService } from '../../../core/services/cart-drawer.service';
import { EventDrawerService } from '../../../core/services/event-drawer.service';
import { PersonaService } from '../../../core/services/persona.service';
import { CodelistService } from '../../../core/services/codelist.service';
import {
  MessageItemService, MessageItemRow, MessageItemAction
} from '../../../core/services/message-item.service';
import { Project, Message } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import {
  CategoryCirclesComponent, CategoryCircle
} from '../category-circles/category-circles.component';
import {
  MessageItemCardComponent, MessageItem
} from '../message-item-card/message-item-card.component';

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
  /** v1.65cs (p0006) — supplier brand assets joined server-side so
      the Inbox thread cards can render a real logo instead of just
      initials. logo_url is the square brand mark; cover_image_url
      is the banner fallback. */
  supplier_logo_url?: string | null;
  supplier_cover_url?: string | null;
  category_id?: string;
  category_name?: string;
  msg_status?: string;
  read?: boolean;
  quoted_items?: QuotedItem[];
  project_name?: string;
  /** v1.65cv (p0008 §8) — ref-prefixed subject + supplier contact +
      thread-level clock. All optional; the inbox renders empty when
      a row predates p0008. */
  ref_code?: string | null;
  contact_name?: string | null;
  next_action_by?: string | null;
}

interface VendorThread {
  key: string;
  supplierId: string;
  supplierName: string;
  /** v1.65cs — supplier logo carried at the thread level. Picked
      from the first message that has a non-null asset; falls back
      to '' so the template can render initials when empty. */
  supplierLogoUrl: string;
  /** v1.65cv (p0008 §8) — short ref ("WA-001") + supplier contact
      pulled from the lead outbound message; thread-level overdue
      clock from the latest message that carries a next_action_by. */
  refCode: string;
  contactName: string;
  nextActionBy: string | null;
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
    ButtonModule, InputTextModule, DropdownModule, SidebarModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent, CategoryCirclesComponent,
    MessageItemCardComponent
  ],
  providers: [MessageService, DatePipe],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- v1.65g4 — top filter row: Client | Project | Search on a
           single line. Client + Project dropdowns only render in
           global (un-bound) mode; search is universal. The two
           previously-separate bars (bp-msg-project-bar + bp-browse-
           strip) collapsed into one row so the inbox loses ~50px of
           chrome and the three coarsest filters sit shoulder to
           shoulder. -->
      <div class="bp-msg-top-filter-row">
        <!-- Search left-justified (standard bp-search-row). -->
        <div class="bp-search-row bp-msg-top-search">
          <lucide-icon name="search" [size]="14" class="bp-search-icon"></lucide-icon>
          <input pInputText type="text"
                 [(ngModel)]="searchTerm"
                 (ngModelChange)="onSearchChange()"
                 placeholder="Search threads, suppliers, messages…"
                 class="bp-search-input"/>
        </div>

        <p-dropdown *ngIf="!boundProjectId"
          [(ngModel)]="selectedClientId"
          [options]="clientDropdownOptions"
          optionLabel="name" optionValue="id"
          styleClass="bp-msg-top-dd"
          placeholder="All clients"
          (onChange)="onClientChange()">
        </p-dropdown>

        <p-dropdown *ngIf="!boundProjectId"
          [(ngModel)]="selectedProjectId"
          [options]="projectOptions"
          optionLabel="name" optionValue="id"
          styleClass="bp-msg-top-dd"
          placeholder="All projects"
          (onChange)="onProjectChange()">
        </p-dropdown>

        <!-- Filter → opens the standard bp-drawer (Category / Contact / Status). -->
        <button type="button" class="bp-btn-outline bp-msg-filter-btn" (click)="filterOpen = true">
          <lucide-icon name="list-filter" [size]="16"></lucide-icon>
          Filter
          <span *ngIf="activeFilterCount" class="bp-msg-filter-badge">{{ activeFilterCount }}</span>
        </button>
      </div><!-- /.bp-msg-top-filter-row -->

      <!-- ═══════════════ TWO-COLUMN BODY ═══════════════
           v1.65dv (p0015 follow-up) — filter sidebar retired. Three
           dropdowns in the INBOX header (Category / Contact / Status)
           replace the rail. Body grid is now main (1fr) | detail
           (resizable preview). -->
      <div class="bp-cat-body bp-msg-body bp-msg-body--2col"
           [style.--bp-msg-preview-w.px]="previewWidth">

        <!-- ── MAIN: scrolling thread list. v1.68y — the panel head
             (INBOX title + count + Category/Contact/Status dropdowns) was
             removed; those filters now live in the Filter drawer. ── -->
        <section class="bp-cat-main">
          <div class="bp-cat-main-body">
          <!-- v1.28: Status pills moved to the left sidebar — only ONE
               filter rail across the page now. -->

          <!-- Empty state — v1.65cr (p0006). v1.65du — restored to the
               three-branch shape now that search is back:
                 (a) no project bound + no project selected: prompt to
                     pick a project. Global-inbox mode only.
                 (b) project context but no threads: "No replies yet"
                     with a "Go to cart" CTA pointing back to the
                     Marketplace cart (email-launch lives there now).
                 (c) search active with no hits: "No threads match …" -->
          <div *ngIf="filteredThreads().length === 0" class="bp-msg-empty">
            <ng-container *ngIf="!selectedProjectId && !boundProjectId; else projectEmpty">
              <lucide-icon name="inbox" [size]="32"></lucide-icon>
              <p>Select a project or open one from the dashboard.</p>
            </ng-container>
            <ng-template #projectEmpty>
              <ng-container *ngIf="searchTerm; else noReplies">
                <lucide-icon name="search-x" [size]="32"></lucide-icon>
                <p>No threads match "{{ searchTerm }}".</p>
              </ng-container>
              <ng-template #noReplies>
                <div class="bp-msg-empty-icon">
                  <lucide-icon name="inbox" [size]="28"></lucide-icon>
                </div>
                <div class="bp-msg-empty-title">No replies yet</div>
                <div class="bp-msg-empty-sub">
                  Emails you send from your cart will land here as supplier replies arrive.
                </div>
                <button type="button" class="bp-msg-empty-cta" (click)="openCart()">
                  <lucide-icon name="shopping-cart" [size]="13"></lucide-icon>
                  Go to cart
                </button>
              </ng-template>
            </ng-template>
          </div>

          <!-- ── THREAD LIST — v1.65cr (p0006). v1.65dt (p0015) — view
               toggle dropped; list is the only render path now.
               Thread-card shape: 40px rounded-square logo, supplier
               name + time on top, subject (bold when unread) on the
               second row, status badge + category on the meta row, and
               an unread dot trailing. -->
          <div *ngIf="filteredThreads().length > 0"
               class="bp-msg-list">
            <div *ngFor="let t of filteredThreads()"
                 class="bp-msg-thread-card"
                 [class.bp-msg-thread-card--selected]="activeThread?.key === t.key"
                 [class.bp-msg-thread-card--unread]="t.unread"
                 [class.bp-msg-thread-card--overdue]="isOverdue(t.nextActionBy)"
                 (click)="openThread(t)">
              <!-- v1.65cs — render the supplier logo when present;
                   fall back to initials in a themed-tint square. -->
              <!-- v1.65dz (p0015) — logo + name use fromLogoUrlFor /
                   fromNameFor so the row shows the OTHER party from
                   the viewer's POV (supplier in agency view, agency
                   in supplier view). -->
              <div class="bp-msg-thread-logo"
                   [class.bp-msg-thread-logo--img]="!!fromLogoUrlFor(t)">
                <img *ngIf="fromLogoUrlFor(t)" [src]="fromLogoUrlFor(t)" [alt]="fromNameFor(t)"/>
                <span *ngIf="!fromLogoUrlFor(t)">{{ initialsFor(fromNameFor(t)) }}</span>
              </div>
              <div class="bp-msg-thread-body">
                <div class="bp-msg-thread-top">
                  <span class="bp-msg-thread-supplier">{{ fromNameFor(t) }}</span>
                  <span class="bp-msg-thread-time"
                        [attr.title]="preciseDate(t.latestMsg.created_at)">
                    {{ fmtTime(t.latestMsg.created_at) }}
                  </span>
                </div>
                <!-- v1.65cv (p0008 §8) — contact line under supplier
                     name. Lucide user icon + muted contact name. Only
                     renders when contact_name is set. -->
                <div *ngIf="t.contactName" class="bp-msg-thread-contact">
                  <lucide-icon name="user" [size]="11"></lucide-icon>
                  <span>{{ t.contactName }}</span>
                </div>
                <!-- v1.65cv — Ref-prefixed subject. "Ref WA-001 …"
                     when a ref_code is present; bold-when-unread per
                     p0006 stays untouched. -->
                <div class="bp-msg-thread-subject">
                  <span *ngIf="t.refCode" class="bp-msg-thread-ref">Ref {{ t.refCode }}</span>
                  {{ subjectFor(t) }}
                </div>
                <div class="bp-msg-thread-meta">
                  <span *ngIf="t.status && t.status !== 'all'"
                        class="bp-msg-tbadge"
                        [ngClass]="'bp-badge-' + statusClass(t.status)">
                    {{ statusLabel(t.status) }}
                    <span *ngIf="isOverdue(t.nextActionBy)" class="bp-msg-overdue-dot"></span>
                  </span>
                  <span class="bp-msg-thread-cat">{{ t.categoryName }}</span>
                  <span *ngIf="!boundProjectId && t.projectName"
                        class="bp-msg-thread-proj"> · {{ t.projectName }}</span>
                  <!-- Precise date stamp — small caption under the
                       relative time, only on hover via the title attr
                       on time-ago; here we render it inline for the
                       list view so it's always visible. -->
                  <span class="bp-msg-thread-stamp">{{ preciseDate(t.latestMsg.created_at) }}</span>
                </div>
              </div>
              <span *ngIf="t.unread" class="bp-msg-thread-dot"></span>
              <!-- v1.65g1 — delete the whole thread (soft-deletes
                   every message in it). Hover-only on the thread
                   card so the resting state stays calm; click
                   confirms before firing. -->
              <button type="button"
                      class="bp-msg-thread-del"
                      title="Delete thread"
                      (click)="deleteThread(t, $event)">
                <lucide-icon name="trash-2" [size]="13"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- v1.65dt (p0015) — card-view and table-view template blocks
               retired alongside the view toggle. List is canonical. -->
          </div><!-- /.bp-cat-main-body -->
        </section>

        <!-- ── RIGHT: conversation panel (detail column) ── -->
        <section class="bp-cat-detail bp-msg-conv">
          <!-- v1.65cf — drag handle on the left edge of the preview
               panel. pointer events bubble through HostListeners on
               document so the drag survives the cursor leaving the
               narrow handle width. -->
          <div class="bp-msg-preview-resizer"
               (pointerdown)="onResizeStart($event)"
               title="Drag to resize"></div>
          <ng-container *ngIf="!activeThread">
            <div class="bp-msg-conv-empty">
              <lucide-icon name="inbox" [size]="28"></lucide-icon>
              <p>Select a conversation</p>
            </div>
          </ng-container>

          <ng-container *ngIf="activeThread">
            <!-- v1.65dd (p0013 header refit) — envelope layout:
                   col 1: From / To / CC
                   col 2: First / Last / Status
                 Subject promoted to a full-width row UNDER both
                 columns. CC = other suppliers on the same outreach
                 batch (same ref_code, different supplier). -->
            <div class="bp-thread-mail-head">
              <div class="bp-thread-mail-row">
                <span class="bp-thread-mail-label">From</span>
                <span class="bp-thread-mail-value">{{ agencyName || '—' }}</span>
                <span class="bp-thread-mail-label">First</span>
                <span class="bp-thread-mail-value">{{ firstMessageAt() ? preciseDate(firstMessageAt()) : '—' }}</span>
              </div>
              <div class="bp-thread-mail-row">
                <span class="bp-thread-mail-label">To</span>
                <span class="bp-thread-mail-value">{{ activeThread.supplierName || '—' }}</span>
                <span class="bp-thread-mail-label">Last</span>
                <span class="bp-thread-mail-value">{{ lastMessageAt() ? preciseDate(lastMessageAt()) : '—' }}</span>
              </div>
              <div class="bp-thread-mail-row">
                <span class="bp-thread-mail-label">CC</span>
                <span class="bp-thread-mail-value">{{ ccSuppliers() || '—' }}</span>
                <span class="bp-thread-mail-label">Status</span>
                <span class="bp-thread-mail-value">
                  <span *ngIf="aggregateStatus()"
                        class="bp-msg-tbadge"
                        [ngClass]="'bp-badge-' + aggregateStatus()">
                    {{ aggregateStatusLabel() }}
                  </span>
                  <span *ngIf="!aggregateStatus()">—</span>
                </span>
              </div>
              <div class="bp-thread-mail-row bp-thread-mail-row--subject">
                <span class="bp-thread-mail-label">Subject</span>
                <span class="bp-thread-mail-value bp-thread-mail-subject">{{ threadSubject() }}</span>
              </div>
            </div>

            <!-- v1.65dw — Event Details + Items collapsible sections
                 retired in favour of the existing shared drawers:
                 EventDrawerService (Event drawer) and CartDrawerService
                 (Project Items / Cart drawer). The conversation panel
                 reads cleaner: metadata header → action bar (two
                 drawer chips) → conversation stream. -->
            <!-- v1.65dx — REF badge removed from Event chip (the ref
                 already shows in the metadata header / drawer body, no
                 need to repeat). Icons are Lucide (calendar-days +
                 package) via <lucide-icon>. -->
            <div class="bp-thread-drawer-bar" *ngIf="activeProject?.id">
              <button type="button" class="bp-thread-drawer-chip"
                      (click)="openEventDrawerForThread()">
                <lucide-icon name="calendar-days" [size]="13"></lucide-icon>
                <span class="bp-thread-drawer-chip-label">Event details</span>
              </button>
              <!-- v1.65er — "Items" renamed to "Cart" to match the
                   mental model: the brief IS the cart, the supplier
                   is reviewing it. Badge shows the FULL count of
                   message_items (catalogue + ad-hoc), not the
                   project_items intersection. -->
              <button type="button" class="bp-thread-drawer-chip"
                      *ngIf="threadItems.length"
                      (click)="openItemsDrawerForThread()">
                <lucide-icon name="shopping-cart" [size]="13"></lucide-icon>
                <span class="bp-thread-drawer-chip-label">Cart</span>
                <span class="bp-thread-drawer-chip-badge">
                  {{ threadItems.length }}
                </span>
                <span *ngIf="itemActionCount() > 0"
                      class="bp-thread-drawer-chip-action">
                  · {{ itemActionCount() }} need action
                </span>
              </button>
            </div>

            <!-- ── CONVERSATION section (p0013 §1 + §4) ───────────── -->
            <!-- v1.65cz: Conversation section header. The stream
                 itself always renders (per p0013 §1.3 — Conversation
                 can't collapse to zero); the header chevron just
                 changes the icon, the body never hides. -->
            <div class="bp-thread-sec bp-thread-sec--conv bp-thread-sec--open">
              <button type="button" class="bp-thread-sec-head"
                      (click)="secConvOpen = !secConvOpen">
                <lucide-icon name="message-circle" [size]="13"></lucide-icon>
                <span class="bp-thread-sec-label">Conversation</span>
                <span class="bp-thread-sec-badge">{{ conversationCount() }} {{ conversationCount() === 1 ? 'message' : 'messages' }}</span>
                <lucide-icon class="bp-thread-sec-chev" name="chevron-up" [size]="14"></lucide-icon>
              </button>

            <!-- v1.65cy (p0011 §1 fix) — Interleaved timeline: messages
                 and item cards in chronological order. Each item card
                 anchors at its most recent updated_at, so when the
                 supplier sends a message + adjusts an item, the
                 message bubble lands first, then the item card with
                 the new state lands right after. Actions live on
                 these inline cards (NOT on the summary above). -->
            <div class="bp-thread-msgs" #messageList>
              <ng-container *ngFor="let entry of streamTimeline()">
                <div class="bp-date-sep" *ngIf="entry.showDate">{{ entry.timestamp | date:'d MMMM yyyy' }}</div>

                <!-- v1.65de (p0013 §4) → v1.65dz (p0015) — sender-aligned
                     bubble using isFromMe() so the lane flips with the
                     viewer prop. Agency view: outbound = me = right;
                     supplier view: inbound = me = right. -->
                <ng-container *ngIf="entry.type === 'message' && entry.message as m">
                  <div class="bp-msg-lane"
                       [class.bp-msg-lane--out]="isFromMe(m)"
                       [class.bp-msg-lane--in]="!isFromMe(m)">
                    <!-- v1.65fX — sender avatar. 2-char initials in a
                         theme-soft circle, sits outside-left of the
                         bubble on inbound lanes (the other person's
                         message), outside-right on outbound. -->
                    <div class="bp-msg-avatar"
                         [title]="senderName(m)">
                      {{ senderInitials(m) }}
                    </div>
                    <div class="bp-msg-bubble"
                         [class.bp-msg-bubble--out]="isFromMe(m)"
                         [class.bp-msg-bubble--in]="!isFromMe(m)"
                         [class.bp-msg-bubble--unread]="!isFromMe(m) && !m.read">
                      <!-- ↳ {item.name} breadcrumb when the bubble is
                           tagged to a specific item. -->
                      <div *ngIf="m.tagged_item_id && taggedItemName(m.tagged_item_id) as tagName"
                           class="bp-msg-bubble-crumb">
                        ↳ {{ tagName }}
                      </div>
                      <div class="bp-msg-bubble-body" *ngIf="m.body">{{ m.body }}</div>
                      <!-- v1.65f6 — Reply affordance next to the
                           timestamp on every bubble. Opens the Cart
                           drawer for this thread so the viewer can
                           review / edit / batch-respond inline. Only
                           rendered when the thread actually has a
                           cart attached (no items → nothing to reply
                           to). -->
                      <div class="bp-msg-bubble-foot">
                        <button *ngIf="threadItems.length"
                                type="button"
                                class="bp-msg-bubble-reply"
                                title="Reply with cart"
                                (click)="openItemsDrawerForThread()">
                          <lucide-icon name="corner-up-left" [size]="11"></lucide-icon>
                          Reply
                        </button>
                        <!-- v1.65g0 — delete affordance on every
                             bubble. Soft delete: confirms first,
                             POSTs DELETE /messages/:id, then
                             refreshes the thread so the bubble
                             vanishes. Either side can delete. -->
                        <button type="button"
                                class="bp-msg-bubble-del"
                                title="Delete message"
                                (click)="deleteMessage(m)">
                          <lucide-icon name="trash-2" [size]="11"></lucide-icon>
                        </button>
                        <span class="bp-msg-bubble-time">{{ m.created_at | date:'HH:mm' }}</span>
                      </div>
                    </div>
                  </div>
                </ng-container>

                <!-- v1.65er — item cards no longer render inline in the
                     conversation stream. Items live exclusively in the
                     Cart chip drawer above; the stream is now pure
                     bubble-by-bubble messaging. Cleaner read, faster
                     scan, and the supplier doesn't get distracted by
                     full action cards mid-conversation. The stream
                     timeline still INCLUDES item events so the
                     ordering anchors right (most-recent first) — they
                     just aren't rendered. -->
                <ng-container *ngIf="entry.type === 'item'"></ng-container>
              </ng-container>
              <div *ngIf="streamTimeline().length === 0" class="bp-msg-stream-empty">
                No conversation yet.
              </div>
            </div>
            </div><!-- /.bp-thread-sec.bp-thread-sec--conv -->

            <!-- v1.65de (p0013 §5) — compose chip strip. Default state
                 is chips + tools (no text input); Add-note expands a
                 textarea + Send. Clicking a chip with no {placeholder}
                 sends immediately; with one, the placeholder picker
                 opens inline. -->
            <div class="bp-compose">
              <!-- Quick-reply chips. Horizontally scrolling. -->
              <div class="bp-compose-chips" *ngIf="!composeNoteOpen && composeChips.length">
                <button *ngFor="let c of composeChips"
                        type="button"
                        class="bp-compose-chip"
                        [title]="c.preview || c.body"
                        (click)="onChipClick(c)">
                  {{ c.label }}
                </button>
              </div>

              <!-- Placeholder picker (when a chip with {x} was tapped). -->
              <div class="bp-compose-ph" *ngIf="composePlaceholder">
                <span class="bp-compose-ph-label">{{ composePlaceholder.label }}</span>
                <input pInputText
                       [(ngModel)]="composePlaceholder.value"
                       class="bp-input-edit bp-compose-ph-input"
                       [placeholder]="composePlaceholder.hint"
                       (keyup.enter)="confirmPlaceholder()"
                       (keyup.escape)="cancelPlaceholder()"/>
                <button type="button" class="bp-mi-btn" (click)="cancelPlaceholder()">Cancel</button>
                <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                        [disabled]="!composePlaceholder.value?.trim()"
                        (click)="confirmPlaceholder()">Send</button>
              </div>

              <!-- Add-note expanded state. -->
              <div class="bp-compose-note" *ngIf="composeNoteOpen">
                <textarea pInputTextarea
                          [(ngModel)]="newMsg"
                          [placeholder]="composeNoteHint"
                          class="bp-compose-note-input"
                          rows="2"
                          (keydown.enter)="onNoteEnter($event)"></textarea>
                <div class="bp-compose-note-row">
                  <button type="button" class="bp-mi-btn" (click)="closeNote()">Cancel</button>
                  <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                          [disabled]="!newMsg.trim() || sending"
                          (click)="send()">
                    {{ sending ? 'Sending…' : 'Send' }}
                  </button>
                </div>
              </div>

              <!-- Tool row at the bottom of the compose strip. -->
              <div class="bp-compose-tools" *ngIf="!composePlaceholder">
                <button type="button" class="bp-compose-tool"
                        [class.bp-compose-tool--active]="!!composeTaggedItemId"
                        title="Tag this reply to an item"
                        (click)="toggleItemTagPicker()">
                  <lucide-icon name="paperclip" [size]="14"></lucide-icon>
                  <span *ngIf="composeTaggedItemName()" class="bp-compose-tool-tag">{{ composeTaggedItemName() }}</span>
                </button>
                <button type="button" class="bp-compose-tool"
                        [class.bp-compose-tool--active]="composeNoteOpen"
                        [title]="composeNoteOpen ? 'Close note' : 'Add a note'"
                        (click)="composeNoteOpen ? closeNote() : openNote()">
                  <lucide-icon name="pencil" [size]="14"></lucide-icon>
                </button>
                <button type="button" class="bp-compose-tool"
                        [class.bp-compose-tool--active]="!!composeNextActionBy"
                        title="Set a follow-up time"
                        (click)="toggleClockPicker()">
                  <lucide-icon name="clock" [size]="14"></lucide-icon>
                  <span *ngIf="composeNextActionBy" class="bp-compose-tool-tag">{{ shortClock(composeNextActionBy) }}</span>
                </button>
                <span class="bp-compose-tools-spacer"></span>
                <!-- Standalone send (note-collapsed). Only fires if
                     a clock or tagged item are set without text — for
                     just sending a clock update / tag-only ping. Rarely
                     used; mostly hidden. -->
                <button *ngIf="(composeNextActionBy || composeTaggedItemId) && !composeNoteOpen"
                        type="button" class="bp-mi-btn bp-mi-btn--primary"
                        [disabled]="sending" (click)="send()">
                  <lucide-icon name="send" [size]="13"></lucide-icon> Send
                </button>
              </div>

              <!-- Item-tag picker popover. -->
              <div *ngIf="itemTagPickerOpen" class="bp-compose-picker">
                <div class="bp-compose-picker-label">Tag to item</div>
                <button *ngFor="let it of threadItems"
                        type="button"
                        class="bp-compose-picker-item"
                        [class.bp-compose-picker-item--active]="composeTaggedItemId === it.id"
                        (click)="pickTaggedItem(it.id)">{{ it.name }}</button>
                <button type="button" class="bp-compose-picker-item"
                        *ngIf="composeTaggedItemId"
                        (click)="pickTaggedItem(null)">Clear</button>
              </div>

              <!-- Clock picker popover. -->
              <div *ngIf="clockPickerOpen" class="bp-compose-picker">
                <div class="bp-compose-picker-label">Follow up by</div>
                <div class="bp-compose-picker-row">
                  <button type="button" class="bp-mi-btn" (click)="setClock(offsetHours(1))">In 1 hour</button>
                  <button type="button" class="bp-mi-btn" (click)="setClock(offsetTomorrow9())">Tomorrow 9am</button>
                  <button type="button" class="bp-mi-btn" (click)="setClock(offsetFriday())">Friday</button>
                  <button type="button" class="bp-mi-btn" (click)="setClock(offsetWeek())">Next week</button>
                </div>
                <input type="datetime-local" class="bp-compose-picker-input"
                       [(ngModel)]="clockDraft"
                       (keyup.enter)="setClock(clockDraftIso())"/>
                <div class="bp-compose-picker-actions">
                  <button type="button" class="bp-mi-btn" *ngIf="composeNextActionBy" (click)="setClock(null)">Clear</button>
                  <button type="button" class="bp-mi-btn" (click)="clockPickerOpen = false">Close</button>
                  <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                          [disabled]="!clockDraft"
                          (click)="setClock(clockDraftIso())">Set</button>
                </div>
              </div>
            </div>
          </ng-container>
        </section>

      </div>

    </ng-container>

    <!-- FILTER DRAWER — standard bp-drawer (Category / Contact / Status),
         moved out of the inbox panel head. -->
    <p-sidebar [(visible)]="filterOpen" position="right"
               styleClass="bp-drawer" [style]="{width:'420px'}"
               [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">INBOX</span>
            <div class="bp-drawer-title">Filters</div>
          </div>
          <button class="bp-icon-btn" (click)="filterOpen = false" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body bp-msg-filter-body">
        <div class="bp-field" *ngIf="folderDropdownOptions.length > 1">
          <label class="bp-field-label">Category</label>
          <p-dropdown [options]="folderDropdownOptions"
                      [ngModel]="activeFolder"
                      (onChange)="onFolderDropdownChange($event.value)"
                      optionLabel="name" optionValue="id"
                      appendTo="body" styleClass="w-full"
                      placeholder="Category"></p-dropdown>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">{{ viewer === 'supplier' ? 'Agency' : 'Contact' }}</label>
          <p-dropdown [options]="contactDropdownOptions"
                      [ngModel]="activeSupplier"
                      (onChange)="onContactDropdownChange($event.value)"
                      optionLabel="name" optionValue="id"
                      appendTo="body" styleClass="w-full"
                      [placeholder]="viewer === 'supplier' ? 'Agency' : 'Contact'"></p-dropdown>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Status</label>
          <p-dropdown [options]="statusDropdownOptions"
                      [ngModel]="activeStatus"
                      (onChange)="onStatusDropdownChange($event.value)"
                      optionLabel="name" optionValue="id"
                      appendTo="body" styleClass="w-full"
                      placeholder="Status"></p-dropdown>
        </div>
      </div>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }

    /* v1.65ce — inbox conversation preview wider than the standard
       lg item-detail panel.
       v1.65cf — third column is now driven by the --bp-msg-preview-w
       CSS variable (default 640px) so the drag handle can update it
       in real time. .bp-cat-detail goes position:relative so the
       absolutely-positioned handle pins to its left edge. */
    :host ::ng-deep .bp-cat-body--detail.bp-msg-body {
      grid-template-columns: 240px 1fr var(--bp-msg-preview-w, 640px);
    }
    /* v1.65dv (p0015 follow-up) — 2-column body. Filter sidebar gone;
       main column flexes against the resizable preview. The old
       3-column grid stays defined above for callers still mounting
       the legacy shape. */
    :host ::ng-deep .bp-msg-body.bp-msg-body--2col {
      display: grid;
      grid-template-columns: 1fr var(--bp-msg-preview-w, 640px);
      min-height: 0;
      flex: 1;
    }
    :host ::ng-deep .bp-msg-body .bp-cat-detail {
      position: relative;
    }

    /* v1.65dv — INBOX header dropdown cluster. Category / Contact /
       Status sit right-aligned in the .bp-cat-main-head strip via
       margin-left:auto on the cluster. Each dropdown is compact
       (slim padding, theme-accent caret) so the three fit without
       crowding the count chip. */
    .bp-msg-head-filters {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    :host ::ng-deep .bp-msg-head-dd.p-dropdown {
      height: 28px;
      min-width: 120px;
      font-size: 12px;
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button);
      background: var(--color-surface);
    }
    :host ::ng-deep .bp-msg-head-dd.p-dropdown:not(.p-disabled):hover {
      border-color: var(--theme-accent);
    }
    :host ::ng-deep .bp-msg-head-dd .p-dropdown-label {
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      line-height: 20px;
    }
    :host ::ng-deep .bp-msg-head-dd .p-dropdown-trigger {
      width: 24px;
      color: var(--color-text-muted);
    }
    /* Drag handle — sits absolutely on the left edge of the preview
       panel. 6px wide so it's easy to grab but doesn't draw chrome
       at rest. Tints to theme-accent on hover / during drag. */
    .bp-msg-preview-resizer {
      position: absolute;
      left: -3px;
      top: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      z-index: 5;
      background: transparent;
      transition: background 0.15s;
      touch-action: none;
    }
    .bp-msg-preview-resizer:hover {
      background: var(--theme-accent);
      opacity: 0.35;
    }
    .bp-msg-preview-resizer.bp-resizing {
      background: var(--theme-accent);
      opacity: 0.5;
    }

    /* Project selector (global mode) — kept for legacy refs (no
       longer rendered; replaced by .bp-msg-top-filter-row below). */
    .bp-msg-project-bar {
      padding: 10px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* v1.65g4 — single horizontal row at the top of the inbox holding
       Client + Project + Search. Same horizontal padding as the
       former two bars combined; the search input flexes to consume
       the remaining width so the line reads:
         [Client ▼] [Project ▼] [🔍 search ............................. ] */
    .bp-msg-top-filter-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 24px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
    .bp-msg-top-filter-row :host ::ng-deep .bp-msg-top-dd,
    .bp-msg-top-filter-row ::ng-deep .bp-msg-top-dd {
      min-width: 200px;
    }
    /* v1.65g4 — top-row search reuses the shared .bp-search-row
       chrome (flex icon + p-inputtext sibling). We just flex it to
       consume the remaining width and pad it inside so the icon
       isn't flush against the border. */
    /* v1.68y — search left-justified (no longer flex:1); the Filter button
       is pushed to the right edge via margin-left:auto. */
    .bp-msg-top-search {
      flex: 0 1 360px;
      min-width: 200px;
      padding: 0 12px;
      height: 34px;
    }
    .bp-msg-filter-btn {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: 6px;
      flex-shrink: 0;
    }
    .bp-msg-filter-badge {
      min-width: 18px; height: 18px; padding: 0 5px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 9px;
      background: var(--theme-accent); color: #fff;
      font-size: 11px; font-weight: 600; line-height: 1;
    }
    .bp-msg-filter-body { display: flex; flex-direction: column; gap: 16px; }

    /* Long supplier names truncate inside the shared bp-sidebar-item. */
    .bp-msg-supp-name {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      flex: 1; min-width: 0;
    }

    /* v1.28: .bp-msg-filter / -btn / -n removed — status filter now
       lives in the left sidebar using shared bp-sidebar-item/-count. */

    /* Empty state — v1.65cr (p0006).
       Two flavours: the original quiet text-only fallback (used for
       global-mode "pick a project" + the search-no-hits case), and
       the richer "No replies yet" card with a circled icon + Go to
       cart CTA when there are no replies in a project. */
    .bp-msg-empty {
      padding: 56px 24px;
      text-align: center;
      color: var(--color-text-muted);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      font-size: 13px;
      line-height: 1.55;
      min-height: 320px;
      justify-content: center;
    }
    .bp-msg-empty > lucide-icon { color: var(--color-text-muted); opacity: 0.6; }
    .bp-msg-empty p { margin: 0; }

    /* Circled accent icon — only on the "No replies yet" branch. */
    .bp-msg-empty-icon {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--theme-soft);
      display: flex; align-items: center; justify-content: center;
      color: var(--theme-accent);
      margin-bottom: 6px;
    }
    .bp-msg-empty-icon lucide-icon { color: var(--theme-accent); opacity: 1; }
    .bp-msg-empty-title {
      font-family: var(--font-display);
      font-size: 18px; font-weight: 400;
      color: var(--color-text-primary);
      margin-bottom: 4px;
    }
    .bp-msg-empty-sub {
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.5;
      max-width: 320px;
      margin-bottom: 14px;
    }
    .bp-msg-empty-cta {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--theme-accent);
      color: var(--color-surface);
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius-button);
      font-family: var(--font-body);
      font-size: 12px; font-weight: 500;
      cursor: pointer;
      transition: filter 0.15s;
    }
    .bp-msg-empty-cta:hover { filter: brightness(0.92); }

    /* ── LIST + CARD VIEWS — v1.65cr (p0006).
       New thread-card primitive. Flat 0.5px border at rest, lifts to
       --shadow-xs on hover. Selected = --theme-soft fill + accent
       border. Unread keeps a calm --theme-soft tint AND bolds the
       subject line; the two cues together make read-state unmissable
       without adding extra labels. */
    .bp-msg-list {
      display: flex; flex-direction: column; gap: 6px;
    }
    .bp-msg-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 14px;
    }
    @media (max-width: 1100px) {
      .bp-msg-cards { grid-template-columns: 1fr; }
    }
    .bp-msg-thread-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 10px 12px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      cursor: pointer;
      transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
    }
    .bp-msg-thread-card:hover {
      box-shadow: var(--shadow-xs);
      border-color: var(--color-border);
    }
    .bp-msg-thread-card--unread {
      background: var(--theme-soft);
    }
    .bp-msg-thread-card--selected,
    .bp-msg-thread-card--selected.bp-msg-thread-card--unread {
      background: var(--theme-soft);
      border-color: var(--theme-accent);
    }
    /* Logo — themed-tint rounded square with initials by default.
       v1.65cs — when a supplier has uploaded a logo asset, the
       --img modifier swaps the tinted fill for a white background
       so coloured marks stay legible. The <img> stretches to fit
       the square via object-fit: contain so the brand isn't cropped. */
    .bp-msg-thread-logo {
      width: 40px; height: 40px;
      border-radius: var(--radius-button);
      background: var(--theme-soft);
      color: var(--theme-text);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-body);
      font-size: 13px; font-weight: 600;
      flex-shrink: 0;
      overflow: hidden;
    }
    .bp-msg-thread-logo--lg { width: 48px; height: 48px; font-size: 15px; }
    .bp-msg-thread-logo--img {
      background: var(--color-surface);
      border: var(--border-hairline);
    }
    .bp-msg-thread-logo img {
      width: 100%; height: 100%;
      object-fit: contain;
      display: block;
    }
    .bp-msg-thread-body { flex: 1; min-width: 0; }
    .bp-msg-thread-top {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 8px;
    }
    .bp-msg-thread-supplier {
      font-size: 13px; font-weight: 500;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-msg-thread-time {
      font-size: 11px;
      color: var(--color-text-muted);
      flex-shrink: 0;
      white-space: nowrap;
    }
    .bp-msg-thread-subject {
      font-size: 12px;
      color: var(--color-text-primary);
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-msg-thread-card--unread .bp-msg-thread-subject {
      font-weight: 600;
    }
    /* v1.65cv (p0008 §8) — contact line + ref chip + precise stamp. */
    .bp-msg-thread-contact {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 1px;
    }
    .bp-msg-thread-contact lucide-icon { color: var(--color-text-muted); }
    .bp-msg-thread-ref {
      font-size: 10px; font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.04em;
      margin-right: 4px;
    }
    .bp-msg-thread-stamp {
      font-size: 9.5px;
      color: var(--color-text-muted);
      margin-left: auto;
      white-space: nowrap;
    }
    /* v1.65cv (p0008 §9) — overdue red dot on the status pill. */
    .bp-msg-overdue-dot {
      display: inline-block;
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--color-danger);
      margin-left: 4px;
      vertical-align: middle;
    }
    .bp-msg-thread-card--overdue { /* hook for future card-level treatment */ }
    .bp-msg-thread-meta {
      display: flex; align-items: center; gap: 6px;
      margin-top: 5px;
    }
    .bp-msg-thread-cat {
      font-size: 11px; color: var(--color-text-muted);
    }
    .bp-msg-thread-proj { color: var(--theme-accent); font-size: 11px; }
    .bp-msg-thread-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--theme-accent);
      flex-shrink: 0;
    }
    /* v1.65g1 — thread-card delete trash. Hover-only on the card
       (opacity 0 → 1) so the resting state stays clean. Red tint +
       red bg on hover so destructive intent reads. */
    .bp-msg-thread-del {
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s, background 0.15s;
    }
    .bp-msg-thread-card:hover .bp-msg-thread-del { opacity: 1; }
    .bp-msg-thread-del:hover {
      color: var(--color-danger);
      background: rgba(225, 29, 72, 0.08);
    }
    .bp-msg-thread-del lucide-icon { line-height: 0; }
    /* Card-tile variant — stacks the body content with a touch more
       padding for the grid layout. */
    .bp-msg-thread-card--tile {
      padding: 12px;
      gap: 12px;
    }

    /* Status badges — shared by list/card/table views. */
    .bp-msg-tbadge {
      font-size: 9px; font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.02em;
    }
    .bp-badge-action  { background: var(--color-action-bg);  color: var(--color-action-text); }
    .bp-badge-waiting { background: var(--color-waiting-bg); color: var(--color-waiting-text); }
    .bp-badge-quoted  { background: var(--color-quoted-bg);  color: var(--color-quoted-text); }
    .bp-badge-booked  { background: var(--color-booked-bg);  color: var(--color-booked-text); }
    .bp-badge-default { background: var(--color-fill);          color: var(--theme-accent); }

    /* v1.65cr (p0006) — old .bp-msg-card-tile / -top / -av / -name /
       -time / -prev / -foot rules removed; the card view now uses the
       same .bp-msg-thread-card primitive as the list view with the
       --tile modifier. The duplicate .bp-msg-cards rule from this
       block was also retired (the new copy upstream owns it). */

    /* ── TABLE VIEW — v1.65cr (p0006) tightened. */
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
      background: var(--color-fill);
    }
    .bp-msg-table td {
      padding: 9px 12px;
      border-bottom: 0.5px solid var(--color-border);
      cursor: pointer;
      color: var(--color-text-primary);
      vertical-align: middle;
    }
    .bp-msg-table tr:hover td { background: var(--theme-soft); }
    .bp-msg-table tr.active td { background: var(--theme-soft); }
    /* v1.65cr (p0006) — bold the subject cell on unread rows (same
       read-state cue as the list/card views). Other cells stay normal
       weight to keep scan-load light. */
    .bp-msg-table tr.unread .bp-msg-table-subject { font-weight: 600; }
    .bp-msg-table-subject {
      color: var(--color-text-primary);
      max-width: 320px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-msg-table-time { color: var(--color-text-muted); white-space: nowrap; }

    /* ── RIGHT: CONVERSATION (p0001) ──
       Panel chrome matches the other Marketplace panels. Header is
       calm (no saturated theme bar). Stream area keeps the nested
       --color-thread-bg tint — the one intentional nested tint. */
    .bp-msg-conv {
      display: flex; flex-direction: column;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
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

    /* v1.65db (p0013 header refit) — 3×2 grid header that reads like
       an email envelope: From / To / Subject in col 1, First / Last /
       Status in col 2. No back chevron, no card chrome, no logo.
       Closing the conversation is implicit (pick another thread). */
    .bp-thread-mail-head {
      background: var(--color-surface);
      border-bottom: var(--border-hairline);
      padding: 12px 16px;
      flex-shrink: 0;
      display: flex; flex-direction: column; gap: 4px;
    }

    /* v1.65dw — drawer-chip bar that sits between the metadata header
       and the conversation stream. Replaces the Event + Items
       collapsible sections; each chip opens the corresponding shared
       drawer (EventDrawerService / CartDrawerService).
       Same hairline-divider language as the mail header above so the
       transition reads as one continuous panel chrome. */
    .bp-thread-drawer-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--color-surface);
      border-bottom: var(--border-hairline);
      flex-shrink: 0;
    }
    .bp-thread-drawer-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-pill);
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .bp-thread-drawer-chip:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-soft);
    }
    .bp-thread-drawer-chip lucide-icon {
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-thread-drawer-chip-label {
      font-weight: 500;
    }
    .bp-thread-drawer-chip-badge {
      padding: 2px 6px;
      background: var(--color-fill);
      border-radius: var(--radius-pill);
      font-size: 10px;
      font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.04em;
    }
    .bp-thread-drawer-chip-action {
      font-size: 11px;
      color: var(--color-action);
      font-weight: 500;
    }
    .bp-thread-mail-row {
      display: grid;
      grid-template-columns: 60px minmax(0, 1fr) 60px minmax(0, 1fr);
      column-gap: 12px;
      align-items: baseline;
      font-size: 12px;
    }
    .bp-thread-mail-label {
      color: var(--color-text-muted);
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .bp-thread-mail-value {
      color: var(--color-text-primary);
      font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-mail-subject {
      font-weight: 600;
    }
    /* v1.65dc — Subject row spans full width; only label + value
       columns exist in this variant. */
    .bp-thread-mail-row--subject {
      grid-template-columns: 60px minmax(0, 1fr);
    }
    /* Next clock overdue treatment — matches the inbox row's red dot. */
    .bp-thread-mail-next--overdue {
      color: var(--color-danger);
      font-weight: 600;
    }
    @media (max-width: 720px) {
      .bp-thread-mail-row {
        grid-template-columns: 60px 1fr;
        row-gap: 4px;
      }
      .bp-thread-mail-row > :nth-child(3),
      .bp-thread-mail-row > :nth-child(4) {
        grid-column: 1 / -1;
      }
    }

    /* v1.65cz (p0013 §0) — email-style flat conversation header.
       v1.65db (p0013 header refit) — superseded by .bp-thread-mail-head
       above; legacy classes kept defined as no-ops for safety. */
    .bp-thread-email-head {
      background: var(--color-surface);
      border-bottom: var(--border-hairline);
      padding: 0 14px;
      min-height: 56px;
      flex-shrink: 0;
      display: flex; align-items: center; gap: 12px;
    }
    .bp-thread-email-back {
      width: 28px; height: 28px;
      border: none; background: none;
      border-radius: 50%;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
    }
    .bp-thread-email-back:hover { background: var(--theme-soft); color: var(--theme-accent); }
    .bp-thread-email-logo {
      width: 32px; height: 32px;
      border-radius: var(--radius-button);
      background: var(--theme-soft);
      color: var(--theme-text);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-body);
      font-size: 13px; font-weight: 600;
      flex-shrink: 0;
      overflow: hidden;
    }
    .bp-thread-email-logo--img {
      background: var(--color-surface);
      border: var(--border-hairline);
    }
    .bp-thread-email-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .bp-thread-email-id { flex: 1; min-width: 0; }
    .bp-thread-email-name {
      font-size: 15px; font-weight: 600;
      color: var(--color-text-primary);
      line-height: 1.2;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-email-sub {
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.2;
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-email-pill { flex-shrink: 0; }
    .bp-thread-email-clock {
      display: inline-flex; align-items: center; gap: 4px;
      flex-shrink: 0;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--theme-soft);
      color: var(--color-text-secondary);
      font-family: var(--font-body);
      font-size: 11px; font-weight: 500;
    }
    .bp-thread-email-clock lucide-icon { color: var(--theme-accent); }
    .bp-thread-email-clock--overdue {
      background: var(--color-action-bg);
      color: var(--color-action-text);
    }
    .bp-thread-email-clock--overdue lucide-icon { color: var(--color-action-text); }
    .bp-thread-email-menu {
      width: 32px; height: 32px;
      border-radius: 50%;
      border: none; background: none;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
    }
    .bp-thread-email-menu:hover { background: var(--theme-soft); color: var(--theme-accent); }

    /* v1.65cx (p0011 §3) — header now a single horizontal strip:
       [<]  [supplier row card]  [pill]  [clock chip]  [⋯]
       Drops the legacy .bp-thread-top container + bp-thread-status-tags
       pill row in favour of a clone of the marketplace's supplier
       list-mode card.
       v1.65cz (p0013 §0) — superseded by .bp-thread-email-head above;
       kept defined as a no-op for any stale references. */
    .bp-thread-header {
      background: var(--color-surface);
      border-bottom: var(--border-hairline);
      padding: 10px 12px;
      flex-shrink: 0;
      display: flex; align-items: center; gap: 10px;
    }
    .bp-thread-supplier-card {
      flex: 1; min-width: 0;
      display: flex; align-items: center; gap: 12px;
      padding: 6px 10px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
    }
    .bp-thread-supplier-logo {
      width: 44px; height: 44px;
      border-radius: var(--radius-button);
      background: var(--theme-soft);
      color: var(--theme-text);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display);
      font-size: 18px; font-weight: 500;
      flex-shrink: 0;
      overflow: hidden;
    }
    .bp-thread-supplier-logo--img {
      background: var(--color-surface);
      border: var(--border-hairline);
    }
    .bp-thread-supplier-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .bp-thread-supplier-body { flex: 1; min-width: 0; }
    .bp-thread-supplier-name {
      font-size: 14px; font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-supplier-eyebrow {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-supplier-pill { flex-shrink: 0; }
    .bp-thread-clock-chip {
      display: inline-flex; align-items: center; gap: 4px;
      flex-shrink: 0;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--theme-soft);
      color: var(--color-text-secondary);
      font-family: var(--font-body);
      font-size: 11px; font-weight: 500;
    }
    .bp-thread-clock-chip lucide-icon { color: var(--theme-accent); }
    .bp-thread-clock-chip--overdue {
      background: var(--color-action-bg);
      color: var(--color-action-text);
    }
    .bp-thread-clock-chip--overdue lucide-icon { color: var(--color-action-text); }
    .bp-thread-menu-btn {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: none; background: none;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
    }
    .bp-thread-menu-btn:hover { background: var(--theme-soft); color: var(--theme-accent); }
    /* Legacy classes — kept defined as no-ops so dormant references
       elsewhere don't break before they're swept. */
    .bp-thread-top    { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bp-back-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-muted); background: none; border: var(--border-hairline-strong); border-radius: var(--radius-button); cursor: pointer; font-family: var(--font-body); flex-shrink: 0; padding: 4px 6px; transition: color 0.15s, border-color 0.15s; }
    .bp-back-btn:hover { color: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-thread-cat-icon { width: 28px; height: 28px; border-radius: var(--radius-button); flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: var(--border-hairline-strong); }
    .bp-cat-action  { background: var(--color-action-bg); border-color: var(--color-action-border); color: var(--color-action-text); }
    .bp-cat-waiting { background: var(--color-waiting-bg); border-color: var(--color-waiting-border); color: var(--color-waiting-text); }
    .bp-cat-quoted  { background: var(--color-quoted-bg); border-color: var(--color-quoted-border); color: var(--color-quoted-text); }
    .bp-cat-booked  { background: var(--color-booked-bg); border-color: var(--color-booked-border); color: var(--color-booked-text); }
    .bp-cat-default { background: var(--color-fill); border-color: var(--theme-border); color: var(--theme-accent); }
    .bp-thread-info { flex: 1; min-width: 0; }
    .bp-thread-name { font-family: var(--font-display); font-size: 16px; font-weight: 400; color: var(--color-text-primary); }
    .bp-thread-sub  { font-size: 11px; color: var(--color-text-muted); }
    .bp-thread-status-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .bp-status-tag { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: var(--radius-pill); border: 0.5px solid var(--tag-color); color: var(--tag-color); background: var(--color-surface); cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-status-tag.active { background: var(--tag-color); color: #fff; }
    /* v1.65cz (p0013 §1) — collapsible section frame used by Event /
       Items / Conversation. Section header is clickable; chevron
       reflects open/closed; body renders when open. */
    .bp-thread-sec {
      flex-shrink: 0;
      border-bottom: var(--border-hairline);
      background: var(--color-surface);
    }
    .bp-thread-sec--conv { flex: 1; display: flex; flex-direction: column; min-height: 0; border-bottom: none; }
    .bp-thread-sec-head {
      width: 100%;
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      background: var(--theme-soft);
      border: none;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 11px; font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.06em; text-transform: uppercase;
      transition: background 0.12s;
    }
    .bp-thread-sec-head:hover { background: var(--color-fill); }
    .bp-thread-sec-head lucide-icon { color: var(--theme-accent); flex-shrink: 0; }
    .bp-thread-sec-label { flex-grow: 0; }
    .bp-thread-sec-badge {
      font-size: 10px; font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--theme-accent);
      letter-spacing: 0.04em;
      margin-left: 4px;
    }
    .bp-thread-sec-action-hint {
      font-size: 10px; font-weight: 500;
      color: var(--color-text-muted);
      text-transform: none;
      letter-spacing: 0;
    }
    .bp-thread-sec-chev { margin-left: auto; }
    .bp-thread-sec-body { padding: 12px 14px; }
    .bp-thread-sec-body--items {
      display: flex; flex-direction: column; gap: 8px;
    }

    /* v1.65cz (p0013 §2) — Event details card: 3×2 grid, calm. */
    .bp-event-card {
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      background: var(--color-surface);
      overflow: hidden;
    }
    .bp-event-card-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px 18px;
      padding: 14px 16px;
    }
    @media (max-width: 720px) {
      .bp-event-card-grid { grid-template-columns: 1fr; }
    }
    .bp-event-cell { min-width: 0; }
    .bp-event-cell-label {
      font-size: 9.5px; font-weight: 600;
      color: var(--color-text-muted);
      letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 4px;
    }
    .bp-event-cell-value {
      font-size: 14px; font-weight: 500;
      color: var(--color-text-primary);
      line-height: 1.3;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-event-cell-sub {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    /* v1.65cv (p0008 §4.1) — items section above the chat stream.
       Acts as a summary header + the actionable surface. */
    .bp-thread-items {
      flex-shrink: 0;
      border-bottom: var(--border-hairline);
      background: var(--color-surface);
    }
    .bp-thread-items-head {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 14px;
      font-size: 11px; font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    .bp-thread-items-head lucide-icon { color: var(--theme-accent); }
    .bp-thread-items-action-count {
      color: var(--color-text-muted);
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
    }
    .bp-thread-items-list {
      display: flex; flex-direction: column; gap: 8px;
      padding: 0 14px 12px;
    }
    /* v1.65de (p0013 §4) — chat stream gets a subtle grain pattern
       layered over the parchment ground, same SVG noise used by the
       Bold hero. Opacity ~0.04 — visible only as a faint texture. */
    .bp-thread-msgs {
      flex: 1; overflow-y: auto;
      padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
      background-color: var(--color-thread-bg, var(--color-fill));
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-attachment: local;
      min-height: 200px;
    }

    /* v1.65de — sender-aligned lanes. Each stream entry sits inside
       a .bp-msg-lane row; its modifier (--out / --in) controls the
       lane alignment. Bubbles + item cards max out at ~75% width. */
    .bp-msg-lane {
      display: flex;
      width: 100%;
      gap: 8px;
      align-items: flex-end;
    }
    .bp-msg-lane--out { justify-content: flex-end; }
    .bp-msg-lane--in  { justify-content: flex-start; }
    .bp-msg-lane > .bp-msg-bubble { max-width: 75%; min-width: 0; }
    /* v1.65fX — outbound lanes flip the order so the avatar sits to
       the RIGHT of the bubble (next to the speaker's edge). Inbound
       leaves the avatar to the LEFT, default flex order. */
    .bp-msg-lane--out .bp-msg-avatar { order: 2; }
    .bp-msg-lane--out .bp-msg-bubble { order: 1; }
    /* v1.65fX — initials avatar. 32px theme-soft circle with
       theme-accent body type — same chrome the rest of the app uses
       for "person" tiles. */
    .bp-msg-avatar {
      flex-shrink: 0;
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--theme-soft);
      color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-body);
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.04em;
      user-select: none;
    }

    /* v1.65df — text bubble. WhatsApp convention: outbound = mint
       (#dcf8c6), inbound = white. These are intentionally semantic
       chat colours, NOT theme-driven — the green-vs-white pairing
       is what makes "yours vs theirs" instantly readable, and a
       theme-coloured outbound (e.g. pink) breaks that affordance.
       Same logic as our --color-action/waiting/booked semantic
       tokens which don't recolour with the admin preset. */
    .bp-msg-bubble {
      padding: 8px 12px 6px;
      border-radius: var(--radius-card);
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-text-primary);
      box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.08);
    }
    .bp-msg-bubble--out {
      background: #dcf8c6;
      color: #1a1a1a;
      border-bottom-right-radius: 4px;
    }
    .bp-msg-bubble--in {
      background: #ffffff;
      border-bottom-left-radius: 4px;
    }
    .bp-msg-bubble--unread { border-left: 3px solid var(--theme-accent); border-radius: 0 var(--radius-card) var(--radius-card) 0; }
    .bp-msg-bubble-body { white-space: pre-wrap; }
    /* v1.65f6 — bubble footer: reply (left) + timestamp (right). */
    .bp-msg-bubble-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      min-height: 14px;
    }
    .bp-msg-bubble-reply {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 6px 1px 4px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.02em;
      border-radius: 999px;
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
      opacity: 0.7;
    }
    .bp-msg-bubble:hover .bp-msg-bubble-reply { opacity: 1; }
    .bp-msg-bubble-reply:hover {
      color: var(--theme-accent);
      background: var(--color-fill);
    }
    .bp-msg-bubble-reply lucide-icon { line-height: 0; }
    /* v1.65g0 — delete trash icon. Same hover-fade vocabulary as
       the reply pill but tinted red so destructive intent reads
       at a glance. */
    .bp-msg-bubble-del {
      display: inline-flex; align-items: center;
      padding: 2px 6px;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      opacity: 0.5;
      border-radius: 999px;
      transition: color 0.15s, background 0.15s, opacity 0.15s;
    }
    .bp-msg-bubble:hover .bp-msg-bubble-del { opacity: 1; }
    .bp-msg-bubble-del:hover {
      color: var(--color-danger);
      background: rgba(225, 29, 72, 0.08);
    }
    .bp-msg-bubble-del lucide-icon { line-height: 0; }
    .bp-msg-bubble-time {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-left: auto;
      text-align: right;
    }
    .bp-msg-bubble-crumb {
      font-size: 10px; font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.02em;
      margin-bottom: 4px;
      opacity: 0.85;
    }

    /* Caption under an action card — small, muted, italic. */
    .bp-msg-stream-caption {
      font-size: 11px;
      font-style: italic;
      color: var(--color-text-muted);
      padding: 4px 8px 0;
      line-height: 1.4;
    }

    .bp-thread-msgs-legacy { display: none; }
    /* v1.65cy (p0011 fix) — inline item card wrapper in the stream.
       Tiny wrapper so the pulse target is the card row, not the
       message bubble next to it. */
    .bp-msg-stream-item {
      border-radius: var(--radius-button);
      transition: box-shadow 0.3s;
    }
    .bp-msg-stream-item--pulse {
      animation: bp-stream-item-pulse 1.2s ease-out 1;
    }
    @keyframes bp-stream-item-pulse {
      0%   { box-shadow: 0 0 0 0 var(--theme-accent); }
      40%  { box-shadow: 0 0 0 4px var(--theme-soft); }
      100% { box-shadow: none; }
    }
    .bp-msg-stream-empty {
      text-align: center;
      padding: 32px 12px;
      color: var(--color-text-muted);
      font-size: 12px;
      font-style: italic;
    }
    .bp-date-sep { text-align: center; font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0; }
    /* v1.65aj (p0001) — bubble radii token-migrated. */
    .bp-msg-card { border-radius: var(--radius-button); padding: 10px 12px; border: var(--border-hairline-strong); }
    .bp-msg-read   { background: var(--color-msg-read-bg); border-color: var(--color-msg-read-border); }
    .bp-msg-unread { background: var(--color-surface); border-color: var(--color-msg-read-border); border-left: 3px solid var(--theme-accent); border-radius: 0 var(--radius-button) var(--radius-button) 0; }
    .bp-msg-out    { background: var(--color-msg-out-bg); border-color: var(--color-msg-out-border); }
    .bp-msg-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .bp-msg-card-sender { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-msg-card-body   { font-size: 13px; color: var(--color-text-primary); line-height: 1.5;
      white-space: pre-wrap; }
    .bp-quoted-items { margin-top: 10px; border-top: 0.5px solid var(--color-border); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
    .bp-quoted-items-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-quoted-item { display: flex; align-items: center; gap: 10px; background: var(--color-surface); border: var(--border-hairline); border-radius: var(--radius-button); padding: 9px 11px; }
    .bp-quoted-item-icon { width: 28px; height: 28px; border-radius: 7px; background: var(--color-fill); border: 0.5px solid var(--theme-border); display: flex; align-items: center; justify-content: center; color: var(--theme-accent); flex-shrink: 0; }
    .bp-quoted-item-body { flex: 1; min-width: 0; }
    .bp-quoted-item-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-quoted-item-desc { font-size: 11px; color: var(--color-text-muted); }
    .bp-quoted-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .bp-quoted-item-price { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .bp-accept-btn { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: var(--radius-button); background: var(--theme-accent); color: var(--color-surface); border: none; cursor: pointer; font-family: var(--font-body); }
    .bp-accepted-tag { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: var(--radius-button); background: var(--color-booked-bg); color: var(--color-booked-text); border: 0.5px solid var(--color-booked-border); }
    /* v1.65de (p0013 §5) — Compose chip strip. Stacks vertically:
       chips row + optional placeholder/note row + tool row + optional
       picker. Default state is just chips + tools (no text input). */
    .bp-compose {
      display: flex; flex-direction: column;
      gap: 8px;
      padding: 10px 14px 12px;
      border-top: var(--border-hairline);
      background: var(--color-surface);
      flex-shrink: 0;
    }
    .bp-compose-input, .bp-compose-note-input { flex: 1; }
    .bp-compose-chips {
      display: flex; gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: thin;
    }
    .bp-compose-chips::-webkit-scrollbar { height: 4px; }
    .bp-compose-chip {
      flex-shrink: 0;
      padding: 5px 12px;
      background: var(--theme-soft);
      color: var(--theme-text);
      border: 0.5px solid transparent;
      border-radius: var(--radius-pill);
      font-family: var(--font-body);
      font-size: 12px; font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s, border-color 0.12s;
    }
    .bp-compose-chip:hover { background: var(--color-fill); border-color: var(--theme-accent); }
    .bp-compose-ph {
      display: flex; gap: 6px; align-items: center;
      padding: 6px 0;
    }
    .bp-compose-ph-label {
      font-size: 11px; font-weight: 600;
      color: var(--color-text-muted);
      text-transform: capitalize;
      flex-shrink: 0;
    }
    .bp-compose-ph-input { flex: 1; }
    .bp-compose-note {
      display: flex; flex-direction: column; gap: 6px;
    }
    .bp-compose-note-input {
      width: 100%;
      font-family: var(--font-body);
      font-size: 13px;
      padding: 8px 10px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      resize: vertical;
      min-height: 60px;
    }
    .bp-compose-note-row {
      display: flex; justify-content: flex-end; gap: 6px;
    }
    .bp-compose-tools {
      display: flex; align-items: center; gap: 4px;
    }
    .bp-compose-tools-spacer { flex: 1; }
    .bp-compose-tool {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px;
      background: none; border: 0.5px solid transparent;
      border-radius: var(--radius-pill);
      color: var(--color-text-muted);
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 11px; font-weight: 500;
      transition: color 0.12s, background 0.12s, border-color 0.12s;
    }
    .bp-compose-tool:hover { color: var(--theme-accent); background: var(--theme-soft); }
    .bp-compose-tool--active { color: var(--theme-accent); background: var(--theme-soft); border-color: var(--theme-accent); }
    .bp-compose-tool-tag { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-compose-picker {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 8px 10px;
      background: var(--theme-soft);
      border: var(--border-hairline);
      border-radius: var(--radius-button);
    }
    .bp-compose-picker-label {
      width: 100%;
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--theme-accent);
      margin-bottom: 2px;
    }
    .bp-compose-picker-item {
      padding: 4px 10px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-pill);
      font-family: var(--font-body); font-size: 11px;
      cursor: pointer;
      transition: border-color 0.12s, color 0.12s;
    }
    .bp-compose-picker-item:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-compose-picker-item--active { background: var(--theme-accent); color: var(--color-surface); border-color: var(--theme-accent); }
    .bp-compose-picker-row { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
    .bp-compose-picker-input {
      flex: 1;
      font-family: var(--font-body); font-size: 12px;
      padding: 6px 8px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
    }
    .bp-compose-picker-actions { display: flex; gap: 6px; width: 100%; justify-content: flex-end; }

    /* Legacy classes — kept defined for any stale references. */
    .bp-compose-input { flex: 1; }
    .bp-send-btn { width: 36px; height: 36px; border-radius: var(--radius-button); background: var(--theme-accent); border: none; color: var(--color-surface); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bp-send-btn:disabled { opacity: 0.4; cursor: default; }
  `]
})
export class MessagesInboxComponent implements OnInit {
  // When used as project tab, pass the project ID directly
  @Input() boundProjectId = '';
  // When used as global inbox, shows project selector
  @Input() showProjectSelector = false;
  /** v1.65dt (p0015) — drives the viewer-side branching for this
      shared inbox. 'agency' (default) keeps every existing surface
      working without change. 'supplier' will be passed by the new
      /inbox route once the supplier persona shell lands (Phase 2).
      Divergence points the component should branch on:
        - thread row's "From" label (supplier_name vs agency_name)
        - thread row's logo (supplier vs agency)
        - conversation lane side (agent right / supplier left vs flip)
        - action sets on item cards (agency vs supplier table)
        - compose chip seed list
      Phase 1 wires the input only; Phase 2 implements the
      divergent rendering as the supplier surface comes online. */
  @Input() viewer: 'agency' | 'supplier' = 'agency';

  /** v1.65cf — user-resizable conversation preview column width.
      Bound to a CSS variable on the body container; defaults to 640
      and clamps between 360 and 1100. Persisted to localStorage so
      the user's chosen width survives reloads + route changes. */
  previewWidth = 640;
  private static readonly PREVIEW_W_KEY = 'bp-msg-preview-w';
  private static readonly PREVIEW_W_MIN = 360;
  private static readonly PREVIEW_W_MAX = 1100;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartW = 0;

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
  /** v1.65g4 — Client filter that sits to the LEFT of the project
      filter on the top row. Selecting a client narrows projectOptions
      to that client's projects (and clears selectedProjectId if the
      previously-selected project no longer fits). '' = All clients. */
  selectedClientId = '';
  activeStatus = 'all';
  activeFolder = 'all';
  /** Filter drawer (Category / Contact / Status) open state. */
  filterOpen = false;
  /** v1.27: supplier filter (left sidebar). 'all' = no filter. */
  activeSupplier: string = 'all';
  /** v1.27 → v1.65dt (p0015) — list / card / table view toggle
      dropped. List view is the only render path now. activeView
      field retired. */
  /** v1.27: free-text search across supplier name + latest body +
      quoted item names. Debounced 300ms via onSearchChange.
      v1.65du — restored after p0015's drop was overridden per user
      feedback. */
  searchTerm = '';
  private searchDebounce: any = null;
  activeThread: VendorThread | null = null;
  newMsg = '';
  sending = false;

  /** v1.65de (p0013 §5) — Compose chip strip state. Tools are
      sticky-per-thread until the agent sends OR explicitly clears.
      The note input is hidden until Add note is tapped. */
  composeChips: Array<{ code: string; label: string; body: string; preview?: string }> = [];
  composeNoteOpen = false;
  composeNoteHint = '';
  composePlaceholder: { label: string; key: string; hint: string; value: string; chipBody: string } | null = null;
  composeTaggedItemId: string | null = null;
  composeNextActionBy: string | null = null;
  itemTagPickerOpen = false;
  clockPickerOpen = false;
  clockDraft = '';
  /** Track suppliers we've already sent to so the cold/warm template
      picks the right opener. Populated as soon as buildThreads runs. */
  private supplierAlreadyContacted = new Set<string>();
  statuses = STATUSES;
  private lastDate = '';
  private orgId = '';
  /** v1.65db (p0013 header refit) — agency name for the From/To grid
      header. Stashed from getCurrentOrg() so we don't re-fetch per
      thread. */
  agencyName = '';

  @ViewChild('messageList') messageList?: ElementRef;

  /** v1.65cv (p0008 §4) — message_items + reason codelist for the
      active thread. Loaded on openThread; emptied on closeThread. */
  threadItems: MessageItemRow[] = [];
  /** v1.65de (p0013 §4) — most-recent event per item, keyed by
      message_item_id. Drives the "lane" (which side this transition
      lives in: agent / supplier) and the caption-under-action note.
      For now we derive lane from items.adjusted_by + status; events
      table query is a TODO follow-up. */
  itemEventByItem: Record<string, { actorType: 'agent' | 'supplier'; note: string | null }> = {};
  declineReasonsPre: Array<{ code: string; label: string }> = [];
  declineReasonsPost: Array<{ code: string; label: string }> = [];

  /** v1.65cz (p0013 §2) — project payload for the Event details card.
      Loaded on openThread (skipped when already loaded for this pid). */
  activeProject: any | null = null;
  /** v1.65cz (p0013 §1) — collapsible section state. Defaults per
      p0013 §1: Event collapsed, Items expanded, Conversation always
      visible (can't fully collapse). Resets on thread switch. */
  /** v1.65dw — secEventOpen + secItemsOpen retired (Event Details +
      Items now open in their own shared drawers via the chip bar
      below the metadata header). secConvOpen kept for the
      Conversation section header chevron. */
  secConvOpen  = true;

  constructor(
    private route: ActivatedRoute,
    private msgSvc: MsgSvc,
    private projectCategorySvc: ProjectCategoryService,
    private projectSvc: ProjectService,
    private clientSvc: ClientService,
    private orgSvc: OrgService,
    private shellCtx: ShellContextService,
    private cartDrawerSvc: CartDrawerService,
    private eventDrawerSvc: EventDrawerService,
    private personaSvc: PersonaService,
    private codelistSvc: CodelistService,
    private messageItemSvc: MessageItemService,
    private router: Router,
    private toast: MessageService,
    private datePipe: DatePipe,
    public cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // v1.65cf — restore the user's chosen preview width if present.
    try {
      const saved = localStorage.getItem(MessagesInboxComponent.PREVIEW_W_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (Number.isFinite(n)) this.previewWidth = this.clampPreviewWidth(n);
      }
    } catch { /* localStorage may be unavailable in some sandboxes */ }

    // v1.65de (p0013 §5) — warm the quick-reply chip codelist once
    // on init so the compose strip is populated by the time the
    // user opens their first thread.
    this.loadComposeChips();

    // v1.65et (p0015 — supplier action train) — listen for action
    // events fired from rows in the Cart drawer (supplier view).
    // Route through the existing onItemAction reply pipeline so the
    // action lands on the right message_item server-side; the same
    // viewer-aware /messages/:id/reply endpoint handles the
    // adjusted_by_supplier / declined_by_supplier / accepted
    // transitions and forks a Rocket-Food-owned catalogue items row
    // on adjust (server-side maybeForkCatalogueItem).
    this.cartDrawerSvc.rowAction$.subscribe(evt => {
      // Map the drawer's rowId (= message_items.id) to the in-memory
      // threadItems entry so onItemAction can grab the rest of the
      // fields it expects.
      const it = (this.threadItems || []).find(x => x.id === evt.rowId);
      if (!it) return;
      this.onItemAction(it, {
        action: evt.action,
        reason_code: evt.reason_code,
        note: evt.note,
        name: evt.name,
        description: evt.description,
        price: evt.price,
        unit: evt.unit,
        // image_url passes via the catch-all 'any' cast — onItemAction
        // hands it to the server through the agentReply payload.
        ...(evt.image_url ? { image_url: evt.image_url } : {}),
      } as any);
    });

    // v1.65ev — batched supplier reply. The supplier queues multiple
    // row actions in the Cart drawer, types a wrap-up message, and
    // hits Send → the drawer fires ONE event with all actions + the
    // body. We send it as a single consolidated reply (one inbound
    // message + N item_actions in one DB transaction) instead of N
    // per-row replies cluttering the conversation.
    this.cartDrawerSvc.batchAction$.subscribe(batch => {
      this.sendBatchReply(batch.actions, batch.body || '');
    });

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
      if (org) {
        this.orgId = org.id;
        // v1.65db (p0013 header refit) — agency name for the new
        // 3×2 grid header (From line).
        this.agencyName = (org as any).name || '';
      }
    });

    if (this.viewer === 'supplier') {
      // v1.65ea (p0015) — supplier persona inbox. Load all messages
      // where this supplier_org_id is the recipient. PersonaService
      // is the source of truth for which supplier we are.
      this.loadAllMessages();
    } else if (this.showProjectSelector && !this.boundProjectId) {
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

  /** v1.65g4 — Client dropdown options for the top filter row.
      Deduped over this.projects[].client_id (with client_name as the
      label). The server's /projects endpoint already left-joins
      clients.name as client_name, so no extra fetch is required.
      Lead row is "All clients" (id ''). */
  get clientDropdownOptions(): Array<{ id: string; name: string }> {
    const map: Record<string, string> = {};
    for (const p of (this.projects || [])) {
      const cid = (p as any)?.client_id || '';
      const cname = (p as any)?.client_name || '';
      if (cid && cname && !map[cid]) map[cid] = cname;
    }
    const opts: Array<{ id: string; name: string }> = [
      { id: '', name: 'All clients' }
    ];
    Object.keys(map)
      .sort((a, b) => map[a].localeCompare(map[b]))
      .forEach(cid => opts.push({ id: cid, name: map[cid] }));
    return opts;
  }

  /** v1.65g4 — Project options narrow to the currently-selected
      client (if any). All "All projects" lead row remains so the
      user can clear the project filter independently. */
  get projectOptionsFiltered(): any[] {
    if (!this.selectedClientId) return this.projectOptions;
    return this.projectOptions.filter(o =>
      // Keep the 'All Projects' sentinel (id '') always.
      !o.id || this.projects.find(p => p.id === o.id && (p as any).client_id === this.selectedClientId)
    );
  }

  /** v1.65g4 — Client change handler. Rebuilds the project option
      set to match the selected client. If the previously-selected
      project no longer belongs to this client, clear the project
      filter (and reset the thread list to mirror the "no project
      picked yet" state, exactly like onProjectChange does). */
  onClientChange() {
    // If the currently-selected project doesn't belong to this client,
    // drop it so the dropdown shows the right label.
    if (this.selectedProjectId && this.selectedClientId) {
      const proj = this.projects.find(p => p.id === this.selectedProjectId);
      if (proj && (proj as any).client_id !== this.selectedClientId) {
        this.selectedProjectId = '';
        this.threads = [];
        this.activeThread = null;
        this.categoryFolders = [];
        this.activeFolder = 'all';
      }
    }
    // Rebuild projectOptions to honour the client narrowing. Keep
    // the 'All Projects' lead row.
    const lead = [{ name: 'All Projects', id: '' }];
    const filtered = this.selectedClientId
      ? this.projects.filter(p => (p as any).client_id === this.selectedClientId)
      : this.projects;
    this.projectOptions = [
      ...lead,
      ...filtered.map(p => ({ name: (p as any).event_name || p.name, id: p.id }))
    ];
    this.cdr.detectChanges();
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
    // v1.65ea (p0015) — viewer-aware feed. Agency view pulls messages
    // by agency org_id (the existing path); supplier view pulls by
    // supplier_org_id from the active persona record (Ryan Foster →
    // Rocket Food's org id). When persona-switching lands in prod
    // auth, this branch reads from real session data instead.
    this.loading = true;
    let req$;
    if (this.viewer === 'supplier') {
      const supId = this.personaSvc.active?.orgId;
      if (!supId) {
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      req$ = this.msgSvc.getAllBySupplier(supId);
    } else {
      if (!this.orgId) {
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      req$ = this.msgSvc.getAllByOrg(this.orgId);
    }
    req$.subscribe({
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
      // v1.67d — one definition of the thread key (MsgSvc.threadKey),
      // shared with the supplier home unread-count badge.
      const key = MsgSvc.threadKey(m);
      if (!map[key]) {
        map[key] = {
          key, supplierId: sid,
          supplierName: m.supplier_name || 'Unknown Supplier',
          // v1.65cs (p0006) — supplier logo lifted from the first
          // message that carries one. Falls back to cover_image_url
          // (banner) when no square logo is uploaded, then to ''
          // so the template renders initials.
          supplierLogoUrl: (m.supplier_logo_url || m.supplier_cover_url || ''),
          // v1.65cv (p0008 §8) — ref + contact + clock from the
          // first message that carries each; upgraded below as more
          // messages stream in.
          refCode:      m.ref_code || '',
          contactName:  m.contact_name || '',
          nextActionBy: m.next_action_by || null,
          categoryId: cid, categoryName: m.category_name || '',
          projectId: pid, projectName: m.project_name || '',
          latestMsg: m, status: '', count: 0, unread: false, messages: []
        };
      } else {
        if (!map[key].supplierLogoUrl) {
          const u = (m.supplier_logo_url || m.supplier_cover_url || '');
          if (u) map[key].supplierLogoUrl = u;
        }
        if (!map[key].refCode     && m.ref_code)     map[key].refCode     = m.ref_code;
        if (!map[key].contactName && m.contact_name) map[key].contactName = m.contact_name;
        // Latest message's next_action_by wins — it represents the
        // most-recent commitment.
        if (m.next_action_by) map[key].nextActionBy = m.next_action_by;
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
    // v1.65de (p0013 §5) — note the suppliers we've reached before
    // so openNote() can pick the warm vs cold opener.
    this.supplierAlreadyContacted.clear();
    for (const t of this.threads) {
      if (t.supplierId && t.messages.length > 1) {
        this.supplierAlreadyContacted.add(t.supplierId);
      }
    }
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

  // ── v1.65cf — preview column resize ───────────────────────────────

  private clampPreviewWidth(n: number): number {
    return Math.max(
      MessagesInboxComponent.PREVIEW_W_MIN,
      Math.min(MessagesInboxComponent.PREVIEW_W_MAX, Math.round(n))
    );
  }

  /** Start a drag on the conversation-preview resize handle. We bind
      pointermove/pointerup on the document via HostListener so the
      drag survives the cursor leaving the 6px handle. */
  onResizeStart(ev: PointerEvent) {
    ev.preventDefault();
    this.resizing = true;
    this.resizeStartX = ev.clientX;
    this.resizeStartW = this.previewWidth;
    const el = ev.target as HTMLElement;
    el.classList.add('bp-resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  @HostListener('document:pointermove', ['$event'])
  onResizeMove(ev: PointerEvent) {
    if (!this.resizing) return;
    // Handle sits on the LEFT edge of the right column — dragging
    // left (clientX < startX) widens the column.
    const delta = this.resizeStartX - ev.clientX;
    this.previewWidth = this.clampPreviewWidth(this.resizeStartW + delta);
    this.cdr.detectChanges();
  }

  @HostListener('document:pointerup')
  onResizeEnd() {
    if (!this.resizing) return;
    this.resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.querySelectorAll('.bp-msg-preview-resizer.bp-resizing')
      .forEach(el => el.classList.remove('bp-resizing'));
    try {
      localStorage.setItem(MessagesInboxComponent.PREVIEW_W_KEY, String(this.previewWidth));
    } catch { /* ignore */ }
  }

  /** v1.65cb — options for the "All ▾" category-scope dropdown in the
      search row (mirrors catalogue-grid.stripDropdownOptions). Always
      leads with "All" and then maps the loaded categoryFolders. */
  get folderDropdownOptions(): Array<{ id: string; name: string }> {
    const opts: Array<{ id: string; name: string }> = [{ id: 'all', name: 'All' }];
    for (const f of this.categoryFolders) {
      opts.push({ id: f.id, name: f.name });
    }
    return opts;
  }

  /** Number of active (non-default) drawer filters → the Filter button badge. */
  get activeFilterCount(): number {
    let n = 0;
    if (this.activeFolder && this.activeFolder !== 'all') n++;
    if (this.activeSupplier && this.activeSupplier !== 'all') n++;
    if (this.activeStatus && this.activeStatus !== 'all') n++;
    return n;
  }

  /** Dropdown change handler — keeps activeFolder + circle strip in sync. */
  onFolderDropdownChange(id: string) {
    this.activeFolder = id || 'all';
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

  /** v1.65dv (p0015 follow-up) — Contact dropdown options for the
      INBOX header. Wraps supplierList with an "All" lead row and
      renames it semantically (agency view = list of suppliers,
      supplier view = list of agencies in Phase 2). The count chips
      from the old sidebar are folded into the label so the dropdown
      can stay slim. */
  get contactDropdownOptions(): Array<{ id: string; name: string }> {
    const allLabel = this.viewer === 'supplier' ? 'All agencies' : 'All contacts';
    const opts: Array<{ id: string; name: string }> = [{ id: 'all', name: allLabel }];
    for (const s of this.supplierList) {
      opts.push({ id: s.id, name: `${s.name} (${s.count})` });
    }
    return opts;
  }

  onContactDropdownChange(id: string) {
    this.activeSupplier = id || 'all';
    this.cdr.detectChanges();
  }

  /** v1.65dv — Status dropdown options. Mirrors the old sidebar
      status list; counts live in the label so the dropdown row reads
      "Action (3)" / "Waiting (1)" etc. */
  get statusDropdownOptions(): Array<{ id: string; name: string }> {
    return (this.statuses || []).map(s => {
      const count = s.id === 'all' ? this.threads.length : this.countByStatus(s.id);
      return { id: s.id, name: `${s.label} (${count})` };
    });
  }

  onStatusDropdownChange(id: string) {
    this.activeStatus = id || 'all';
    this.cdr.detectChanges();
  }

  /** v1.27: 2-letter initials for avatar bubbles (list + card views). */
  initialsFor(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** v1.65eq — most recent outbound brief in a thread. Threads group
      by supplier + category, so a second brief to the same supplier
      lands as another outbound row in the same thread. The items
      panel + reply target should reflect the LATEST brief, not the
      oldest. Falls back to any outbound, then any message, so callers
      never crash on edge data. */
  private latestOutbound(t: VendorThread): ThreadMessage | undefined {
    const msgs = t?.messages || [];
    const outbound = msgs.filter((m: any) => m.direction === 'outbound');
    if (outbound.length) {
      return outbound.reduce((latest, m) => {
        return new Date(m.created_at) > new Date(latest.created_at) ? m : latest;
      });
    }
    return msgs[0];
  }

  // ── v1.65dz (p0015) — viewer-aware divergence helpers ─────────────
  // Each "from" / "lane" / "card-viewer" lookup branches on this.viewer
  // so the same Angular component renders the agency-side view at
  // /messages and the supplier-side view at /inbox without duplication.
  // The shared data shape (VendorThread) doesn't carry an agency-side
  // identity record yet, so the supplier view falls back to the static
  // agencyName field (current org name) — fine for the dev/demo
  // persona model, will need a real cross-org lookup when multi-agency
  // supplier data lands.

  /** Thread row "From" — supplier name in agency view, agency name in
      supplier view (the other party from the viewer's POV). */
  fromNameFor(t: VendorThread): string {
    if (this.viewer === 'supplier') return this.agencyName || 'Agency';
    return t.supplierName;
  }

  /** Thread row logo URL — supplier logo in agency view; no agency
      logo data plumbed yet, so supplier view returns '' and the
      template falls back to initials. */
  fromLogoUrlFor(t: VendorThread): string {
    if (this.viewer === 'supplier') return '';
    return t.supplierLogoUrl;
  }

  /** True when a message originated from the active viewer (the "me"
      side of the conversation). Drives the bubble-lane alignment:
      agency outbound = agent typed it = "me" on right;
      supplier inbound (from agency POV) = supplier replied = "me" on
      right when viewing as supplier. */
  isFromMe(m: ThreadMessage): boolean {
    if (this.viewer === 'supplier') return m.direction !== 'outbound';
    return m.direction === 'outbound';
  }

  /** v1.65fX — best-effort sender name for the bubble avatar +
      tooltip. Falls through:
        1. m.sender_name (set on server when joined to users.name)
        2. supplier_name when the bubble is from the supplier side
        3. agency_name from the active thread
        4. blank — the avatar renders "—" */
  senderName(m: ThreadMessage): string {
    // v1.65g5 — viewer-aware. The previous version keyed off
    // m.direction === 'outbound' as "from us", but direction is
    // ALWAYS stored from the AGENCY's POV (outbound = agency →
    // supplier). For the supplier viewer that means an outbound
    // brief is actually FROM the agency. isFromMe() already has
    // the viewer-aware mapping; reuse it here so the bubble
    // avatar matches the lane side it lives on.
    if (!this.activeThread) return m.sender_name || '';
    if (this.isFromMe(m)) {
      // From us. Persona name first (live, always our display
      // name); then server sender_name; then org name fallback.
      const p = this.personaSvc.active?.name;
      if (p) return p;
      if (m.sender_name) return m.sender_name;
      return this.viewer === 'supplier'
        ? (this.activeThread.supplierName || '')
        : (this.agencyName || '');
    }
    // From the other party. From agency POV that's the supplier;
    // from supplier POV that's the agency. Use the server-joined
    // sender_name when available so we get the actual user (e.g.
    // "Ryan Foster") rather than the org name. v1.65g5 — for the
    // supplier viewer we also prefer the joined agency_name over
    // this.agencyName (which is actually the CURRENT persona's
    // org name and would read "Rocket Food" for the supplier
    // viewer — wrong side).
    if (m.sender_name) return m.sender_name;
    if (this.viewer === 'supplier' && (m as any).agency_name) {
      return (m as any).agency_name;
    }
    return this.fromNameFor(this.activeThread);
  }

  /** v1.65fX — 2-char initials for the avatar circle. Splits on
      whitespace, takes the first char of each of the first two
      tokens; falls back to a single char or "—" if nothing's
      resolvable. */
  senderInitials(m: ThreadMessage): string {
    const name = this.senderName(m).trim();
    if (!name) return '—';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** MessageItemCardComponent's `viewer` input is typed as 'agent' |
      'supplier'. Map our inbox-level 'agency' → 'agent' so the card
      gets the right action-table variant. */
  get itemCardViewer(): 'agent' | 'supplier' {
    return this.viewer === 'supplier' ? 'supplier' : 'agent';
  }

  /** v1.65cr (p0006) — thread subject line. The schema doesn't carry
      a dedicated subject column yet, so we synthesise: if the supplier
      has replied (an inbound message exists), use the latest inbound
      body as a short subject; otherwise fall back to the outbound
      request topic "{Category} brief". Truncated so the row stays
      one line. When proper subject columns land, swap this.
      v1.65cv (p0008) — when messages.subject is set (most outbound
      rows after the requestQuotes rewrite), prefer that. */
  subjectFor(t: VendorThread): string {
    const lead = (t.messages || []).find((m: any) => m.direction === 'outbound');
    const subj = (lead && (lead as any).subject) ? String((lead as any).subject).trim() : '';
    if (subj) {
      // Strip "[REF] " prefix when present — the ref renders as its own
      // chip on the thread card.
      const cleaned = subj.replace(/^\[[A-Z]{2,4}-\d+\]\s*/i, '').trim();
      if (cleaned) return cleaned.length > 80 ? cleaned.slice(0, 77) + '…' : cleaned;
    }
    const inbound = [...(t.messages || [])]
      .reverse()
      .find((m: any) => m.direction === 'inbound');
    const raw = (inbound?.body || t.latestMsg?.body || '').trim();
    if (raw) {
      const first = raw.split(/\r?\n/)[0].trim();
      return first.length > 80 ? first.slice(0, 77) + '…' : first;
    }
    const cat = (t.categoryName || 'Request').trim();
    return cat ? `${cat} brief` : 'New request';
  }

  /** v1.65cv (p0008 §9) — Clock primitive. The thread/item is overdue
      when next_action_by has passed AND we're not in a terminal state.
      Cheap render-time check, no scheduled job. */
  isOverdue(ts: string | null | undefined): boolean {
    if (!ts) return false;
    const t = Date.parse(ts);
    return Number.isFinite(t) && t < Date.now();
  }

  /** v1.65cv (p0008 §8) — Precise date stamp like "Mon 26 May · 14:32".
      Used as a small caption + hover tooltip on the relative time. */
  preciseDate(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} · ${time}`;
  }

  /** v1.65cx (p0011 §3) — short relative form for the header clock
      chip ("Next: Fri 29 May"). Hover surfaces the precise stamp. */
  shortClock(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /** v1.65cr (p0006) — "Go to cart" CTA on the empty state. In project
      mode (boundProjectId set), open the shared Project Items cart
      drawer directly. In global mode (no project bound), route to
      the dashboard so the user can pick a project. */
  openCart(): void {
    if (this.boundProjectId) {
      this.cartDrawerSvc.open(this.boundProjectId);
      return;
    }
    if (this.selectedProjectId) {
      this.cartDrawerSvc.open(this.selectedProjectId);
      return;
    }
    this.router.navigate(['/projects']);
  }

  /** v1.65dw — open the shared EventDrawer for the active thread's
      project. Replaces the inline "Event details" collapsible section
      that used to live in the conversation panel.

      Falls back through activeProject.id → boundProjectId →
      selectedProjectId so the chip works whether the inbox is mounted
      as a project tab or in global mode. */
  openEventDrawerForThread(): void {
    const pid = (this.activeProject as any)?.id
              || this.boundProjectId
              || this.selectedProjectId;
    if (!pid) return;
    this.eventDrawerSvc.open(pid);
  }

  /** v1.65dw → v1.65er — open the shared CartDrawer with the
      thread's full message_items list (NOT filtered through
      project_items). This shows every row the supplier needs to
      action — catalogue matches + ad-hoc asks — with the per-row
      status + price the conversation already loaded. The drawer's
      new `rows` option short-circuits its project_items fetch when
      set. */
  openItemsDrawerForThread(): void {
    const pid = (this.activeProject as any)?.id
              || this.boundProjectId
              || this.selectedProjectId;
    if (!pid) return;
    const rows = (this.threadItems || []).map(it => {
      const base = Number((it as any).price_current ?? it.price ?? 0) || 0;
      const unit = (it.metadata as any)?.unit || (it as any).unit || null;
      return {
        id: it.id,
        item_id: it.item_id || null,
        name: it.name,
        description: it.description || null,
        image_url: (it as any).item_image_url || null,
        base_price: base,
        unit,
        supplier_name: it.supplier_name || null,
        supplier_cover_url: (it as any).supplier_cover_url || null,
        category_icon_color: null,
        line_total: null,            // drawer derives from base × guests
        status: it.status || null,
        isAdhoc: !it.item_id || base === 0,
      };
    });
    this.cartDrawerSvc.open(pid, {
      contextLabel: 'CART',
      contextTitle: 'Cart in this conversation',
      rows,
      // v1.65es — the inbox Cart chip is the supplier's view of the
      // brief. Hides agent-only chrome (WISHLIST, ADDITIONAL ASKS,
      // margin) and surfaces the per-head total + supplier-side CTA.
      // Map inbox viewer ('agency'|'supplier') to cart-drawer viewer
      // ('agent'|'supplier').
      viewer: this.viewer === 'supplier' ? 'supplier' : 'agent',
    });
  }

  /** v1.65g1 — soft-delete every message in a thread. Confirms
      first, then fires DELETE on each m.id in parallel and
      refreshes the inbox so the thread card disappears. */
  deleteThread(t: VendorThread, ev?: Event): void {
    if (ev) ev.stopPropagation();           // don't open the thread
    const count = (t.messages || []).length;
    if (!count) return;
    const ok = window.confirm(
      `Delete this thread? ${count} ${count === 1 ? 'message' : 'messages'} will be removed.`
    );
    if (!ok) return;
    const ids = (t.messages || []).map(m => m.id).filter(Boolean) as string[];
    let pending = ids.length;
    const onDone = () => {
      pending -= 1;
      if (pending > 0) return;
      // All deletes resolved — refresh the inbox + clear the
      // active thread if it was the one we just deleted.
      if (this.activeThread?.key === t.key) this.activeThread = null;
      if (this.boundProjectId) this.load();
      else this.loadAllMessages();
    };
    for (const id of ids) {
      this.msgSvc.delete(id).subscribe({ next: onDone, error: onDone });
    }
  }

  /** v1.65g0 — soft-delete a single conversation bubble. Confirms
      first to avoid stray clicks, then POSTs DELETE /messages/:id.
      Server stamps deleted_at = NOW(); list queries filter it out
      so the bubble vanishes on the next thread refresh. Rebinds
      activeThread by key after the load, same pattern openThread +
      sendBatchReply use. */
  deleteMessage(m: ThreadMessage): void {
    if (!m?.id) return;
    const ok = window.confirm('Delete this message? It will be removed from the conversation.');
    if (!ok) return;
    const activeKey = this.activeThread?.key;
    this.msgSvc.delete(m.id).subscribe({
      next: () => {
        if (this.boundProjectId) this.load();
        else this.loadAllMessages();
        if (activeKey) {
          setTimeout(() => {
            const fresh = this.threads.find(x => x.key === activeKey);
            this.activeThread = fresh || null;
            this.cdr.detectChanges();
          }, 300);
        }
      },
      error: () => {
        this.toast.add({
          severity: 'error',
          summary: 'Could not delete',
          detail: 'Please try again.',
          life: 3000,
        });
      }
    });
  }

  openThread(t: VendorThread) {
    this.activeThread = t;
    this.lastDate = '';
    t.unread = false;
    this.threadItems = [];
    // v1.65fZ — when the user clicks into a thread, refresh the
    // threads list from the server so any replies that landed since
    // the inbox first loaded are visible in the conversation
    // stream. Capture the key, kick the load, re-bind activeThread
    // after the fetch returns — same dance sendBatchReply uses.
    const activeKey = t.key;
    if (this.boundProjectId) this.load();
    else this.loadAllMessages();
    setTimeout(() => {
      const fresh = this.threads.find(x => x.key === activeKey);
      if (fresh) {
        this.activeThread = fresh;
        this.cdr.detectChanges();
      }
    }, 300);
    // v1.65cz (p0013 §1) → v1.65dw — accordion state reset trimmed
    // to just the Conversation header (Event + Items now open in
    // their own shared drawers via the chip bar).
    this.secConvOpen  = true;

    // v1.65cz (p0013 §2) — load the project for the Event card. Skip
    // when we already have the right project loaded.
    // v1.65da (p0013 §2 fix) — client_name isn't on the project row;
    // it lives in the clients table behind project.client_id, mirror
    // the Overview's pattern of loading them separately and patching
    // client_name onto activeProject for the binding.
    const pid = t.projectId;
    if (pid && (!this.activeProject || this.activeProject.id !== pid)) {
      this.activeProject = null;
      this.projectSvc.getById(pid).subscribe({
        next: p => {
          this.activeProject = p as any;
          this.cdr.detectChanges();
          if ((p as any)?.client_id) {
            this.clientSvc.getById((p as any).client_id).subscribe({
              next: c => {
                if (this.activeProject) {
                  this.activeProject = {
                    ...this.activeProject,
                    client_name: (c as any)?.name || (c as any)?.contact_name || null
                  };
                  this.cdr.detectChanges();
                }
              },
              error: () => { /* leave client_name unset; cell shows em-dash */ }
            });
          }
        },
        error: () => { /* leave null; card renders em-dashes */ }
      });
    }

    // v1.65cv (p0008) — load message_items for the lead outbound row
    // in this thread (the one that minted the conversation). Replies
    // share the same items via the message_id linkage.
    // v1.65eq — when a thread carries MULTIPLE outbound briefs (same
    // supplier + same category, different ref_codes), .find() returns
    // the oldest, so item refreshes after a re-send showed stale data.
    // Switched to the LATEST outbound (latestOutbound() helper below)
    // so the items panel reflects the current ask.
    const lead = this.latestOutbound(t);
    if (lead?.id) {
      this.messageItemSvc.getByMessage(lead.id).subscribe({
        next: rows => {
          this.threadItems = rows || [];
          this.cdr.detectChanges();
        },
        error: () => { this.threadItems = []; }
      });
    }
    // Warm the decline-reason codelists once per session. Cache-aware.
    if (!this.declineReasonsPre.length) {
      this.codelistSvc.getByName('decline_reason_pre_agreement').subscribe(rows => {
        this.declineReasonsPre = (rows || []).map((r: any) => ({ code: r.code, label: r.label }));
        this.cdr.markForCheck();
      });
    }
    if (!this.declineReasonsPost.length) {
      this.codelistSvc.getByName('decline_reason_post_agreement').subscribe(rows => {
        this.declineReasonsPost = (rows || []).map((r: any) => ({ code: r.code, label: r.label }));
        this.cdr.markForCheck();
      });
    }
    setTimeout(() => this.scrollBottom(), 50);
  }

  /** v1.65cv (p0008) — pre- vs post-agreement reason list, picked
      from the item's current status. Passed to the item card. */
  declineReasonsFor(item: MessageItemRow): Array<{ code: string; label: string }> {
    return item?.status === 'accepted' || item?.status === 'booked'
      ? this.declineReasonsPost
      : this.declineReasonsPre;
  }

  /** v1.65cv (p0008) — adapt a server message_items row into the
      MessageItem shape the card component expects. price_current
      falls back to the legacy `price` column so pre-p0008 rows still
      render with a number. */
  toMessageItem(r: MessageItemRow): MessageItem {
    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      price_ref:     r.price_ref ?? (r as any).price ?? null,
      price_current: r.price_current ?? (r as any).price ?? null,
      unit: r.unit || null,
      status: r.status,
      next_action_by: r.next_action_by || null,
      decline_reason: r.decline_reason || null,
      decline_note: r.decline_note || null,
    };
  }

  /** Count of items needing the agent's action right now. Drives the
      summary header's "N need action" hint. */
  itemActionCount(): number {
    return (this.threadItems || []).filter(i =>
      i.status === 'quoted' ||
      i.status === 'adjusted_by_supplier' ||
      i.status === 'accepted'
    ).length;
  }

  /** v1.65cy (p0011 §1 fix) — build the interleaved chat-stream
      timeline. Messages + item cards in chronological order. Each
      item card lands at its most recent updated_at (created_at as
      fallback). Cached per thread+items signature to avoid rebuild
      on every change detection cycle. */
  private _timelineCacheKey = '';
  private _timelineCache: Array<{
    type: 'message' | 'item';
    timestamp: string;
    showDate: boolean;
    message?: any;
    item?: MessageItemRow;
  }> = [];
  streamTimeline(): typeof this._timelineCache {
    if (!this.activeThread) return [];
    const msgs = this.activeThread.messages || [];
    const items = this.threadItems || [];
    const key = `${msgs.length}|${msgs.map(m => m.id + ':' + m.created_at).join(',')}|`
              + `${items.length}|${items.map(i => i.id + ':' + (i.updated_at || i.created_at) + ':' + i.status).join(',')}`;
    if (key === this._timelineCacheKey) return this._timelineCache;

    const entries: Array<any> = [];
    for (const m of msgs) {
      entries.push({ type: 'message', timestamp: m.created_at, message: m });
    }
    for (const it of items) {
      const ts = (it as any).updated_at || it.created_at;
      entries.push({ type: 'item', timestamp: ts, item: it });
    }
    entries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Insert date dividers when the day changes.
    let lastDay = '';
    for (const e of entries) {
      const d = new Date(e.timestamp).toDateString();
      e.showDate = d !== lastDay;
      lastDay = d;
    }

    this._timelineCacheKey = key;
    this._timelineCache = entries;
    return entries;
  }

  /** v1.65cy (p0011 fix) — scroll-to-item from the summary header.
      Finds the inline copy in the stream by data-item-id and pulses
      it briefly. */
  scrollToItem(itemId: string): void {
    setTimeout(() => {
      const host = this.messageList?.nativeElement as HTMLElement | undefined;
      if (!host) return;
      const target = host.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('bp-msg-stream-item--pulse');
      setTimeout(() => target.classList.remove('bp-msg-stream-item--pulse'), 1300);
    }, 30);
  }

  /** v1.65cy (p0011 §3) — Computed aggregate thread status for the
      header pill (replaces the per-msg msg_status that used to drive
      it). Maps the same priority table as the server-side
      aggregateStatus(). Returns a semantic key — 'action' / 'waiting'
      / 'quoted' / 'booked' / 'closed' / '' — used to pick the
      bp-badge-* class + label. */
  aggregateStatus(): string {
    const items = this.threadItems || [];
    if (!items.length) return '';
    const has = (code: string) => items.some(i => i.status === code);
    const allTerminal = items.every(i =>
      ['booked', 'declined_by_supplier', 'declined_by_agent'].includes(i.status)
    );
    if (allTerminal) return has('booked') ? 'booked' : 'closed';
    // Agent view priority (the inbox is the agent surface).
    if (has('quoted') || has('adjusted_by_supplier') || has('accepted')) return 'action';
    if (has('brief_sent') || has('holding') || has('adjusted_by_agent')) return 'waiting';
    if (has('quoted')) return 'quoted';
    return 'waiting';
  }
  aggregateStatusLabel(): string {
    const k = this.aggregateStatus();
    const map: Record<string, string> = {
      action: 'Action', waiting: 'Waiting', quoted: 'Quoted',
      booked: 'Booked', closed: 'Closed',
    };
    return map[k] || '';
  }

  /** v1.65cz (p0013 §2) — Event card date display.
      v1.65da fix: projects.event_date is stored as a free-text string
      (AI-parsed values like "25–30 May 2026" or "May Half Term —
      Thursday–Saturday"), NOT an ISO timestamp. So we render the
      raw string verbatim when Date.parse() can't make sense of it.
      When it IS parseable, format with duration_days as a tight range. */
  eventDateRange(): string {
    const p = this.activeProject;
    const raw = (p?.event_date || '').toString().trim();
    if (!raw) return '';
    const start = new Date(raw);
    if (!Number.isFinite(start.getTime())) {
      // Free-text / range — show as-is. The Event drawer renders it
      // the same way.
      return raw;
    }
    const days = +p?.duration_days || 1;
    if (days <= 1) {
      return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const end = new Date(start);
    end.setDate(end.getDate() + (days - 1));
    const sameMonth  = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const sameYear   = start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.getDate()}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (sameYear) {
      return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  eventDurationLabel(): string {
    const d = +this.activeProject?.duration_days || 0;
    if (d <= 1) return '';
    return `${d} days`;
  }

  /** v1.65cz (p0013 §3) — active items only (declined / cancelled
      stripped) for the Items section header count. */
  activeItemsCount(): number {
    return (this.threadItems || []).filter(i =>
      i.status !== 'declined_by_supplier' && i.status !== 'declined_by_agent'
    ).length;
  }
  /** Message count badge for the Conversation section header. */
  conversationCount(): number {
    return (this.activeThread?.messages || []).length;
  }

  /** v1.65de (p0013 §4) — derive the stream lane for an item card.
      Agent acts → 'out' (right). Supplier acts → 'in' (left). Default
      is 'out' for the agent's view (the brief was sent by the agent). */
  itemLane(it: MessageItemRow): 'out' | 'in' {
    const supplierStates = ['brief_sent', 'adjusted_by_agent']; // ball is in supplier's court → last meaningful actor was the agent
    const agentStates    = ['quoted', 'holding', 'adjusted_by_supplier', 'declined_by_supplier']; // last actor = supplier
    if (it.adjusted_by === 'supplier') return 'in';
    if (it.adjusted_by === 'agent')    return 'out';
    if (agentStates.includes(it.status))    return 'in';
    if (supplierStates.includes(it.status)) return 'out';
    return 'out';
  }

  /** v1.65de — the caption text under an inline item card (the note
      attached to its most recent action). Stub until we wire the
      events fetch; reads decline_note when present (the only
      per-item note field on the message_items row today). */
  itemCaption(it: MessageItemRow): string {
    return it.decline_note || '';
  }

  /** v1.65de — resolve a tagged_item_id from a message row to the
      item's name, for the ↳ breadcrumb on free-typed bubbles. */
  taggedItemName(itemId: string | null | undefined): string {
    if (!itemId) return '';
    const it = (this.threadItems || []).find(i => i.id === itemId);
    return it?.name || '';
  }

  /** v1.65db (p0013 header refit) — subject from the lead outbound
      message (the brief itself). Falls back to the latest message's
      subject, then a synthesised "{REF} — Brief: {Category}". */
  threadSubject(): string {
    const t = this.activeThread;
    if (!t) return '';
    const lead = (t.messages || []).find((m: any) => m.direction === 'outbound');
    const subj = (lead && (lead as any).subject) ? String((lead as any).subject).trim()
               : ((t.latestMsg as any)?.subject ? String((t.latestMsg as any).subject).trim() : '');
    if (subj) return subj;
    const ref = t.refCode ? `${t.refCode} — ` : '';
    const cat = t.categoryName || 'Brief';
    return `${ref}Brief: ${cat}`;
  }

  /** First message timestamp (the moment the conversation opened). */
  firstMessageAt(): string | null {
    const msgs = this.activeThread?.messages || [];
    if (!msgs.length) return null;
    return msgs.reduce((acc: string, m: any) =>
      !acc || m.created_at < acc ? m.created_at : acc, '');
  }
  /** Last message timestamp. */
  lastMessageAt(): string | null {
    const msgs = this.activeThread?.messages || [];
    if (!msgs.length) return null;
    return msgs.reduce((acc: string, m: any) =>
      !acc || m.created_at > acc ? m.created_at : acc, '');
  }

  /** v1.65dd (p0013 header refit) — CC line: the other suppliers in
      the same outreach batch (same project + ref_code, different
      supplier). Returns a comma-separated list of supplier names; ''
      when there are none. requestQuotes sends one message per
      supplier in the batch, all sharing the ref_code, so the other
      threads in this.threads with the same ref are the CC. */
  ccSuppliers(): string {
    const t = this.activeThread;
    if (!t || !t.refCode) return '';
    const others = (this.threads || []).filter(other =>
      other !== t &&
      other.refCode === t.refCode &&
      other.projectId === t.projectId &&
      other.supplierId !== t.supplierId &&
      other.supplierName
    );
    if (!others.length) return '';
    // De-dupe in case the same supplier shows up across multiple
    // threads (different category outreach within the same ref).
    const seen = new Set<string>();
    const names: string[] = [];
    for (const o of others) {
      if (!seen.has(o.supplierName)) { seen.add(o.supplierName); names.push(o.supplierName); }
    }
    return names.join(', ');
  }

  /** v1.65cv (p0008) — agent acts on a message_item from the inbox
      conversation panel. Forwards to the reply endpoint with a
      single item_action; refreshes the thread items on success.
      v1.65ed (p0015) — viewer-aware: passes viewer in the payload
      so the server can branch action mapping + actor.type. Supplier
      view (Ryan) records actions as supplier-side transitions
      (declined_by_supplier, adjusted_by_supplier, etc) and writes
      an inbound direction reply row. */
  /** v1.65ev — batched supplier reply. Builds ONE /messages/:id/reply
      payload with every queued item_action + the wrap-up body. The
      server's existing per-item processing handles each action
      atomically (transitionItem + maybeForkCatalogueItem on
      adjust). One inbound message row gets created carrying the
      summary text — much cleaner than N per-row replies. */
  sendBatchReply(rowActions: Array<{ rowId: string; action: string; reason_code?: string; note?: string; name?: string; description?: string; price?: number; unit?: string; image_url?: string }>, body: string): void {
    if (!this.activeThread) return;
    const lead = this.latestOutbound(this.activeThread);
    if (!lead?.id) return;
    if (!rowActions.length && !body.trim()) return;

    const item_actions = rowActions.map(a => ({
      message_item_id: a.rowId,
      action: a.action,
      reason_code: a.reason_code,
      note: a.note,
      name: a.name,
      description: a.description,
      price: a.price,
      unit: a.unit,
      image_url: a.image_url,
    }));

    // v1.65fU — capture the active thread key BEFORE the load() call
    // refetches threads. After load lands the threads list rebuilds
    // and activeThread becomes stale (its .messages array is the old
    // one — missing the just-sent reply). Re-find by key on the
    // refreshed list so the conversation stream picks up the new
    // bubble without a manual refresh.
    const activeKey = this.activeThread?.key;
    this.messageItemSvc.agentReply(lead.id, {
      viewer: this.viewer,
      user_id: this.personaSvc.active?.userId,
      text: body || undefined,
      item_actions,
    } as any).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'Reply sent',
          detail: `${item_actions.length} ${item_actions.length === 1 ? 'item' : 'items'} updated`,
          life: 2000
        });
        // Refresh the items + thread so the new state shows up.
        this.messageItemSvc.getByMessage(lead.id).subscribe(rows => {
          this.threadItems = rows || [];
          this.cdr.detectChanges();
        });
        if (this.boundProjectId) this.load();
        else this.loadAllMessages();
        // v1.65fU — rebind the active thread to the refreshed
        // threads list so the new bubble shows without F5.
        if (activeKey) {
          setTimeout(() => {
            this.activeThread = this.threads.find(t => t.key === activeKey) || null;
            this.cdr.detectChanges();
          }, 300);
        }
      },
      error: () => {
        this.toast.add({
          severity: 'error',
          summary: 'Could not send reply',
          detail: 'Please try again in a moment.',
          life: 3000
        });
      }
    });
  }

  onItemAction(item: MessageItemRow, evt: { action: string; reason_code?: string; note?: string; name?: string; description?: string; price?: number; unit?: string; image_url?: string }) {
    if (!this.activeThread) return;
    // v1.65eq — use the latest outbound brief in the thread as the
    // reply target (matches the items panel load path).
    const lead = this.latestOutbound(this.activeThread);
    if (!lead?.id) return;
    this.messageItemSvc.agentReply(lead.id, {
      viewer: this.viewer,
      user_id: this.personaSvc.active?.userId,
      item_actions: [{
        message_item_id: item.id,
        action: evt.action as any,
        reason_code: evt.reason_code,
        note: evt.note,
        name: evt.name,
        description: evt.description,
        price: evt.price,
        unit: evt.unit,
        // v1.65et — image URL only meaningful on adjust/quote.
        // Server uses it to seed the forked items.image_url.
        image_url: evt.image_url,
      }],
    } as any).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: `${evt.action} saved`, life: 1500 });
        // Refresh the items + the thread messages so the new reply shows.
        this.messageItemSvc.getByMessage(lead.id).subscribe(rows => {
          this.threadItems = rows || [];
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Update failed', life: 3000 });
      }
    });
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
    if (!this.activeThread) return;
    const body = (this.newMsg || '').trim();
    if (!body && !this.composeNextActionBy && !this.composeTaggedItemId) return;
    this.sending = true;
    const pid = this.boundProjectId || this.activeThread.projectId;
    const payload: any = {
      project_id: pid,
      body, direction: 'outbound', subject: 'Re: ' + (this.activeThread.refCode ? '['+this.activeThread.refCode+'] ' : '') + (this.activeThread.categoryName || ''),
      category_id: this.activeThread.categoryId,
      supplier_org_id: this.activeThread.supplierId,
    };
    // v1.65de (p0013 §5) — attach tagged_item_id + next_action_by
    // when set, so the bubble lands with the ↳ breadcrumb + drives
    // the clock chip.
    if (this.composeTaggedItemId) payload.tagged_item_id = this.composeTaggedItemId;
    if (this.composeNextActionBy) payload.next_action_by = this.composeNextActionBy;
    this.msgSvc.create(payload).subscribe({
      next: () => {
        this.newMsg = '';
        this.composeNoteOpen = false;
        this.composeTaggedItemId = null;
        this.composeNextActionBy = null;
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

  // ── v1.65de (p0013 §5) — Compose chip strip ──────────────────────

  /** Loads quick_reply_templates filtered for agent → supplier
      direction. Each row's meta has { direction, body }. */
  private loadComposeChips(): void {
    if (this.composeChips.length) return; // load once per session
    this.codelistSvc.getByName('quick_reply_templates').subscribe({
      next: rows => {
        this.composeChips = (rows || [])
          .filter((r: any) => (r.meta?.direction || '').startsWith('agent_to_supplier'))
          .map((r: any) => ({
            code: r.code, label: r.label,
            body: r.meta?.body || r.label,
            preview: r.meta?.body || r.label,
          }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  /** Tap a chip. If body has no placeholders → send immediately.
      Otherwise open the inline placeholder picker for the first one. */
  onChipClick(chip: { code: string; label: string; body: string }): void {
    const placeholders = [...chip.body.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    // Special-case {next_action_by} — interpolate from composeNextActionBy
    // when set; otherwise the friendly placeholder "shortly".
    const resolved = chip.body.replace(/\{next_action_by\}/g, () =>
      this.composeNextActionBy ? this.shortClock(this.composeNextActionBy) : 'shortly'
    );
    const remaining = [...resolved.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    if (!remaining.length) {
      this.newMsg = resolved;
      this.send();
      return;
    }
    // Open the picker on the first remaining placeholder.
    const key = remaining[0];
    this.composePlaceholder = {
      key, label: key.replace(/_/g, ' '),
      hint: `Type ${key}…`, value: '', chipBody: resolved
    };
    this.cdr.markForCheck();
  }

  confirmPlaceholder(): void {
    if (!this.composePlaceholder) return;
    const ph = this.composePlaceholder;
    if (!ph.value?.trim()) return;
    const re = new RegExp(`\\{${ph.key}\\}`, 'g');
    this.newMsg = ph.chipBody.replace(re, ph.value.trim());
    this.composePlaceholder = null;
    this.send();
  }
  cancelPlaceholder(): void {
    this.composePlaceholder = null;
    this.cdr.markForCheck();
  }

  openNote(): void {
    this.composeNoteOpen = true;
    this.itemTagPickerOpen = false;
    this.clockPickerOpen = false;
    // Cold vs warm template prefill — only when the textarea is
    // empty (don't stomp an in-progress draft).
    if (!this.newMsg?.trim()) {
      const supplierId = this.activeThread?.supplierId || '';
      const warm = this.supplierAlreadyContacted.has(supplierId);
      const supFirst = (this.activeThread?.supplierName || 'there').split(/\s+/)[0];
      const me = (this.agencyName || '').split(/\s+/)[0] || 'we';
      const proj = this.activeThread?.projectName || 'this project';
      this.composeNoteHint = warm
        ? `hey ${supFirst}, ${me} again, details attached, let me know`
        : `hi ${supFirst} — ${me} putting together ${proj} and would love to include you. details attached.`;
    } else {
      this.composeNoteHint = 'Type a note…';
    }
    this.cdr.markForCheck();
  }
  closeNote(): void {
    this.composeNoteOpen = false;
    this.cdr.markForCheck();
  }
  onNoteEnter(ev: Event): void {
    const ke = ev as KeyboardEvent;
    if (!ke.shiftKey) {
      ev.preventDefault();
      this.send();
    }
  }

  // Item-tag picker
  toggleItemTagPicker(): void {
    this.itemTagPickerOpen = !this.itemTagPickerOpen;
    this.clockPickerOpen = false;
    this.cdr.markForCheck();
  }
  pickTaggedItem(id: string | null): void {
    this.composeTaggedItemId = id;
    this.itemTagPickerOpen = false;
    this.cdr.markForCheck();
  }
  composeTaggedItemName(): string {
    if (!this.composeTaggedItemId) return '';
    return this.taggedItemName(this.composeTaggedItemId);
  }

  // Clock picker
  toggleClockPicker(): void {
    this.clockPickerOpen = !this.clockPickerOpen;
    this.itemTagPickerOpen = false;
    if (this.clockPickerOpen) {
      // Seed datetime-local with the current value or "now + 24h".
      const d = this.composeNextActionBy ? new Date(this.composeNextActionBy)
                                         : new Date(Date.now() + 24 * 3600 * 1000);
      this.clockDraft = this.toLocalInputValue(d);
    }
    this.cdr.markForCheck();
  }
  setClock(iso: string | null): void {
    this.composeNextActionBy = iso;
    this.clockPickerOpen = false;
    this.cdr.markForCheck();
  }
  clockDraftIso(): string {
    if (!this.clockDraft) return '';
    return new Date(this.clockDraft).toISOString();
  }
  offsetHours(h: number): string {
    const d = new Date(); d.setHours(d.getHours() + h); return d.toISOString();
  }
  offsetTomorrow9(): string {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString();
  }
  offsetFriday(): string {
    const d = new Date();
    const diff = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d.toISOString();
  }
  offsetWeek(): string {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.toISOString();
  }
  private toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
