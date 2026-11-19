// pV2-SOW-01 (Phase 2) — the SOW at the top of a per-supplier inbox thread.
// Rendered as section cards with pink pill headers: Timeline and Fees & Payment
// show as clean read-only TABLES (edited in a dialog via the pencil); Services &
// Goods is a row list with per-row pencil/N/A. Boilerplate hidden. Content
// pre-filled from the project + the supplier's items. Author (supplier) edits
// while draft; the agency signs first, the supplier counter-signs.
// Edits use a local working copy (edited); save() PATCHes on change.

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { SowService } from '../../core/sow/sow.service';
import { Sow, SowComment, SowContent, SowNode, SowNodeType, SowParties, SowPaymentRow, SowPrefill, SowProductionItem, SowReviewAction, SowSuggestions, SowTimelineEntry } from '../../core/sow/sow.types';
import { InboxThread, InboxProjectSummary } from '../../core/inbox/inbox.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { errorDetail } from '../../core/http-error';
import { CodelistService } from '../../core/codelists/codelist.service';
import { unitTypeLabel } from '../../shared/unit-display';
import { natoDate } from '../../shared/details-format';
import { PdfPagesComponent } from '../../shared/pdf-pages.component';

@Component({
  selector: 'app-sow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, FormsModule, LucideAngularModule, ModalComponent, StatusPillComponent, MarkdownPipe, PdfPagesComponent],
  template: `
    <div class="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface">
    <!-- Header bar (matches the inbox item header): title + status · actions. -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
      <div class="flex items-center gap-2.5">
        <h3 class="bp-card-title">Contract</h3>
        @if (current(); as s) { <app-status-pill list="sow_status" [code]="s.status" /> }
      </div>
      <div class="flex items-center gap-2">
        @if (canCreate()) { <button type="button" class="bp-act bp-act--sm bp-act--primary" [disabled]="busy()" (click)="create()">{{ busy() ? 'Creating…' : 'Create SOW' }}</button> }
        @if (editable()) { <button type="button" class="bp-act bp-act--sm bp-act--outline" [title]="customize() ? 'Back to the review view' : 'Edit the full document'" (click)="customize.set(!customize())">{{ customize() ? 'Done' : 'Customize' }}</button> }
        @if (canSend()) { <button type="button" class="bp-act bp-act--sm bp-act--primary" [disabled]="busy()" title="Send to the agent for review" (click)="doReview('send')">{{ busy() ? 'Sending…' : 'Send for review' }}</button> }
        @if (canRevise()) { <button type="button" class="bp-act bp-act--sm bp-act--outline" [disabled]="busy()" title="Pull back to draft to revise" (click)="doReview('revise')">Revise</button> }
        @if (canMarkReviewed()) { <button type="button" class="bp-act bp-act--sm bp-act--outline" [disabled]="busy()" title="Mark the review complete" (click)="doReview('review')"><lucide-icon name="check-check" [size]="14" /> Reviewed</button> }
        @if (canRespond()) {
          <button type="button" class="bp-act bp-act--sm bp-act--green" [disabled]="busy()" (click)="doReview('accept')"><lucide-icon name="check" [size]="14" /> Approve</button>
          <button type="button" class="bp-act bp-act--sm bp-act--red" [disabled]="busy()" (click)="doReview('decline')"><lucide-icon name="octagon-x" [size]="14" /> Reject</button>
        }
        @if (canCoApprove()) { <button type="button" class="bp-act bp-act--sm bp-act--green" [disabled]="busy()" title="Give your final approval" (click)="doReview('co_approve')"><lucide-icon name="check" [size]="14" /> Approve</button> }
        @if (current()) {
          <div class="relative flex items-center">
            <button type="button" class="bp-itemprev-close shrink-0" title="More" aria-label="More" (click)="menuOpen.set(!menuOpen())"><lucide-icon name="ellipsis-vertical" [size]="18" /></button>
            @if (menuOpen()) {
              <div class="fixed inset-0 z-20" (click)="menuOpen.set(false)"></div>
              <div class="absolute right-0 top-full z-30 mt-1 min-w-[12rem] overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface py-1 shadow-[var(--shadow-md)]">
                @if (editable()) { <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left bp-body-small hover:bg-fill" (click)="openSuggest(); menuOpen.set(false)"><lucide-icon name="sparkles" [size]="15" /> Suggest from conversation</button> }
                <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left bp-body-small hover:bg-fill" [disabled]="pdfBusy()" (click)="downloadPdf(); menuOpen.set(false)"><lucide-icon name="file-text" [size]="15" /> {{ pdfBusy() ? 'Generating…' : 'Create PDF' }}</button>
                <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left bp-body-small hover:bg-fill" (click)="viewAll.set(!viewAll()); menuOpen.set(false)"><lucide-icon [name]="viewAll() ? 'list' : 'list-tree'" [size]="15" /> {{ viewAll() ? 'Review view' : 'View all' }}</button>
                <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left bp-body-small hover:bg-fill" (click)="historyOpen.set(true); menuOpen.set(false)"><lucide-icon name="clock" [size]="15" /> History</button>
                <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left bp-body-small hover:bg-fill" (click)="headerFooterOpen.set(true); menuOpen.set(false)"><lucide-icon name="panel-top" [size]="15" /> Header &amp; footer</button>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (sowsRes.isLoading()) { <p class="bp-body-small text-secondary px-5 py-4">Loading…</p> }

    @if (current(); as s) {
      <!-- Document body — centered page to match the PDF layout. -->
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-8">

        <!-- Document title + subtitle — centered like the PDF banner; editable by
             the author (stored on the content, so it persists + flows to the PDF). -->
        <div class="group/head mb-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <div class="bp-card-title !text-[length:var(--text-2xl)] tracking-wide">{{ docTitle() }}</div>
            @if (editable()) { <button type="button" class="bp-sow-ibtn opacity-0 transition-opacity group-hover/head:opacity-100" title="Edit title" (click)="openEditBlock('doc:title', 'Document title', docTitle())"><lucide-icon name="pencil" [size]="14" /></button> }
          </div>
          <div class="mt-1 flex items-center justify-center gap-2">
            <div class="bp-caption text-muted">{{ docSubtitle() }}</div>
            @if (editable()) { <button type="button" class="bp-sow-ibtn opacity-0 transition-opacity group-hover/head:opacity-100" title="Edit subtitle" (click)="openEditBlock('doc:subtitle', 'Document subtitle', docSubtitle())"><lucide-icon name="pencil" [size]="13" /></button> }
          </div>
        </div>

        <!-- The document tree — each top-level node drawn by the recursive
             nodeTpl (defined below). Numbering + nesting come from the tree. -->
        @if (customize()) {
          @for (sec of sections(); track $index; let si = $index) {
            <ng-container *ngTemplateOutlet="nodeTpl; context: { node: sec, num: '' + (si + 1), path: [si], depth: 0 }" />
          }
        } @else {
          @for (sec of sections(); track $index; let si = $index) {
            @if (readShowSection(sec)) {
              <ng-container *ngTemplateOutlet="readTpl; context: { node: sec, top: true, path: [si] } " />
            }
          }
        }

        <!-- ── recursive node renderer ──────────────────────────────────────── -->
        <ng-template #nodeTpl let-n="node" let-num="num" let-path="path" let-depth="depth">
          @if (depth === 0) {
            <div class="bp-card group/sec">
              <div class="bp-sow-head">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <!-- Appendices is an un-numbered section (its items are lettered A, B…). -->
                  @if (n.type !== 'appendix') { <span class="bp-card-title whitespace-nowrap">Section {{ num }} ·</span> }
                  @if (editable()) {
                    <input class="bp-sow-title flex-1" [ngModel]="n.title" (ngModelChange)="mutNodeTitle(path, $event)" (change)="save()" placeholder="Section title" />
                  } @else { <span class="bp-card-title">{{ n.title }}</span> }
                </div>
                @if (editable()) {
                  <!-- TESTING: controls always visible at every level (pare back to
                       hover-reveal / per-level rules for v1). Signature is uniform now
                       too — its body (the sign block) renders via bodyTpl. -->
                  <div class="flex shrink-0 items-center gap-2">
                    <label class="bp-caption flex items-center gap-1"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!n.na" (change)="mutNodeNa(path, $any($event.target).checked)" /> N/A</label>
                    @if (!n.na) {
                      <button type="button" class="bp-sow-ibtn" title="Edit section text" (click)="openEditNode(path)"><lucide-icon name="pencil" [size]="15" /></button>
                      <button type="button" class="bp-sow-icon" title="Add subsection" (click)="addChild(path)"><lucide-icon name="circle-plus" [size]="18" /></button>
                    }
                    <button type="button" class="bp-sow-ibtn" title="Remove section" (click)="removeNode(path)"><lucide-icon name="trash-2" [size]="14" /></button>
                  </div>
                }
              </div>
              @if (n.na) {
                <div class="p-4 pt-3 bp-body-small text-muted italic">N/A</div>
              } @else {
                <div class="p-4 pt-3 flex flex-col gap-3">
                  @if (n.text) { <div class="bp-md bp-body-small text-secondary whitespace-pre-line" [innerHTML]="n.text | md"></div> }
                  <ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, num: num }" />
                  @for (ch of n.children; track $index; let ci = $index) {
                    <div class="pl-3 border-l border-hairline">
                      <ng-container *ngTemplateOutlet="nodeTpl; context: { node: ch, num: num + '.' + (ci + 1), path: path.concat(ci), depth: 1 }" />
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- Nested node (subsection, sub-subsection, …) — heading + body + deeper children. -->
            <div class="group/sub">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-baseline gap-2 min-w-0 flex-1">
                  <span class="bp-card-title whitespace-nowrap">{{ num }}</span>
                  @if (editable()) {
                    <input class="bp-sow-title flex-1" [ngModel]="n.title" (ngModelChange)="mutNodeTitle(path, $event)" (change)="save()" placeholder="Title" />
                  } @else { <span class="bp-card-title">{{ n.title }}</span> }
                </div>
                @if (editable()) {
                  <div class="flex shrink-0 items-center gap-2">
                    <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!n.na" (change)="mutNodeNa(path, $any($event.target).checked)" /> N/A</label>
                    @if (!n.na) {
                      <button type="button" class="bp-sow-ibtn" title="Edit text" (click)="openEditNode(path)"><lucide-icon name="pencil" [size]="15" /></button>
                      <button type="button" class="bp-sow-ibtn" title="Add sub-section" (click)="addChild(path)"><lucide-icon name="circle-plus" [size]="16" /></button>
                    }
                    <button type="button" class="bp-sow-ibtn" title="Remove" (click)="removeNode(path)"><lucide-icon name="trash-2" [size]="14" /></button>
                  </div>
                }
              </div>
              @if (n.na) { <div class="bp-caption text-muted italic mt-1">N/A</div> }
              @else {
                @if (n.text) { <div class="bp-md bp-body-small text-secondary mt-1" [innerHTML]="n.text | md"></div> }
                <ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, num: num }" />
                @for (ch of n.children; track $index; let ci = $index) {
                  <div class="mt-2 pl-3 border-l border-hairline">
                    <ng-container *ngTemplateOutlet="nodeTpl; context: { node: ch, num: num + '.' + (ci + 1), path: path.concat(ci), depth: depth + 1 }" />
                  </div>
                }
              }
            </div>
          }
        </ng-template>

        <!-- ── read view: a quiet outline — heading + tick/N-A + pencil; tables
             (timeline/production/payment) render in full; appendix is a link ── -->
        <ng-template #readTpl let-n="node" let-top="top" let-path="path">
          <div class="group/row">
            <div class="group/head flex items-center justify-between gap-2 py-1 {{ top ? 'mb-1.5 border-b border-hairline pb-1.5' : (path.length <= 2 ? 'mt-4' : 'mt-2') }}">
              <div class="flex items-baseline gap-2 min-w-0 flex-1">
                <span class="{{ top ? 'bp-card-title !text-[length:var(--text-2xl)] !font-semibold' : (path.length <= 2 ? 'bp-body-small !text-[length:var(--text-md)] !font-semibold text-text' : 'bp-body-small !font-semibold text-text') }} truncate">{{ n.title }}</span>
                @if (!editable()) {
                  <!-- Add a comment: hover-revealed, sits by the heading. -->
                  <button type="button" class="bp-sow-ibtn shrink-0 self-center text-muted opacity-0 transition-opacity group-hover/head:opacity-100" title="Add a comment" (click)="openEditNode(path)"><lucide-icon name="message-circle-plus" [size]="15" /></button>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                @if (editable()) {
                  <!-- Supplier draft: edit prose rows incl. top-level sections (tables/groups
                       are edited in their own body). N/A toggle on subsections only. -->
                  @if (!readTable(n) && !readGrouped(n)) {
                    @if (!n.na) { <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditNode(path)"><lucide-icon name="pencil" [size]="14" /></button> }
                    @if (!top) { <label class="bp-caption flex items-center gap-1 text-muted"><input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="!!n.na" (change)="mutNodeNa(path, $any($event.target).checked)" /> N/A</label> }
                  }
                }
                <!-- Existing comment thread — shown in read AND revise, so an author
                     addressing review feedback can see & open the thread (Liam 2026-11-19). -->
                @if (anchorCount(n.id); as cnt) {
                  <button type="button" class="bp-sow-ibtn relative text-[var(--theme-accent)]" title="View comments" (click)="openEditNode(path)">
                    <lucide-icon name="message-square" [size]="14" />
                                      </button>
                }
              </div>
            </div>
            @if (!n.na) {
              <!-- Read view: show the section's prose inline for BOTH sides (the author
                   sees what they wrote; they edit via the pencil / Customize). -->
              @if (n.text && !readTable(n) && !readGrouped(n)) {
                <div class="bp-md bp-body-small mb-2 whitespace-pre-line text-secondary" [innerHTML]="n.text | md"></div>
              }
              @switch (n.type) {
                @case ('timeline') { <div class="mb-3"><ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, read: true }" /></div> }
                @case ('production') { <div class="mb-3"><ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, read: true }" /></div> }
                @case ('payment') { <div class="mb-3"><ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, read: true }" /></div> }
                @case ('deliverables') {
                  @for (b of productionBlocks(); track b.key) {
                    <div class="group/head pl-3 flex items-center justify-between gap-2 py-1 mt-2">
                      <div class="flex items-baseline gap-2 min-w-0 flex-1">
                        <span class="bp-body-small !font-semibold text-text truncate">{{ b.title }}</span>
                        @if (!editable()) {
                          <button type="button" class="bp-sow-ibtn shrink-0 self-center text-muted opacity-0 transition-opacity group-hover/head:opacity-100" title="Add a comment" (click)="openEditBlock(b.key, b.title, b.body)"><lucide-icon name="message-circle-plus" [size]="15" /></button>
                        }
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        @if (editable()) {
                          <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditBlock(b.key, b.title, b.body)"><lucide-icon name="pencil" [size]="14" /></button>
                        }
                        @if (anchorCount(b.key); as cnt) {
                          <button type="button" class="bp-sow-ibtn relative text-[var(--theme-accent)]" title="View comments" (click)="openEditBlock(b.key, b.title, b.body)">
                            <lucide-icon name="message-square" [size]="14" />
                                                      </button>
                        }
                      </div>
                    </div>
                    @if (b.body) {
                      <div class="bp-md bp-body-small mb-2 pl-3 whitespace-pre-line text-secondary" [innerHTML]="b.body | md"></div>
                    }
                  }
                }
                @case ('services') {
                  @for (b of servicesBlocks(); track b.key) {
                    <div class="group/head pl-3 flex items-center justify-between gap-2 py-1 mt-2">
                      <div class="flex items-baseline gap-2 min-w-0 flex-1">
                        <span class="bp-body-small !font-semibold text-text truncate">{{ b.title }}</span>
                        @if (!editable()) {
                          <button type="button" class="bp-sow-ibtn shrink-0 self-center text-muted opacity-0 transition-opacity group-hover/head:opacity-100" title="Add a comment" (click)="openEditBlock(b.key, b.title, b.body)"><lucide-icon name="message-circle-plus" [size]="15" /></button>
                        }
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        @if (editable()) {
                          <button type="button" class="bp-sow-ibtn" title="Edit" (click)="openEditBlock(b.key, b.title, b.body)"><lucide-icon name="pencil" [size]="14" /></button>
                        }
                        @if (anchorCount(b.key); as cnt) {
                          <button type="button" class="bp-sow-ibtn relative text-[var(--theme-accent)]" title="View comments" (click)="openEditBlock(b.key, b.title, b.body)">
                            <lucide-icon name="message-square" [size]="14" />
                                                      </button>
                        }
                      </div>
                    </div>
                    @if (b.body) {
                      <div class="bp-md bp-body-small mb-2 pl-3 whitespace-pre-line text-secondary" [innerHTML]="b.body | md"></div>
                    }
                  }
                }
                @case ('signature') { <ng-container *ngTemplateOutlet="bodyTpl; context: { node: n, read: true }" /> }
                @case ('termsPdf') {
                  @if (termsPdfUrl(); as u) { <a [href]="u" target="_blank" rel="noopener" class="bp-body-small text-[var(--theme-accent)] underline underline-offset-2">View T&amp;C PDF</a> }
                  @else { <span class="bp-caption text-muted italic">No standard terms uploaded.</span> }
                }
              }
            } @else if (!editable()) {
              <!-- N/A section: the content simply reads N/A. -->
              <div class="bp-md bp-body-small mb-2 italic text-muted">N/A</div>
            }
            @for (ch of n.children; track $index; let ci = $index) {
              @if (readShouldRender(ch)) {
                <div class="pl-3">
                  <ng-container *ngTemplateOutlet="readTpl; context: { node: ch, path: (path ?? []).concat(ci) }" />
                </div>
              }
            }
          </div>
        </ng-template>

        <!-- ── node body: its bound table / derived blocks / appendix file ───── -->
        <ng-template #bodyTpl let-n="node" let-num="num" let-read="read">
                      @switch (n.type) {
                        @case ('signature') {
                          <!-- Signature body — the live sign block (its intro is the
                               conclusion boilerplate; the node's own text renders above). -->
                          <p class="bp-body-small text-secondary whitespace-pre-line mt-1">{{ bp('conclusion') }}</p>
                          <div class="mt-3 flex flex-wrap items-end gap-8 bp-body-small">
                            <div><div class="bp-caption text-muted">Agency</div><div class="font-semibold">{{ s.status === 'agent_approved' || s.status === 'accepted' ? 'Approved' : 'Awaiting approval' }}</div></div>
                            <div><div class="bp-caption text-muted">Supplier</div><div class="font-semibold">{{ s.status === 'accepted' ? 'Approved' : 'Awaiting approval' }}</div></div>
                          </div>
                        }
                        @case ('appendix') {
                          <!-- Appendices container: its appendix ITEMS are its child nodes
                               (rendered + editable via nodeTpl), so there's no body here. -->
                        }
                        @case ('termsPdf') {
                          <!-- Terms & Conditions appendix item — the supplier's standard T&C
                               PDF (terms_pdf_url) embedded inline via app-pdf-pages so it prints
                               as part of the document ("merge"). -->
                          @if (termsPdfUrl(); as termsUrl) {
                            <app-pdf-pages class="mt-2 block" [url]="termsUrl" />
                          } @else {
                            <div class="bp-caption text-muted italic mt-1">No standard terms uploaded in the supplier profile.</div>
                          }
                        }
                        @case ('parties') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Party</span><span class="bp-table-column-header">Details</span>
                            </div>
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline px-3 py-1.5 bp-body-small">
                              <span class="font-semibold">Agency (Buyer)</span>
                              @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('agency')" (ngModelChange)="mutParty('agency',$event)" (change)="save()" /> } @else { <span>{{ partyValue('agency') }}</span> }
                            </div>
                            <div class="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-x-4 px-3 py-1.5 bp-body-small">
                              <span class="font-semibold">Supplier</span>
                              @if (editable()) { <input class="bp-sow-cell" [ngModel]="partyValue('supplier')" (ngModelChange)="mutParty('supplier',$event)" (change)="save()" /> } @else { <span>{{ partyValue('supplier') }}</span> }
                            </div>
                          </div>
                        }
                        @case ('projectDetails') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Field</span><span class="bp-table-column-header">Value</span>
                            </div>
                            @for (row of projectDetailRows(); track row.label) {
                              <div class="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-x-4 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                                <span class="font-semibold">{{ row.label }}</span>
                                @if (editable()) { <input class="bp-sow-cell" [ngModel]="row.value" (ngModelChange)="mutDetail(row.label,$event)" (change)="save()" /> } @else { <span>{{ row.value || '—' }}</span> }
                              </div>
                            }
                          </div>
                        }
                        @case ('timeline') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[150px_100px_100px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Date</span><span class="bp-table-column-header">To</span><span class="bp-table-column-header">From</span><span class="bp-table-column-header">Details</span>
                              @if (editable()) { <button type="button" class="bp-sow-icon justify-self-end" title="Add date" (click)="addTimeline()"><lucide-icon name="circle-plus" [size]="18" /></button> }
                            </div>
                            @for (e of timeline(); track $index) {
                              <div class="grid grid-cols-[150px_100px_100px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline last:border-0 px-3 py-1 bp-body-small">
                                @if (editable()) {
                                  <div class="relative">
                                    <input type="text" class="bp-sow-cell pr-5" placeholder="DD-Mon-YYYY" [ngModel]="e.date" (ngModelChange)="mutTimeline($index,'date',$event)" (change)="save()" />
                                    <span class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted"><lucide-icon name="calendar" [size]="13" /></span>
                                    <input type="date" aria-label="Pick date" class="absolute right-0 top-0 h-full w-5 cursor-pointer opacity-0" (change)="onTimelinePick($index, $any($event.target).value)" />
                                  </div>
                                  <input type="time" step="1800" class="bp-sow-cell" [ngModel]="e.to" (ngModelChange)="mutTimeline($index,'to',$event)" (change)="save()" />
                                  <input type="time" step="1800" class="bp-sow-cell" [ngModel]="e.from" (ngModelChange)="mutTimeline($index,'from',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="e.details" (ngModelChange)="mutTimeline($index,'details',$event)" (change)="save()" />
                                  <button type="button" class="bp-sow-ibtn justify-self-end" title="Remove" (click)="removeTimeline($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                                } @else {
                                  <span class="font-semibold">{{ e.date || '—' }}</span><span>{{ e.to }}</span><span>{{ e.from }}</span><span>{{ e.details }}</span><span></span>
                                }
                              </div>
                            }
                            @if (!timeline().length && !editable()) { <div class="px-3 py-2 bp-body-small text-muted italic">—</div> }
                          </div>
                        }
                        @case ('production') {
                          <!-- Pricing table — terse, read-only deal facts. Richer copy
                               (description, variant detail) renders as Item Details below. -->
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_44px_minmax(0,0.9fr)_72px_minmax(0,1fr)_90px] items-center gap-x-3 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Item</span><span class="bp-table-column-header">SKU</span><span class="bp-table-column-header">Qty</span><span class="bp-table-column-header">Unit</span><span class="bp-table-column-header">Unit Size</span><span class="bp-table-column-header">Variant</span><span class="bp-table-column-header text-right">Total</span>
                            </div>
                            @for (it of items(); track it.itemId) {
                              <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_44px_minmax(0,0.9fr)_72px_minmax(0,1fr)_90px] items-center gap-x-3 border-b border-hairline last:border-0 px-3 py-1.5 bp-body-small">
                                <span class="font-semibold">{{ it.item }}</span>
                                <span class="text-secondary">{{ it.sku || '—' }}</span>
                                <span class="text-center">{{ it.qty }}</span>
                                <span>{{ unitLabel(it.unit) }}</span>
                                <span class="text-center">{{ it.unitSize ?? '—' }}</span>
                                <span>{{ it.variant || '—' }}</span>
                                <span class="text-right font-semibold">{{ money(it.total) }}</span>
                              </div>
                            } @empty {
                              <div class="px-3 py-3 bp-body-small text-muted italic">No agreed items yet — items appear here once both sides accept them.</div>
                            }
                            @if (items().length) {
                              <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_44px_minmax(0,0.9fr)_72px_minmax(0,1fr)_90px] items-center gap-x-3 bg-fill px-3 py-2 bp-body-small">
                                <span class="col-span-6 font-semibold">Total (exc. VAT)</span><span class="text-right font-semibold">{{ money(itemsTotal()) }}</span>
                              </div>
                            }
                          </div>
                        }
                        @case ('deliverables') {
                          <!-- Derived per-item prose, one block per item: Description +
                               Options. Read-only, project-item sourced (its own section). -->
                          @for (b of productionBlocks(); track b.num) {
                            <div class="mt-3">
                              <div class="flex items-baseline gap-2">
                                <span class="bp-card-title whitespace-nowrap">{{ num }}.{{ b.num }}</span>
                                <span class="bp-body-small font-semibold text-text">{{ b.title }}</span>
                              </div>
                              @if (b.variant) { <div class="bp-caption text-muted mt-0.5">{{ b.variant }}</div> }
                              @if (b.body) { <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="b.body | md"></div> }
                            </div>
                          } @empty {
                            <div class="px-1 py-1 bp-body-small text-muted italic mt-1">No item descriptions on the agreed items yet.</div>
                          }
                        }
                        @case ('services') {
                          <!-- Derived per-item Services sections — the whole install
                               copy, one block per item (no staff/services parsing). -->
                          @for (b of servicesBlocks(); track b.num) {
                            <div class="mt-3">
                              <div class="flex items-baseline gap-2">
                                <span class="bp-card-title whitespace-nowrap">{{ num }}.{{ b.num }}</span>
                                <span class="bp-body-small font-semibold text-text">{{ b.title }}</span>
                              </div>
                              @if (b.body) { <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="b.body | md"></div> }
                            </div>
                          } @empty {
                            <div class="px-1 py-1 bp-body-small text-muted italic mt-1">No services copy on the agreed items yet.</div>
                          }
                        }
                        @case ('payment') {
                          <div class="overflow-hidden rounded-md border border-hairline mt-1">
                            <div class="grid grid-cols-[110px_90px_90px_110px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline bg-fill px-3 py-2">
                              <span class="bp-table-column-header">Date</span><span class="bp-table-column-header">Grace</span><span class="bp-table-column-header">Amount</span><span class="bp-table-column-header">Refundable</span><span class="bp-table-column-header">Details</span>
                              @if (editable()) { <button type="button" class="bp-sow-icon justify-self-end" title="Add row" (click)="addPayment()"><lucide-icon name="circle-plus" [size]="18" /></button> }
                            </div>
                            @for (r of payment(); track $index) {
                              <div class="grid grid-cols-[110px_90px_90px_110px_minmax(0,1fr)_32px] items-center gap-x-4 border-b border-hairline last:border-0 px-3 py-1 bp-body-small">
                                @if (editable()) {
                                  <input class="bp-sow-cell" [ngModel]="r.date" (ngModelChange)="mutPay($index,'date',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="r.grace" (ngModelChange)="mutPay($index,'grace',$event)" (change)="save()" />
                                  <input class="bp-sow-cell" [ngModel]="r.amount" (ngModelChange)="mutPay($index,'amount',$event)" (change)="save()" />
                                  <select class="bp-sow-cell" [ngModel]="r.refundable" (ngModelChange)="mutPay($index,'refundable',$event); save()"><option value="yes">Yes</option><option value="no">No</option><option value="partial">Partial</option><option value="na">N/A</option></select>
                                  <input class="bp-sow-cell" [ngModel]="r.details" (ngModelChange)="mutPay($index,'details',$event)" (change)="save()" />
                                  <button type="button" class="bp-sow-ibtn justify-self-end" title="Remove" (click)="removePayment($index)"><lucide-icon name="trash-2" [size]="14" /></button>
                                } @else {
                                  <span class="font-semibold">{{ r.date || '—' }}</span><span>{{ r.grace }}</span><span class="font-semibold">{{ r.amount }}</span><span>{{ refundableLabel(r.refundable) }}</span><span>{{ r.details }}</span><span></span>
                                }
                              </div>
                            }
                            <div class="px-3 py-2 bp-caption text-muted">Ballpark platform fee: {{ s.platformFeePct ?? 3 }}%</div>
                          </div>
                        }
                      }
        </ng-template>

        <!-- Unified section dialog — kept INSIDE the current() view so bodyTpl
             (the table renderer) is in scope for a table section. Content:
             editable textarea (author draft) · read-only prose · or the table
             itself for a table section. Plus the comment thread. -->
        <app-modal [open]="editOpen()" [title]="(editable() ? 'Edit · ' : '') + editLabel()" width="680px" maxWidth="92vw" (close)="editOpen.set(false)">
          <!-- Content -->
          @if (editable()) {
            <textarea class="ed-textarea w-full" style="min-height:40vh" [ngModel]="editText()" (ngModelChange)="editText.set($event)" placeholder="Markdown supported"></textarea>
          } @else {
            @let en = editNode();
            @if (en?.na) {
              <!-- N/A section: content reads N/A, matching the inline view. -->
              <p class="bp-body-small text-muted italic">N/A</p>
            } @else {
              @if (editText().trim()) {
                <div class="bp-md bp-body-small {{ en && readTable(en) ? 'mb-3' : 'max-h-[40vh]' }} overflow-y-auto whitespace-pre-line rounded-xl border border-hairline p-3 text-secondary" [innerHTML]="editText() | md"></div>
              }
              @if (en && readTable(en)) {
                <!-- Table section: show the table itself (read-only) so it can be read/copied in focus. -->
                <div class="max-h-[55vh] overflow-auto">
                  <ng-container *ngTemplateOutlet="bodyTpl; context: { node: en, read: true }" />
                </div>
              } @else if (!editText().trim()) {
                <p class="bp-body-small text-muted italic">No content in this section.</p>
              }
            }
          }

          <!-- Comment thread (once sent for review). Shows even with a null anchor
               (whole-document comment) so a stale/missing node id can't hide it. -->
          @if (current()?.status !== 'draft') {
            <div class="mt-4 border-t border-hairline pt-3">
              <div class="bp-caption mb-2 font-semibold text-muted">Comments</div>
              <div class="flex max-h-[32vh] flex-col gap-2 overflow-y-auto pr-1">
                @for (c of commentThread(); track c.id) {
                  <div class="rounded-xl border border-hairline p-3 {{ c.status === 'resolved' ? 'opacity-60' : '' }}">
                    <div class="flex items-center justify-between gap-2">
                      <span class="bp-caption font-semibold">{{ c.mine ? 'You' : (c.authorName || 'Counterparty') }}</span>
                      <div class="flex items-center gap-1.5 shrink-0">
                        @if (c.mine && editingCommentId() !== c.id) {
                          @if (c.status !== 'resolved') { <button type="button" class="bp-sow-ibtn text-muted" title="Edit" (click)="startEditComment(c)"><lucide-icon name="pencil" [size]="13" /></button> }
                          <button type="button" class="bp-sow-ibtn text-muted hover:text-danger" title="Delete" [disabled]="commentBusy()" (click)="removeComment(c.id)"><lucide-icon name="trash-2" [size]="13" /></button>
                        }
                        <span class="bp-caption text-muted">{{ c.createdAt | date: 'd MMM, h:mm a' }}</span>
                      </div>
                    </div>
                    @if (editingCommentId() === c.id) {
                      <textarea class="ed-textarea mt-2 w-full" style="min-height:70px" [ngModel]="commentEditDraft()" (ngModelChange)="commentEditDraft.set($event)"></textarea>
                      <div class="mt-1 flex items-center gap-3">
                        <button type="button" class="bp-caption font-semibold text-[var(--theme-accent)]" [disabled]="commentBusy() || !commentEditDraft().trim()" (click)="saveEditComment(c.id)">Save</button>
                        <button type="button" class="bp-caption text-muted" (click)="cancelEditComment()">Cancel</button>
                      </div>
                    } @else {
                      <div class="bp-body-small mt-1 whitespace-pre-line text-secondary">{{ c.body }}</div>
                      @if (c.status === 'resolved') { <div class="bp-caption mt-1 text-[var(--color-state-emerald)]">Resolved</div> }
                      @else if (isAuthor()) { <button type="button" class="bp-caption mt-1 text-muted underline underline-offset-2 hover:text-secondary" [disabled]="commentBusy()" (click)="resolveComment(c.id)">Resolve</button> }
                    }
                  </div>
                } @empty {
                  <p class="bp-body-small text-muted italic">No comments yet.</p>
                }
              </div>
              @if (!isAuthor()) {
                <textarea class="ed-textarea mt-2 w-full" style="min-height:80px" [ngModel]="commentDraft()" (ngModelChange)="commentDraft.set($event)" placeholder="Add a comment…"></textarea>
                <button type="button" class="bp-act bp-act--outline mt-2" [disabled]="commentBusy() || !commentDraft().trim()" (click)="postComment()">{{ commentBusy() ? 'Posting…' : 'Add comment' }}</button>
              }
            </div>
          }

          <button modalFooter type="button" class="bp-btn--secondary" (click)="editOpen.set(false)">{{ editable() ? 'Cancel' : 'Close' }}</button>
          @if (editable()) { <button modalFooter type="button" class="bp-btn--primary" [disabled]="busy()" (click)="saveEdit()">{{ busy() ? 'Saving…' : 'Save' }}</button> }
        </app-modal>

        @if (editable() && customize()) { <button type="button" class="bp-act bp-act--outline self-start" (click)="addSection()">+ Add section</button> }

        @if (s.status === 'accepted') { <p class="bp-body-small font-semibold text-success">Fully executed — approved by both parties.</p> }
      </div>
    } @else if (!sowsRes.isLoading()) {
      <p class="bp-body-small text-secondary px-5 py-4">
        @if (viewer() === 'supplier') { No SOW yet — create one to send to the agency. }
        @else { No Statement of Work has been shared yet — it'll appear here once the supplier sends it for review. }
      </p>
    }

    @if (error()) { <p class="bp-body-small text-danger px-5 pb-4">{{ error() }}</p> }
    </div>

    <!-- history dialog — status changes (who/when) + total comments. -->
    <app-modal [open]="historyOpen()" title="History" (close)="historyOpen.set(false)">
      @if (historyRes.isLoading()) { <p class="bp-body-small text-muted">Loading…</p> }
      @else if (historyRes.value(); as h) {
        <div class="flex flex-col gap-2">
          @for (e of h.events; track $index) {
            <div class="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
              <div class="min-w-0">
                <div class="bp-body-small font-semibold text-text">{{ e.event || e.status }}</div>
                <div class="bp-caption text-muted">{{ e.changedByName || '—' }}</div>
              </div>
              <div class="shrink-0 text-right">
                <div class="bp-caption text-muted">{{ e.changedAt | date: 'd MMM yyyy, h:mm a' }}</div>
                @if (e.commentCount) { <div class="bp-caption text-[var(--theme-accent)]">{{ e.commentCount }} comment{{ e.commentCount === 1 ? '' : 's' }}</div> }
              </div>
            </div>
          } @empty { <p class="bp-body-small text-muted italic">No history yet.</p> }
        </div>
        <div class="mt-4 border-t border-hairline pt-3 bp-body-small text-secondary">Total comments: <span class="font-semibold text-text">{{ h.commentCount }}</span></div>
      }
      <button modalFooter type="button" class="bp-btn--secondary" (click)="historyOpen.set(false)">Close</button>
    </app-modal>

    <!-- header & footer preview (read-only for now). Pills = fields filled from the project. -->
    <app-modal [open]="headerFooterOpen()" title="Header &amp; footer" (close)="headerFooterOpen.set(false)">
      <p class="bp-body-small mb-3 text-muted">How the document header and footer are laid out on every page. Fields in pills are filled from the project.</p>
      <div class="mb-3 rounded-xl border border-hairline p-4">
        <div class="bp-caption mb-2 font-semibold text-muted">Header</div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="bp-hf-pill">Project Name</span>
          <div class="flex flex-wrap items-center gap-2">
            <span class="bp-hf-pill">Project Ref</span>
            <span class="bp-hf-pill">Create Date, Create Time</span>
          </div>
        </div>
      </div>
      <div class="rounded-xl border border-hairline p-4">
        <div class="bp-caption mb-2 font-semibold text-muted">Footer</div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="bp-hf-pill">Agency Name</span>
          <span class="bp-caption text-muted">Page 1</span>
          <span class="bp-hf-pill">Generated via the Ballpark platform</span>
        </div>
      </div>
      <div class="mt-4 border-t border-hairline pt-3">
        @if (hfVote(); as v) {
          <p class="bp-body-small text-[var(--theme-accent)]">Thanks — your vote ({{ v }}) is noted. 🎉</p>
        } @else {
          <p class="bp-body-small mb-2 text-secondary">Configurable headers &amp; footers are coming. Vote for it:</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="bp-act bp-act--sm bp-act--primary" (click)="hfVote.set('Really want')">Really want</button>
            <button type="button" class="bp-act bp-act--sm bp-act--outline" (click)="hfVote.set('Yes please')">Yes please</button>
            <button type="button" class="bp-act bp-act--sm bp-act--transparent" (click)="hfVote.set('Whatever')">Whatever</button>
          </div>
        }
      </div>
      <button modalFooter type="button" class="bp-btn--secondary" (click)="headerFooterOpen.set(false)">Close</button>
    </app-modal>

    <!-- Suggest-from-conversation: per-change Accept/Decline (nothing applied implicitly). -->
    <app-modal [open]="suggestOpen()" title="Suggested from your conversation" width="640px" maxWidth="92vw" (close)="suggestOpen.set(false)">
      @if (suggestBusy() && !suggestData()) {
        <p class="bp-body-small text-muted">Reading the conversation…</p>
      } @else if (suggestData(); as d) {
        @if (suggestEmpty()) {
          <p class="bp-body-small text-muted italic">No changes found in the conversation to suggest.</p>
        } @else {
          <p class="bp-body-small mb-3 text-secondary">Accept the changes you want — they're applied to the SOW and the agreed lines. Decline any you don't.</p>
          @if (d.milestones.length) {
            <div class="mb-3">
              <div class="bp-caption mb-1 font-semibold text-muted">Milestones</div>
              @for (m of d.milestones; track $index) {
                <label class="flex items-center gap-2 py-1 bp-body-small">
                  <input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="sgAccepted('m' + $index)" (change)="toggleSuggest('m' + $index)" />
                  <span class="font-medium">{{ m.from || '—' }}</span><span class="text-secondary">{{ m.details }}</span>
                </label>
              }
            </div>
          }
          @if (d.items.length) {
            <div class="mb-3">
              <div class="bp-caption mb-1 font-semibold text-muted">Item changes</div>
              @for (it of d.items; track it.itemId) {
                <label class="flex items-start gap-2 py-1 bp-body-small">
                  <input type="checkbox" class="mt-1 accent-[var(--theme-accent)]" [checked]="sgAccepted('i' + it.itemId)" (change)="toggleSuggest('i' + it.itemId)" />
                  <span class="min-w-0">
                    <span class="font-semibold">{{ it.itemName }}</span>@if (it.cost != null) { <span class="text-[var(--theme-accent)]"> · cost → {{ money(it.cost) }}</span> }
                    @if (it.description) { <div class="text-secondary">{{ it.description }}</div> }
                    @if (it.variantChange || it.newVariant) { <div class="text-secondary">Variant: {{ it.variantChange || it.newVariant }}</div> }
                    @if (it.install) { <div class="text-secondary">Install: {{ it.install }}</div> }
                  </span>
                </label>
              }
            </div>
          }
          @if (d.payment.length || d.depositPct != null) {
            <div>
              <div class="bp-caption mb-1 font-semibold text-muted">Payment</div>
              @if (d.depositPct != null) {
                <label class="flex items-center gap-2 py-1 bp-body-small">
                  <input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="sgAccepted('deposit')" (change)="toggleSuggest('deposit')" />
                  <span>Deposit <span class="font-medium">{{ d.depositPct }}%</span></span>
                </label>
              }
              @for (p of d.payment; track $index) {
                <label class="flex items-center gap-2 py-1 bp-body-small">
                  <input type="checkbox" class="accent-[var(--theme-accent)]" [checked]="sgAccepted('p' + $index)" (change)="toggleSuggest('p' + $index)" />
                  <span class="font-medium">{{ p.amount }}</span><span class="text-secondary">{{ p.grace }} {{ p.details }}</span>
                </label>
              }
            </div>
          }
        }
      }
      <button modalFooter type="button" class="bp-btn--secondary" (click)="suggestOpen.set(false)">Cancel</button>
      @if (suggestData() && !suggestEmpty()) { <button modalFooter type="button" class="bp-btn--primary" [disabled]="suggestBusy()" (click)="applySuggestionsNow()">{{ suggestBusy() ? 'Applying…' : 'Apply selected' }}</button> }
    </app-modal>

  `,
  styles: [`
    .bp-sow-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: color-mix(in srgb, var(--theme-accent) 13%, var(--color-surface)); border-radius: 9999px; margin: 0.4rem 0.4rem 0.1rem; padding: 0.45rem 1.1rem; }
    .bp-sow-icon { color: var(--theme-accent); display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    .bp-sow-ibtn { color: var(--color-text-secondary); display: inline-flex; align-items: center; justify-content: center; line-height: 0; padding: 2px; }
    .bp-sow-ibtn:hover { color: var(--color-text); }
    .bp-sow-cell { width: 100%; min-width: 0; border: none; background: transparent; padding: 0.25rem 0; font: inherit; color: inherit; }
    .bp-sow-cell:focus { outline: none; background: var(--color-fill); border-radius: 3px; }
    .bp-sow-title { min-width: 0; border: none; background: transparent; padding: 0 0.15rem; font-family: var(--bp-font); font-size: var(--text-xl); font-weight: 600; line-height: var(--leading-snug); color: var(--color-text-strong); }
    .bp-sow-title:focus { outline: none; background: var(--color-fill); border-radius: 3px; }
    table th { font-size: 0.72rem; }
    .bp-hf-pill { display: inline-flex; align-items: center; border-radius: 9999px; border: 1px dashed color-mix(in srgb, var(--theme-accent) 45%, var(--color-border-hairline)); background: color-mix(in srgb, var(--theme-accent) 9%, var(--color-surface)); color: var(--color-text-secondary); padding: 2px 10px; font-size: var(--text-xs); white-space: nowrap; }
  `],
})
export class SowPanelComponent {
  readonly thread = input.required<InboxThread>();
  readonly viewer = input.required<'agency' | 'supplier'>();
  readonly project = input<InboxProjectSummary | null>(null);
  /** A monotonically-increasing nonce from the rail's + button — each new value
   *  asks the panel to create the draft (if it can). 0 = no request. */
  readonly autoCreate = input<number>(0);
  /** Fired after a successful create so the parent can refresh the rail node. */
  readonly created = output<void>();

  private readonly sowSvc = inject(SowService);

  // The rail's + fires create() here — one owner for the create flow. Wait for
  // the list to settle (so a stale empty read can't double-create), then create
  // only if we still can; busy() guards a double-click.
  private lastAutoCreate = 0;
  constructor() {
    effect(() => {
      const n = this.autoCreate();
      if (!n || n === this.lastAutoCreate) return;
      if (this.sowsRes.isLoading()) return; // re-runs when the load settles
      this.lastAutoCreate = n;
      if (this.canCreate() && !this.busy()) void this.create();
    });
  }

  protected readonly sowsRes = resource({
    params: () => this.thread()?.projectId || undefined,
    loader: ({ params }) => firstValueFrom(this.sowSvc.list(params)),
  });
  private readonly sows = computed<Sow[]>(() => {
    const all = this.sowsRes.value() ?? [];
    const sup = this.thread()?.supplierOrgId;
    return all.filter((s) => s.supplierOrgId === sup);
  });
  protected readonly current = computed<Sow | null>(() => this.sows().find((s) => s.status !== 'declined') ?? null);

  protected readonly edited = linkedSignal<SowContent>(() => (this.current()?.content as SowContent) ?? {});

  private readonly myOrgId = computed(() => (this.viewer() === 'supplier' ? this.thread()?.supplierOrgId : this.thread()?.agencyOrgId) ?? null);
  protected readonly isAuthor = computed(() => { const s = this.current(); return !!s && !!this.myOrgId() && s.orgId === this.myOrgId(); });
  protected readonly editable = computed(() => this.isAuthor() && this.current()?.status === 'draft');
  // Review lifecycle gates (Draft → In review → Accepted | Declined).
  protected readonly canSend = computed(() => this.isAuthor() && this.current()?.status === 'draft');
  // No revisions once it's out for review (SOW Review = the agent's turn). The author
  // can revise only after the agent hands it back (reviewed) or before final approval.
  protected readonly canRevise = computed(() => { const st = this.current()?.status; return this.isAuthor() && (st === 'reviewed' || st === 'agent_approved'); });
  // Agent Approve/Reject while in review OR after the agent has marked it Reviewed.
  protected readonly canRespond = computed(() => { const s = this.current(); return !!s && !this.isAuthor() && (s.status === 'in_review' || s.status === 'reviewed'); });
  // The neutral "Reviewed" marker — agent signals review complete (in_review only).
  protected readonly canMarkReviewed = computed(() => { const s = this.current(); return !!s && !this.isAuthor() && s.status === 'in_review'; });
  // Both parties approve: after the agent approves, the supplier (author) gives the final approval.
  protected readonly canCoApprove = computed(() => { const s = this.current(); return !!s && this.isAuthor() && s.status === 'agent_approved'; });

  /** The supplier's standard T&C PDF, embedded as Appendix A. */
  protected readonly termsPdfUrl = computed(() => this.current()?.termsPdfUrl ?? null);

  // Editable document title + subtitle (stored on content.blockOverrides; defaults
  // to the SOW banner). Lets this read/edit as a contract with its own heading.
  protected readonly docTitle = computed(() => this.edited().blockOverrides?.['doc:title'] ?? 'STATEMENT OF WORK');
  protected readonly docSubtitle = computed(() => this.edited().blockOverrides?.['doc:subtitle'] ?? 'Generated via the Ballpark platform');

  // ── Review comments (generic review_comments machine) ────────────────────────
  protected readonly commentsRes = resource({
    params: () => this.current()?.id || undefined,
    loader: ({ params }) => firstValueFrom(this.sowSvc.comments(params)),
  });
  protected readonly comments = computed<SowComment[]>(() => this.commentsRes.value() ?? []);
  /** Open-comment count per anchor (node id) — drives the little badge. */
  private readonly openByAnchor = computed(() => {
    const m = new Map<string, number>();
    for (const c of this.comments()) if (c.status === 'open' && c.anchorId) m.set(c.anchorId, (m.get(c.anchorId) ?? 0) + 1);
    return m;
  });
  protected anchorCount(id?: string | null): number { return id ? (this.openByAnchor().get(id) ?? 0) : 0; }
  // Comment thread (lives inside the unified section dialog; anchor is the node
  // id or block key set by openEditNode / openEditBlock).
  protected readonly commentAnchor = signal<string | null>(null);
  protected readonly commentDraft = signal('');
  protected readonly commentBusy = signal(false);
  protected readonly commentThread = computed<SowComment[]>(() => {
    const a = this.commentAnchor();
    return this.comments().filter((c) => (c.anchorId ?? null) === a);
  });
  async postComment(): Promise<void> {
    const s = this.current(); const body = this.commentDraft().trim();
    if (!s || !body || this.commentBusy()) return;
    this.commentBusy.set(true);
    try {
      await firstValueFrom(this.sowSvc.addComment(s.id, body, this.commentAnchor()));
      this.commentDraft.set('');
      this.commentsRes.reload();
    } catch (e) { this.error.set(errorDetail(e) || 'Could not post the comment'); }
    finally { this.commentBusy.set(false); }
  }
  async resolveComment(cid: string): Promise<void> {
    const s = this.current(); if (!s) return;
    this.commentBusy.set(true);
    try { await firstValueFrom(this.sowSvc.resolveComment(s.id, cid)); this.commentsRes.reload(); }
    catch (e) { this.error.set(errorDetail(e) || 'Could not resolve the comment'); }
    finally { this.commentBusy.set(false); }
  }
  // Edit / delete your own comment (author side; RLS enforces).
  protected readonly editingCommentId = signal<string | null>(null);
  protected readonly commentEditDraft = signal('');
  startEditComment(c: SowComment): void { this.editingCommentId.set(c.id); this.commentEditDraft.set(c.body); }
  cancelEditComment(): void { this.editingCommentId.set(null); this.commentEditDraft.set(''); }
  async saveEditComment(cid: string): Promise<void> {
    const s = this.current(); const body = this.commentEditDraft().trim();
    if (!s || !body || this.commentBusy()) return;
    this.commentBusy.set(true);
    try {
      await firstValueFrom(this.sowSvc.editComment(s.id, cid, body));
      this.editingCommentId.set(null); this.commentEditDraft.set('');
      this.commentsRes.reload();
    } catch (e) { this.error.set(errorDetail(e) || 'Could not edit the comment'); }
    finally { this.commentBusy.set(false); }
  }
  async removeComment(cid: string): Promise<void> {
    const s = this.current(); if (!s || this.commentBusy()) return;
    this.commentBusy.set(true);
    try { await firstValueFrom(this.sowSvc.deleteComment(s.id, cid)); this.commentsRes.reload(); }
    catch (e) { this.error.set(errorDetail(e) || 'Could not delete the comment'); }
    finally { this.commentBusy.set(false); }
  }

  // ── Server PDF (pdf-lib) ──────────────────────────────────────────────────────
  // The client flattens the rendered tree into an ordered "print model" of blocks;
  // the server draws them (so the PDF matches the UI without a duplicate render).
  protected readonly pdfBusy = signal(false);
  // ── Read vs customize ────────────────────────────────────────────────────
  // Default is a lightweight read view: tables in full, every other subsection
  // a one-line heading + tick/N-A + a pencil to open the full editor. The author
  // flips Customize on to get the editable section cards.
  protected readonly customize = signal(false);
  /** Header "…" overflow menu (Create PDF · View all). */
  protected readonly menuOpen = signal(false);
  /** View all: show EVERY section in review mode (incl. the boilerplate the read
   *  view normally hides). Off = the trimmed review outline. */
  protected readonly viewAll = signal(false);
  /** History dialog — loads the status log + comment count on open. */
  protected readonly historyOpen = signal(false);
  protected readonly historyRes = resource({
    params: () => (this.historyOpen() ? this.current()?.id : undefined) || undefined,
    loader: ({ params }) => firstValueFrom(this.sowSvc.history(params)),
  });
  /** Header/footer preview + a playful "vote for configurable" (client-only). */
  protected readonly headerFooterOpen = signal(false);
  protected readonly hfVote = signal<string | null>(null);

  // ── "Suggest from conversation" (AI, on-demand) ──────────────────────────────
  // Loads change proposals from the chat; the supplier ACCEPTS/DECLINES each, then
  // applies. Nothing is applied implicitly. `declined` holds the keys the user opted out of.
  protected readonly suggestOpen = signal(false);
  protected readonly suggestBusy = signal(false);
  protected readonly suggestData = signal<SowSuggestions | null>(null);
  protected readonly suggestDeclined = signal<Set<string>>(new Set());
  protected sgAccepted(key: string): boolean { return !this.suggestDeclined().has(key); }
  protected toggleSuggest(key: string): void {
    const s = new Set(this.suggestDeclined());
    if (s.has(key)) s.delete(key); else s.add(key);
    this.suggestDeclined.set(s);
  }
  protected readonly suggestEmpty = computed(() => {
    const d = this.suggestData();
    return !!d && !d.milestones.length && !d.items.length && !d.payment.length && d.depositPct == null;
  });
  async openSuggest(): Promise<void> {
    const s = this.current(); if (!s) return;
    this.suggestOpen.set(true); this.suggestBusy.set(true); this.suggestDeclined.set(new Set()); this.suggestData.set(null); this.error.set(null);
    try { this.suggestData.set(await firstValueFrom(this.sowSvc.suggest(s.id))); }
    catch (e) { this.error.set(errorDetail(e) || 'Could not read the conversation'); }
    finally { this.suggestBusy.set(false); }
  }
  async applySuggestionsNow(): Promise<void> {
    const s = this.current(); const d = this.suggestData(); if (!s || !d || this.suggestBusy()) return;
    this.suggestBusy.set(true);
    try {
      const payload: Partial<SowSuggestions> = {
        milestones: d.milestones.filter((_, i) => this.sgAccepted('m' + i)),
        payment: d.payment.filter((_, i) => this.sgAccepted('p' + i)),
        depositPct: (d.depositPct != null && this.sgAccepted('deposit')) ? d.depositPct : null,
        items: d.items.filter((it) => this.sgAccepted('i' + it.itemId)),
      };
      await firstValueFrom(this.sowSvc.applySuggestions(s.id, payload));
      this.suggestOpen.set(false);
      this.sowsRes.reload();
      this.created.emit(); // lines changed → refresh the thread/rail
    } catch (e) { this.error.set(errorDetail(e) || 'Could not apply the changes'); }
    finally { this.suggestBusy.set(false); }
  }
  /** Does a node carry something to review (drives the read-view tick)? */
  protected readHasContent(n: SowNode): boolean {
    if (n.na) return false;
    if (n.text && n.text.trim()) return true;
    if (n.children && n.children.length) return true;
    return ['timeline', 'production', 'payment', 'parties', 'projectDetails', 'termsPdf', 'signature'].includes(n.type as string);
  }
  // Read view shows only the sections a supplier reviews: the ones carrying a
  // table or the production/services run (+ appendices). The pure boilerplate/
  // legal sections (purpose, parties, signature, terms) stay in the PDF only.
  private readonly READ_TYPES = new Set(['timeline', 'production', 'deliverables', 'payment', 'services', 'appendix', 'termsPdf']);
  /** A node whose body is an inline-editable table — no edit pencil needed. */
  protected readTable(n: SowNode): boolean { return ['timeline', 'production', 'payment'].includes(n.type as string); }
  /** A node that holds its own per-item sub-subsections — those rows carry the
   *  tick + edit, so the parent heading shows neither. */
  protected readGrouped(n: SowNode): boolean { return ['deliverables', 'services'].includes(n.type as string); }
  protected readShowSection(n: SowNode): boolean {
    if (this.viewAll()) return true; // "View all" shows every section, boilerplate included.
    if (n.type && this.READ_TYPES.has(n.type)) return true;
    return (n.children ?? []).some((c) => this.readShowSection(c));
  }
  /** Within a shown section, render a child unless it's empty (keeps N/A rows).
   *  The author sees every row so they can toggle N/A / edit even empty ones. */
  protected readShouldRender(n: SowNode): boolean {
    if (this.editable() || this.viewAll()) return true;
    if (n.na) return true;
    if (n.text && n.text.trim()) return true;
    if (n.type && this.READ_TYPES.has(n.type)) return true;
    return (n.children ?? []).length > 0;
  }
  /** Stamped when the PDF is generated (defaults to now for the on-screen field);
   *  the identifier reflects when the document was produced. */
  private readonly pdfStamp = signal(new Date());
  /** Document identifier from the ref + generation date/time — we don't version,
   *  so this doubles as the "SOW Version" and the download filename. */
  protected readonly sowIdentifier = computed(() => {
    const ref = (this.project()?.ref ?? this.thread()?.refCode ?? 'SOW').toString().toUpperCase();
    const d = this.pdfStamp();
    const mon = d.toLocaleString('en-GB', { month: 'short' });
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `SOW-${ref}-${d.getDate()}${mon}${d.getFullYear()}-${h}:${String(d.getMinutes()).padStart(2, '0')}${ampm}`;
  });
  /** The same identifier, made filesystem-safe (drops the colon) + .pdf. */
  private pdfFileName(): string {
    return `${this.sowIdentifier().replace(/[^\w.-]/g, '')}.pdf`;
  }
  protected async downloadPdf(): Promise<void> {
    const s = this.current();
    if (!s || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    this.error.set(null);
    this.pdfStamp.set(new Date()); // the identifier/version is the moment of generation
    try {
      const meta = { project: this.thread()?.projectName ?? this.project()?.name ?? null, ref: this.project()?.ref ?? this.thread()?.refCode ?? null, name: this.pdfFileName(), title: this.sowIdentifier(), generatedAt: this.pdfStamp().toISOString() };
      const blob = await firstValueFrom(this.sowSvc.pdf(s.id, this.buildPrintModel(), meta));
      // Open the PDF in a new browser tab (inline viewer). The server names it
      // via Content-Disposition, so a save-from-viewer still gets sowIdentifier.
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not generate the PDF');
    } finally {
      this.pdfBusy.set(false);
    }
  }
  /** Flatten the section tree + derived content into ordered draw blocks. */
  private buildPrintModel(): unknown[] {
    const out: Record<string, unknown>[] = [];
    const walk = (nodes: SowNode[], prefix: string, depth: number): void => {
      nodes.forEach((n, i) => {
        const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        // Appendices: a fresh page, centered title, no number (its items keep theirs).
        if (n.type === 'appendix') {
          out.push({ kind: 'heading', title: n.title, level: 0, pageBreak: true, center: true });
        } else {
          out.push({ kind: 'heading', num, title: n.title, level: depth });
        }
        if (n.na) { out.push({ kind: 'text', md: 'N/A' }); return; }
        if (n.text) out.push({ kind: 'text', md: n.text });
        this.printNodeBody(out, n, num);
        walk(n.children, num, depth + 1);
      });
    };
    walk(this.sections(), '', 0);
    return out;
  }
  private printNodeBody(out: Record<string, unknown>[], n: SowNode, num: string): void {
    switch (n.type) {
      case 'parties':
        out.push({ kind: 'table', columns: [{ header: 'Party', width: 160 }, { header: 'Details', width: 400 }],
          rows: [['Agency (Buyer)', this.partyValue('agency')], ['Supplier', this.partyValue('supplier')]] });
        break;
      case 'projectDetails':
        out.push({ kind: 'table', columns: [{ header: 'Field', width: 170 }, { header: 'Value', width: 390 }],
          rows: this.projectDetailRows().map((r) => [r.label, r.value || '—']) });
        break;
      case 'timeline':
        out.push({ kind: 'table', columns: [{ header: 'Date', width: 120 }, { header: 'To', width: 80 }, { header: 'From', width: 80 }, { header: 'Details', width: 280 }],
          rows: this.timeline().map((e) => [e.date || '—', e.to || '', e.from || '', e.details || '']) });
        break;
      case 'production': {
        out.push({ kind: 'table',
          columns: [{ header: 'Item', width: 130 }, { header: 'SKU', width: 60 }, { header: 'Qty', width: 36, align: 'center' },
            { header: 'Unit', width: 80 }, { header: 'Unit Size', width: 60, align: 'center' }, { header: 'Variant', width: 90 }, { header: 'Total', width: 80, align: 'right' }],
          rows: this.items().map((it) => [it.item, it.sku || '—', String(it.qty ?? ''), this.unitLabel(it.unit),
            it.unitSize != null ? String(it.unitSize) : '—', it.variant || '—', this.money(it.total)]) });
        out.push({ kind: 'note', md: `**Total (exc. VAT): ${this.money(this.itemsTotal())}**` });
        break;
      }
      case 'deliverables':
        for (const b of this.productionBlocks()) {
          out.push({ kind: 'heading', num: `${num}.${b.num}`, title: b.title, level: 2 });
          if (b.variant) out.push({ kind: 'text', md: b.variant });
          if (b.body) out.push({ kind: 'text', md: b.body });
        }
        break;
      case 'services':
        for (const b of this.servicesBlocks()) {
          out.push({ kind: 'heading', num: `${num}.${b.num}`, title: b.title, level: 2 });
          if (b.body) out.push({ kind: 'text', md: b.body });
        }
        break;
      case 'payment':
        out.push({ kind: 'table', columns: [{ header: 'Date', width: 110 }, { header: 'Grace', width: 80 }, { header: 'Amount', width: 80 }, { header: 'Refundable', width: 90 }, { header: 'Details', width: 200 }],
          rows: this.payment().map((r) => [r.date || '—', r.grace || '', r.amount || '', this.refundableLabel(r.refundable), r.details || '']) });
        break;
      case 'signature':
        out.push({ kind: 'text', md: this.bp('conclusion') });
        out.push({ kind: 'note', md: 'Agency: ____________________        Supplier: ____________________' });
        break;
      case 'termsPdf':
        out.push({ kind: 'note', md: 'Terms & Conditions attached (Appendix A).' });
        break;
      default: break;
    }
  }

  protected readonly canCreate = computed(() => !this.current() && this.viewer() === 'supplier');

  protected readonly timeline = computed<SowTimelineEntry[]>(() => this.edited().timeline?.entries ?? []);
  protected readonly payment = computed<SowPaymentRow[]>(() => this.edited().payment?.rows ?? []);
  // The document structure — the author's saved tree, or the seeded default (which
  // keeps re-rendering codelist boilerplate until the author first edits). Stored
  // trees are normalised so a legacy `subs` array reads as `children`.
  protected readonly sections = computed<SowNode[]>(() => normalizeNodes(this.edited().sections ?? this.defaultSections()));
  private defaultSections(): SowNode[] {
    return [
      { title: 'Document Purpose', text: this.bp('intro'), children: [] },
      { title: 'Parties & Project', text: this.bp('parties_project'), children: [
        { title: 'SOW Parties', text: this.bp('sow_parties'), type: 'parties', children: [] },
        { title: 'Project Details', text: this.bp('project_details'), type: 'projectDetails', children: [] },
      ] },
      { title: 'Project Milestones', text: this.bp('milestones'), children: [
        { title: 'Timeline', text: null, type: 'timeline', children: [] },
      ] },
      { title: 'Services & Goods', text: this.bp('services_goods'), children: [
        { title: 'Concept & Design Sign-off', text: null, na: true, children: [] },
        { title: 'Bespoke Render', text: null, na: true, children: [] },
        { title: 'Production, Pricing & Price-Matched Items', text: this.productionIntro(), type: 'production', children: [] },
        { title: 'Deliverables', text: this.bp('deliverables'), type: 'deliverables', children: [] },
        { title: 'Services (install & de-rig)', text: this.bp('services_install'), type: 'services', children: [] },
      ] },
      { title: 'Fees & Payment', text: this.bp('fees_payment'), children: [
        { title: 'Payment Schedule', text: this.bp('payment_schedule'), type: 'payment', children: [] },
        { title: 'Special Terms', text: null, children: [] },
      ] },
      { title: 'Signature', type: 'signature', children: [] },
      { title: 'Terms & Conditions', text: this.bp('terms'), children: [] },
      { title: 'Appendices', text: this.bp('appendix'), type: 'appendix', children: [
        { title: 'Terms & Conditions', type: 'termsPdf', children: [] },
      ] },
    ];
  }
  // Production items. EXECUTED → the frozen snapshot (project_document_lines), so
  // a signed SOW shows what was signed. DRAFT → derived live from the thread's
  // approved (both-accepted) items. Same shape either way.
  protected readonly items = computed<SowProductionItem[]>(() => {
    const frozen = this.current()?.lines;
    if (frozen && frozen.length) return frozen;
    return (this.thread()?.items ?? [])
      .filter((it) => it.buyerAccepted && it.sellerAccepted)
      .map((it) => ({
        itemId: it.itemId ?? it.id,
        item: it.name,
        sku: it.sku ?? null,
        qty: it.quantity,
        unit: it.unit ?? null,
        unitSize: it.unitSize ?? null,
        variant: it.variant ?? null,
        total: it.priceCurrent ?? it.priceRef,
        description: it.description ?? null,
        variantDescription: it.line?.variantDescription ?? null,
        installDescription: it.line?.installDescription ?? null,
      } as SowProductionItem));
  });
  protected readonly itemsTotal = computed(() => this.items().reduce((s, it) => s + (Number(it.total) || 0), 0));

  // Derived, read-only per-item SECTIONS (not tables), flat-numbered within their
  // subsection. All copy is project-item sourced (via the line).
  private itemLabel(it: SowProductionItem): string {
    return [it.sku, it.item].filter(Boolean).join(' ');
  }
  /** 4.3.n — Description + Options (variant) blocks under Production. */
  protected readonly productionBlocks = computed(() => {
    const ov = this.edited().blockOverrides ?? {};
    const body = (key: string, derived: string | null) => (key in ov ? ov[key] : derived);
    const out: { num: number; key: string; title: string; variant: string | null; body: string | null }[] = [];
    let n = 0;
    for (const it of this.items()) {
      const label = this.itemLabel(it);
      const dk = `${it.itemId}:description`, ok = `${it.itemId}:options`;
      if (it.description || dk in ov) out.push({ num: ++n, key: dk, title: `${label} — Description`, variant: null, body: body(dk, it.description) });
      if (it.variant || it.variantDescription || ok in ov) out.push({ num: ++n, key: ok, title: `${label} — Options`, variant: it.variant, body: body(ok, it.variantDescription) });
    }
    return out;
  });
  /** 4.4.n — Services (whole install_description) blocks, one per item. */
  protected readonly servicesBlocks = computed(() => {
    const ov = this.edited().blockOverrides ?? {};
    const out: { num: number; key: string; title: string; body: string | null }[] = [];
    let n = 0;
    for (const it of this.items()) {
      const sk = `${it.itemId}:services`;
      const b = sk in ov ? ov[sk] : it.installDescription;
      if (it.installDescription || sk in ov) out.push({ num: ++n, key: sk, title: `${this.itemLabel(it)} — Services`, body: b });
    }
    return out;
  });
  /** Boilerplate intro above the pricing table (supplier interpolated). */
  protected productionIntro(): string {
    const sup = this.thread()?.supplierName || 'the Supplier';
    return `The table below lists the items, quantities and costs of everything delivered by ${sup} under the terms of this Statement of Work.`;
  }
  protected readonly servicesIntro = 'The Supplier shall supply the goods and deliver the services described in this section, as agreed and costed through the Ballpark platform. The pricing table below is the definitive record of the agreed scope and cost; the item descriptions that follow set out the agreed detail.';

  // Boilerplate (fixed) copy — shown but not editable (verbatim from the SOW spec).
  protected readonly introText =
    'This Statement of Work ("SOW") is entered into directly between the Agency and the Supplier named below in connection with the project described. It was generated using cost data and scope details submitted through the Ballpark platform (www.theballpark.ai — operated by The Ballpark AI Ltd, "Ballpark").\n\n' +
    'Ballpark is a technology platform that connects Agencies with Suppliers and provides ballpark cost estimates, booking tools and payment facilitation. Ballpark is not a party to this SOW, does not provide the Services or Deliverables described in it, and is not responsible for their delivery. See "Role of Ballpark" in Annex A for full detail.';
  protected readonly paymentBoilerplate =
    'A percentage of the total Fee is invoiced upon signature of this SOW by both the Agency and the Supplier. The negotiated percentage is defined in the table below, and paid by the Agency via Stripe. The remaining balance is invoiced on completion of the Services, payable within [30] days. Funds are collected and released by Ballpark acting solely as a payment facilitator on the Supplier’s behalf.';
  protected readonly conclusionText =
    'This Statement of Work is entered into on the Effective Date pursuant to the Supplier’s standard terms of purchase set out in Annex A. Any terms and conditions on the Agency’s form of purchase order are void and have no legal effect unless otherwise agreed. Each party warrants that they have all right, title and interest to bind the applicable entity on whose behalf they are signing.';

  // Boilerplate copy lives in the `sow_boilerplate` reference codelist (meta.text),
  // editable in Settings ▸ Codelists; the constants above are the fallback.
  private readonly codelistSvc = inject(CodelistService);
  private readonly boilerplateRes = resource({ loader: () => this.codelistSvc.list('sow_boilerplate') });
  // item_unit labels for the Production "Unit" column — the shared unitTypeLabel
  // (e.g. 'platter' → "Package"); the size sits in the "Unit Size" column.
  private readonly unitsRes = resource({ loader: () => this.codelistSvc.list('item_unit') });
  protected unitLabel(code: string | null): string {
    return unitTypeLabel(code, this.unitsRes.value()) || '—';
  }
  /** Boilerplate copy for a section/subsection — the editable codelist text
   *  (sow_boilerplate · meta.text) if present, else the built-in fallback. */
  protected bp(code: string): string {
    const text = this.boilerplateRes.value()?.find((x) => x.code === code)?.meta?.['text'];
    if (typeof text === 'string' && text.trim()) return text;
    switch (code) {
      case 'intro': return this.introText;
      case 'payment_schedule': return this.paymentBoilerplate;
      case 'conclusion': return this.conclusionText;
      case 'parties_project': return 'This Statement of Work ("SOW") is entered into between the two parties identified in the SOW Parties table below, and governs the goods and services to be supplied in connection with the project set out in Project Details.';
      case 'sow_parties': return 'This SOW is made between the following parties, each of whom warrants that it has authority to enter into it:';
      case 'project_details': return 'This SOW relates to the following project:';
      case 'milestones': return 'The key dates and milestones for delivery of the Services are set out below. Dates shown as indicative are subject to written confirmation by both parties; confirmed dates are binding.';
      case 'services_goods': return this.servicesIntro;
      case 'deliverables': return 'The agreed detail for each item is set out below — the specification described by the Supplier and the selected options that make up the deliverable.';
      case 'services_install': return 'The following installation, on-site and de-rig services are included for each item, as specified by the Supplier:';
      case 'fees_payment': return 'The Fee payable under this SOW, and the terms on which it is invoiced and paid, are set out below. All amounts are exclusive of VAT unless expressly stated otherwise.';
      case 'terms': return "The Supplier's standard terms and conditions of supply apply to and are incorporated into this SOW (provided at supplier level). Where those terms conflict with the body of this SOW, the body of this SOW prevails.";
      case 'appendix': return 'The documents listed below are attached to and form part of this Statement of Work.';
      default: return '';
    }
  }

  // Section 2 · Project Details — auto-populated from the project / thread, each
  // value editable (an edit stores an override by field label; see mutDetail).
  protected readonly projectDetailRows = computed(() => {
    const t = this.thread();
    const p = this.project();
    const executed = this.current()?.status === 'accepted';
    const ov = this.edited().projectDetailOverrides ?? {};
    const base = [
      { label: 'Ballpark Reference', value: p?.ref ?? t?.refCode ?? null },
      { label: 'Effective Date', value: executed ? 'Approved' : 'On approval by both parties' },
      { label: 'SOW Version', value: this.sowIdentifier() },
      { label: 'Project Title', value: t?.projectName ?? p?.name ?? null },
      { label: 'Event Date(s)', value: p?.eventDate ?? null },
      { label: 'Venue / Location', value: p?.location ?? null },
      { label: 'Category', value: t?.categoryName ?? null },
    ];
    return base.map((r) => ({ label: r.label, value: ov[r.label] ?? r.value }));
  });
  mutDetail(label: string, v: string): void {
    this.mut((c) => ({ ...c, projectDetailOverrides: { ...(c.projectDetailOverrides ?? {}), [label]: v } }));
  }

  // Section 2 · SOW Parties — legal details resolved cross-org (gated definer),
  // shown by default; an edit stores an override per party (mutParty).
  private readonly partiesRes = resource({
    params: () => this.current()?.id,
    loader: ({ params }) => firstValueFrom(this.sowSvc.partiesFor(params)),
  });
  private partyLine(role: 'agency' | 'supplier'): string {
    const p = (this.partiesRes.value() as SowParties | undefined)?.[role] ?? null;
    const fallbackName = (role === 'agency' ? this.thread().agencyName : this.thread().supplierName) ?? '—';
    if (!p) return fallbackName;
    const bits: string[] = [];
    if (p.jurisdiction) bits.push(`a company registered in ${p.jurisdiction}`);
    if (p.companyNumber) bits.push(`under Company Number ${p.companyNumber}`);
    if (p.address) bits.push(`whose principal place of business is at ${p.address}`);
    return bits.length ? `${p.name || fallbackName}, ${bits.join(' ')}.` : (p.name || fallbackName);
  }
  /** The displayed party detail — the author's override if set, else the live line. */
  protected partyValue(role: 'agency' | 'supplier'): string {
    return this.edited().partyOverrides?.[role] ?? this.partyLine(role);
  }
  mutParty(role: 'agency' | 'supplier', v: string): void {
    this.mut((c) => ({ ...c, partyOverrides: { agency: null, supplier: null, ...(c.partyOverrides ?? {}), [role]: v } }));
  }

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected refundableLabel(r: SowPaymentRow['refundable']): string { return r === 'yes' ? 'Yes' : r === 'no' ? 'No' : r === 'partial' ? 'Partial' : 'N/A'; }

  private mut(fn: (c: SowContent) => SowContent): void { this.edited.update((c) => fn({ ...c })); }

  mutTimeline(i: number, f: keyof SowTimelineEntry, v: string): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().map((e, idx) => (idx === i ? { ...e, [f]: v } : e)) } })); }
  // New timeline rows default to the project's event date (DD-Mon-YYYY); most are the event day.
  addTimeline(): void {
    const ev = this.project()?.eventDate;
    const date = ev ? natoDate(ev) : null;
    this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: [...this.timeline(), { date, to: null, from: null, details: null }] } }));
    this.save();
  }
  /** Calendar pick → store the date as DD-Mon-YYYY (the text field keeps free-text too). */
  protected onTimelinePick(i: number, iso: string): void {
    if (!iso) return;
    const [y, m, d] = iso.split('-').map(Number);
    this.mutTimeline(i, 'date', natoDate(new Date(y, m - 1, d).toDateString()));
    this.save();
  }
  removeTimeline(i: number): void { this.mut((c) => ({ ...c, timeline: { ...c.timeline, entries: this.timeline().filter((_, idx) => idx !== i) } })); this.save(); }

  mutPay(i: number, f: keyof SowPaymentRow, v: string): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().map((r, idx) => (idx === i ? ({ ...r, [f]: v } as SowPaymentRow) : r)) } })); }
  addPayment(): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: [...this.payment(), { date: null, grace: null, amount: null, refundable: 'na', details: null }] } })); this.save(); }
  removePayment(i: number): void { this.mut((c) => ({ ...c, payment: { ...c.payment, rows: this.payment().filter((_, idx) => idx !== i) } })); this.save(); }

  // ── Document tree (recursive SowNode) — path-based mutation ───────────────────
  // A path indexes down the tree: [] = the root list, [0] = section 0, [3,2] = its
  // 3rd child, [3,2,0] = a sub-subsection, to any depth.
  private setSections(next: SowNode[]): void { this.mut((c) => ({ ...c, sections: next })); }
  private nodeAt(path: number[]): SowNode | null {
    let arr = this.sections(); let node: SowNode | null = null;
    for (const i of path) { node = arr[i] ?? null; if (!node) return null; arr = node.children; }
    return node;
  }
  /** Immutably transform the node at `path` (return null to remove it). */
  private updateAt(nodes: SowNode[], path: number[], fn: (n: SowNode) => SowNode | null): SowNode[] {
    const [head, ...rest] = path;
    return nodes.flatMap((node, idx) => {
      if (idx !== head) return [node];
      if (!rest.length) { const next = fn(node); return next ? [next] : []; }
      return [{ ...node, children: this.updateAt(node.children, rest, fn) }];
    });
  }
  private patchNode(path: number[], patch: Partial<SowNode>): void {
    this.setSections(this.updateAt(this.sections(), path, (n) => ({ ...n, ...patch })));
  }
  mutNodeTitle(path: number[], title: string): void { this.patchNode(path, { title }); }
  mutNodeNa(path: number[], na: boolean): void { this.patchNode(path, { na }); this.save(); }
  removeNode(path: number[]): void { this.setSections(this.updateAt(this.sections(), path, () => null)); this.save(); }
  /** Append an empty child to the node at `path`; [] appends a top-level section. */
  addChild(path: number[]): void {
    const child: SowNode = { id: globalThis.crypto?.randomUUID?.() ?? `n_${Math.random().toString(36).slice(2)}`, title: path.length ? 'New subsection' : 'New section', text: null, children: [] };
    if (!path.length) { this.setSections([...this.sections(), child]); this.save(); return; }
    this.setSections(this.updateAt(this.sections(), path, (n) => ({ ...n, children: [...n.children, child] })));
    this.save();
  }
  addSection(): void { this.addChild([]); }

  /** Display helper — GBP, no decimals for whole amounts. Empty for null/blank. */
  money(v: number | string | null | undefined): string {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
  }

  async save(): Promise<void> {
    const cur = this.current();
    if (!cur) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const content = this.edited();
      const toSave = content.sections ? { ...content, sections: withIds(content.sections) } : content;
      await firstValueFrom(this.sowSvc.update(cur.id, { content: toSave }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not save');
    } finally {
      this.busy.set(false);
    }
  }

  /** A lifecycle transition (send/revise/accept/decline). */
  async doReview(action: SowReviewAction): Promise<void> {
    const s = this.current();
    if (!s || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.sowSvc.review(s.id, action));
      this.sowsRes.reload();
      this.created.emit(); // nudge the rail pill
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not update the SOW');
    } finally {
      this.busy.set(false);
    }
  }

  async create(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const pre = await firstValueFrom(this.sowSvc.prefill(this.thread().projectId));
      const content: SowContent = { ...buildInitial(pre), sections: withIds(normalizeNodes(this.defaultSections())) };
      await firstValueFrom(this.sowSvc.create({ projectId: this.thread().projectId, name: 'Statement of Work', content }));
      this.sowsRes.reload();
      this.created.emit(); // let the parent refresh the rail node pill
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not create the SOW');
    } finally {
      this.busy.set(false);
    }
  }

  /** Dev/iterate aid: re-runs the same build the create flow uses and PATCHes it
   *  over the existing draft — so we can change the autocreate logic and see the
   *  result without deleting the SOW. Author + draft only. */
  async reset(): Promise<void> {
    const s = this.current();
    if (!s) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const pre = await firstValueFrom(this.sowSvc.prefill(this.thread().projectId));
      await firstValueFrom(this.sowSvc.update(s.id, { content: buildInitial(pre) }));
      this.sowsRes.reload();
    } catch (e) {
      this.error.set(errorDetail(e) || 'Could not reset the SOW');
    } finally {
      this.busy.set(false);
    }
  }

  // prose edit dialog — edits a section's text or a subsection's text
  protected readonly editOpen = signal(false);
  protected readonly editLabel = signal('');
  protected readonly editText = signal('');
  /** The node being viewed, so the dialog can render a table section's table
   *  (read-only) in place of prose. Null for per-item blocks. */
  protected readonly editNode = signal<SowNode | null>(null);
  private editTarget: number[] | null = null;
  private editBlockKey: string | null = null;
  openEditNode(path: number[]): void {
    const n = this.nodeAt(path);
    this.editTarget = path;
    this.editBlockKey = null;
    this.editNode.set(n ?? null);
    this.editLabel.set(n?.title ?? 'Section');
    this.editText.set(n?.text ?? '');
    this.commentAnchor.set(n?.id ?? null); // thread anchors to the node id
    this.commentDraft.set('');
    this.error.set(null);
    this.editOpen.set(true);
  }
  /** Open a derived per-item block (Description/Options/Services): the supplier
   *  edits it (stored as an override, leaving the item's copy untouched); the
   *  agent reads it + comments. Comments anchor to the block key. */
  openEditBlock(key: string, label: string, current: string | null): void {
    this.editTarget = null;
    this.editBlockKey = key;
    this.editNode.set(null);
    this.editLabel.set(label);
    this.editText.set(current ?? '');
    this.commentAnchor.set(key);
    this.commentDraft.set('');
    this.error.set(null);
    this.editOpen.set(true);
  }
  async saveEdit(): Promise<void> {
    if (this.editBlockKey) {
      const key = this.editBlockKey;
      const text = this.editText().trim() || null;
      this.mut((c) => ({ ...c, blockOverrides: { ...(c.blockOverrides ?? {}), [key]: text } }));
      this.editBlockKey = null;
    } else if (this.editTarget) {
      this.patchNode(this.editTarget, { text: this.editText().trim() || null });
    } else {
      return;
    }
    this.editOpen.set(false);
    await this.save();
  }

}

/** Normalise a stored node tree to the current shape: a legacy node carried its
 *  kids in `subs` (→ `children`) and its kind in `table`/`signature` (→ one
 *  `type`). Guarantees every node has a children array. */
/** Seed a stable `id` on every node that lacks one (recursive, immutable). Runs
 *  at create + before each save, so comments can anchor to a section id. */
function withIds(nodes: SowNode[]): SowNode[] {
  return (nodes ?? []).map((n) => ({
    ...n,
    id: n.id ?? (globalThis.crypto?.randomUUID?.() ?? `n_${Math.random().toString(36).slice(2)}`),
    children: withIds(n.children ?? []),
  }));
}

function normalizeNodes(nodes: SowNode[]): SowNode[] {
  return (nodes ?? []).map((raw) => {
    const n = raw as SowNode & { subs?: SowNode[]; table?: SowNodeType; signature?: boolean };
    const kids = n.children ?? n.subs ?? [];
    const type = n.type ?? (n.signature ? 'signature' : (n.table ?? undefined));
    const out: SowNode = { ...n, children: normalizeNodes(kids) };
    if (type) out.type = type; else delete out.type;
    delete (out as { subs?: unknown }).subs;
    delete (out as { table?: unknown }).table;
    delete (out as { signature?: unknown }).signature;
    return out;
  });
}

// The section structure + boilerplate text come from defaultSections() at render
// time (so they keep tracking the codelist until edited); buildInitial seeds only
// the table DATA that needs the project context — the timeline and payment rows.
function buildInitial(pre: SowPrefill): SowContent {
  const p = pre.project;
  // NB: conversation suggestions are NEVER applied here — they're offered as per-item
  // accept/decline options in the suggestion dialog (pV2-SOW AI suggest). This stays
  // the plain default scaffold.
  return {
    timeline: { entries: p?.eventDate ? [{ date: p.eventDate, to: null, from: null, details: null }] : [] },
    payment: {
      rows: [
        { date: 'SOW date', grace: '3 days', amount: '50%', refundable: 'na', details: null },
        { date: 'Event date', grace: '7 days', amount: '50%', refundable: 'na', details: null },
      ],
    },
  };
}
