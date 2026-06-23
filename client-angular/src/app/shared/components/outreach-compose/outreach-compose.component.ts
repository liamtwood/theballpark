import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { OutreachService, OutreachRequest } from '../../../core/services/outreach.service';
import { ApiService } from '../../../core/services/api.service';
import { ProjectService } from '../../../core/services/project.service';
import { GbpPipe } from '../../pipes/gbp.pipe';

interface SupplierRow {
  supplier_id: string;
  supplier_name: string;
  city?: string;
  description?: string;
  item_count?: number;
}

/**
 * v1.50 — Competitive-quote outreach drawer (shared component).
 *
 * ONE drawer, three steps, a step train pinned at the top:
 *   1 · Suppliers      — who to send the brief to
 *   2 · Requirements   — the agency's brief + event context, editable
 *   3 · Email          — the composed message, editable before send
 * (then a sent-confirmation state)
 *
 * Mounted once in app-shell; opened from any surface via
 * OutreachService.open({ item, categoryId, projectId, suppliers }).
 * On send it posts to /taxonomy/request-quotes — one Ball, one message +
 * message_items per supplier, one quote_request per (item × supplier).
 */
@Component({
  selector: 'app-outreach-compose',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, SidebarModule, LucideAngularModule, GbpPipe],
  template: `
    <p-sidebar [visible]="!!req" (visibleChange)="onVisibleChange($event)"
               position="right" [style]="{ width: '600px', maxWidth: '96vw' }"
               [showCloseIcon]="false" [dismissible]="true" styleClass="bp-oc-drawer">
      <div class="bp-oc" *ngIf="req as r">

        <!-- ── STEP TRAIN ── -->
        <div class="bp-oc-train">
          <ng-container *ngFor="let t of trainSteps; let i = index; let last = last">
            <div class="bp-oc-tnode"
                 [class.done]="step > t.n" [class.on]="step === t.n">
              <div class="bp-oc-tcirc">
                <span *ngIf="step > t.n">✓</span>
                <span *ngIf="step <= t.n">{{ t.n }}</span>
              </div>
              <div class="bp-oc-tlbl">{{ t.label }}</div>
            </div>
            <div *ngIf="!last" class="bp-oc-tline" [class.done]="step > t.n"></div>
          </ng-container>
        </div>

        <!-- ── HEADER ── -->
        <div class="bp-oc-head">
          <div>
            <div class="bp-oc-eyebrow">Request quotes</div>
            <div class="bp-oc-title">{{ r.item.name }}</div>
            <div class="bp-oc-sub">{{ r.categoryName || 'Category outreach' }}</div>
          </div>
          <button type="button" class="bp-oc-x" (click)="close()">✕</button>
        </div>

        <!-- ── LOADING ── -->
        <div *ngIf="loading" class="bp-oc-loading">Loading suppliers…</div>

        <ng-container *ngIf="!loading">

          <!-- ════ STEP 1 — SUPPLIERS ════ -->
          <ng-container *ngIf="step === 1">
            <div class="bp-oc-body">
              <div class="bp-oc-sec">Your requirement</div>
              <div class="bp-oc-reqcard">
                <div class="bp-oc-reqic">{{ catLetter(r.item.name) }}</div>
                <div class="bp-oc-reqmid">
                  <div class="bp-oc-reqname">{{ r.item.name }}</div>
                  <div class="bp-oc-reqsub" *ngIf="r.item.isNew">New item — proposed</div>
                  <div class="bp-oc-reqsub" *ngIf="!r.item.isNew && r.item.description">
                    {{ r.item.description }}
                  </div>
                </div>
                <div class="bp-oc-reqprice" *ngIf="r.item.price != null">
                  {{ r.item.isNew ? '~ ' : '' }}{{ r.item.price | gbp }}
                </div>
              </div>

              <div class="bp-oc-sechdr">
                <span class="bp-oc-sec">Send to · {{ selectedCount }} of {{ suppliers.length }}</span>
              </div>

              <div *ngIf="!suppliers.length" class="bp-oc-empty">
                No suppliers in this category yet.
              </div>

              <div *ngFor="let s of suppliers"
                   class="bp-oc-scard" [class.sel]="selected.has(s.supplier_id)"
                   (click)="toggleSupplier(s.supplier_id)">
                <div class="bp-oc-check" [class.on]="selected.has(s.supplier_id)">
                  <span *ngIf="selected.has(s.supplier_id)">✓</span>
                </div>
                <div class="bp-oc-smid">
                  <div class="bp-oc-sname">{{ s.supplier_name }}</div>
                  <div class="bp-oc-smeta">
                    <span *ngIf="s.city">📍 {{ s.city }}</span>
                    <span *ngIf="s.item_count">· {{ s.item_count }} item{{ s.item_count === 1 ? '' : 's' }} in this category</span>
                  </div>
                  <div class="bp-oc-sdesc" *ngIf="s.description">{{ s.description }}</div>
                </div>
              </div>
            </div>
            <div class="bp-oc-foot">
              <button type="button" class="bp-oc-btn-primary"
                      [disabled]="!selectedCount" (click)="goStep(2)">
                {{ selectedCount
                    ? 'Send brief to ' + selectedCount + ' supplier' + (selectedCount === 1 ? '' : 's') + ' →'
                    : 'Select at least one supplier' }}
              </button>
              <span class="bp-oc-foot-note">Uses 1 ball</span>
            </div>
          </ng-container>

          <!-- ════ STEP 2 — REQUIREMENTS ════ -->
          <ng-container *ngIf="step === 2">
            <div class="bp-oc-substep">
              <div class="bp-oc-substep-t">Your requirements</div>
              <div class="bp-oc-substep-s">These go straight into the email to suppliers</div>
            </div>
            <div class="bp-oc-body">
              <!-- v1.65em (cart path) — items list + ad-hoc input.
                   Renders cart rows like the cart drawer (image, name,
                   line total) plus an "Add additional ask" input the
                   agent can use to append title-only requirements
                   (e.g. "open bar for cocktails").
                   v1.65en — greeting moved to the TOP so the form
                   order mirrors the email order (greeting → items
                   → notes). -->
              <ng-container *ngIf="hasCartItems">
                <div class="bp-oc-flabel">Greeting</div>
                <textarea class="bp-oc-input bp-oc-textarea" rows="3" [(ngModel)]="details"
                          placeholder="Ryan, event details are attached. Need this estimate fast — venue likely a museum or large indoor space."></textarea>

                <div class="bp-oc-flabel" style="margin-top:18px">Items in this brief</div>
                <div class="bp-oc-itemlist">
                  <div *ngFor="let it of cartItems" class="bp-oc-itemrow">
                    <div class="bp-oc-itemimg"
                         [style.background-image]="it.image_url ? 'url(' + it.image_url + ')' : null">
                      <span *ngIf="!it.image_url">{{ catLetter(it.name) }}</span>
                    </div>
                    <div class="bp-oc-itembody">
                      <div class="bp-oc-itemname">{{ it.name }}</div>
                      <div class="bp-oc-itemsupp" *ngIf="it.supplier_name">{{ it.supplier_name }}</div>
                    </div>
                    <div class="bp-oc-itemprice" *ngIf="it.line_total != null">
                      £{{ (it.line_total || 0) | number:'1.0-0' }}
                    </div>
                  </div>

                  <!-- Ad-hoc rows the agent added in this session. -->
                  <div *ngFor="let a of adhocItems; let i = index"
                       class="bp-oc-itemrow bp-oc-itemrow--adhoc">
                    <div class="bp-oc-itemimg bp-oc-itemimg--adhoc">
                      <lucide-icon name="sparkles" [size]="14"></lucide-icon>
                    </div>
                    <div class="bp-oc-itembody">
                      <div class="bp-oc-itemname">{{ a.name }}</div>
                      <div class="bp-oc-itemsupp">Additional ask</div>
                    </div>
                    <button type="button" class="bp-oc-itemrm" (click)="removeAdhoc(i)" title="Remove">
                      <lucide-icon name="x" [size]="13"></lucide-icon>
                    </button>
                  </div>
                </div>

                <!-- Add-item input — title-only. Press Enter or click + to commit. -->
                <div class="bp-oc-addrow">
                  <input class="bp-oc-input bp-oc-addinput"
                         type="text"
                         [(ngModel)]="newAdhocName"
                         (keyup.enter)="addAdhoc()"
                         placeholder="Add another ask (e.g. open bar for cocktails)"/>
                  <button type="button"
                          class="bp-oc-addbtn"
                          [disabled]="!newAdhocName.trim()"
                          (click)="addAdhoc()">
                    <lucide-icon name="plus" [size]="14"></lucide-icon>
                    Add
                  </button>
                </div>

                <!-- v1.65en — Greeting moved to the top of the form (above
                     items). The trailing duplicate has been removed. -->
              </ng-container>

              <!-- Legacy free-text path (per-item / per-category outreach). -->
              <ng-container *ngIf="!hasCartItems">
                <div class="bp-oc-flabel">One-line requirement</div>
                <textarea class="bp-oc-input bp-oc-textarea" rows="2" [(ngModel)]="oneLiner"
                          placeholder="e.g. Indoor LED wall &amp; PA for a 250-guest launch"></textarea>

                <div class="bp-oc-flabel">Additional details</div>
                <textarea class="bp-oc-input bp-oc-textarea" rows="4" [(ngModel)]="details"
                          placeholder="Specs, quantities, brand requirements — anything the supplier needs to quote accurately."></textarea>
              </ng-container>

              <div class="bp-oc-evbox">
                <div class="bp-oc-evhd">Event context</div>
                <div class="bp-oc-evrow">
                  <span class="bp-oc-evk">Date</span>
                  <input type="text" [(ngModel)]="evDate" placeholder="TBC" />
                </div>
                <div class="bp-oc-evrow">
                  <span class="bp-oc-evk">Venue</span>
                  <input type="text" [(ngModel)]="evVenue" placeholder="TBC" />
                </div>
                <div class="bp-oc-evrow">
                  <span class="bp-oc-evk">Guests</span>
                  <input type="text" [(ngModel)]="evGuests" placeholder="TBC" />
                </div>
              </div>

              <div class="bp-oc-ballnote">
                🎱 This will use <b>1 ball</b> — sent to {{ selectedCount }} supplier{{ selectedCount === 1 ? '' : 's' }}.
              </div>
            </div>
            <div class="bp-oc-foot">
              <button type="button" class="bp-oc-btn-ghost" (click)="goStep(1)">← Back</button>
              <button type="button" class="bp-oc-btn-primary" (click)="goStep(3)">Review email →</button>
            </div>
          </ng-container>

          <!-- ════ STEP 3 — EMAIL ════ -->
          <ng-container *ngIf="step === 3">
            <div class="bp-oc-substep">
              <div class="bp-oc-substep-t">Review email</div>
              <div class="bp-oc-substep-s">Edit anything before it sends</div>
            </div>
            <div class="bp-oc-body bp-oc-compose">
              <!-- v1.51a — each supplier gets a SEPARATE private email; the
                   recipients are shown as individual chips, never a CC list. -->
              <div class="bp-oc-cline bp-oc-cline-to">
                <span class="bp-oc-ck">To</span>
                <div class="bp-oc-tochips">
                  <span class="bp-oc-tochip" *ngFor="let s of selectedSuppliers">{{ s.supplier_name }}</span>
                </div>
              </div>
              <div class="bp-oc-tonote">
                <span>✉</span>
                <span>Sent as {{ selectedCount }} separate email{{ selectedCount === 1 ? '' : 's' }}
                  — each supplier gets their own private copy and can't see the others.</span>
              </div>
              <div class="bp-oc-cline">
                <span class="bp-oc-ck">Subject</span>
                <input class="bp-oc-cinput" type="text" [(ngModel)]="subject" />
              </div>
              <textarea class="bp-oc-cbody" [(ngModel)]="emailBody"></textarea>
            </div>
            <div class="bp-oc-foot">
              <button type="button" class="bp-oc-btn-ghost" (click)="goStep(2)">← Back</button>
              <button type="button" class="bp-oc-btn-primary" (click)="confirmingSend = true">
                Send brief →
              </button>
            </div>
          </ng-container>

          <!-- ════ STEP 4 — SENT ════ -->
          <ng-container *ngIf="step === 4">
            <div class="bp-oc-body">
              <div class="bp-oc-sent">
                <div class="bp-oc-sent-ok">✓</div>
                <div class="bp-oc-sent-h">Brief sent to {{ selectedCount }} supplier{{ selectedCount === 1 ? '' : 's' }}</div>
                <div class="bp-oc-sent-p">1 ball used. They'll be in touch — supplier replies land in the inbox.</div>
              </div>
              <div class="bp-oc-recap">
                <div class="bp-oc-sec" style="margin-bottom:8px;">Out for quote</div>
                <div *ngFor="let s of selectedSuppliers" class="bp-oc-recap-row">
                  <span class="bp-oc-recap-dot"></span>{{ s.supplier_name }}
                  <span class="bp-oc-recap-st">pending</span>
                </div>
              </div>
            </div>
            <div class="bp-oc-foot">
              <button type="button" class="bp-oc-btn-primary" (click)="close()">Done</button>
            </div>
          </ng-container>

        </ng-container>

        <!-- v1.51e — "use 1 ball?" confirmation before the brief sends -->
        <div class="bp-oc-confirm" *ngIf="confirmingSend">
          <div class="bp-oc-confirm-card">
            <div class="bp-oc-confirm-ic">🎱</div>
            <div class="bp-oc-confirm-h">Send brief — use 1 ball?</div>
            <div class="bp-oc-confirm-p">
              This sends the brief to {{ selectedCount }} supplier{{ selectedCount === 1 ? '' : 's' }}
              and uses <b>1 ball</b><span *ngIf="ballsBalance != null"> — you'll have
              {{ ballsBalance > 0 ? ballsBalance - 1 : 0 }} left</span>.
            </div>
            <div class="bp-oc-confirm-actions">
              <button type="button" class="bp-oc-btn-ghost"
                      [disabled]="sending" (click)="confirmingSend = false">Cancel</button>
              <button type="button" class="bp-oc-btn-primary"
                      [disabled]="sending" (click)="send()">
                {{ sending ? 'Sending…' : 'Confirm & send' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </p-sidebar>
  `,
  styles: [`
    :host ::ng-deep .bp-oc-drawer .p-sidebar-content { padding: 0; height: 100%; }
    .bp-oc { display: flex; flex-direction: column; height: 100%; position: relative;
      font-family: var(--font-body); background: var(--color-surface); }

    /* ball-spend confirmation overlay */
    .bp-oc-confirm { position: absolute; inset: 0; z-index: 20; display: flex;
      align-items: center; justify-content: center; padding: 28px;
      background: rgba(20,20,18,0.4); }
    .bp-oc-confirm-card { background: var(--color-surface); border-radius: 12px;
      padding: 24px 22px; max-width: 320px; width: 100%; text-align: center;
      box-shadow: 0 18px 48px rgba(0,0,0,0.22); }
    .bp-oc-confirm-ic { font-size: 30px; margin-bottom: 10px; }
    .bp-oc-confirm-h { font-family: var(--font-display); font-size: 18px;
      color: var(--color-text-primary); }
    .bp-oc-confirm-p { font-size: 12px; color: var(--color-text-secondary);
      line-height: 1.6; margin-top: 7px; }
    .bp-oc-confirm-actions { display: flex; gap: 8px; margin-top: 18px; }
    .bp-oc-confirm-actions .bp-oc-btn-ghost,
    .bp-oc-confirm-actions .bp-oc-btn-primary { flex: 1; }

    /* train */
    .bp-oc-train { display: flex; align-items: flex-start; padding: 16px 24px 4px; flex-shrink: 0; }
    .bp-oc-tnode { display: flex; flex-direction: column; align-items: center; gap: 6px;
      width: 84px; flex-shrink: 0; }
    .bp-oc-tcirc { width: 28px; height: 28px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
      background: var(--color-fill); border: 1.5px solid var(--color-border);
      color: var(--color-text-muted); transition: all 0.15s; }
    .bp-oc-tlbl { font-size: 10px; font-weight: 600; color: var(--color-text-muted); text-align: center; }
    .bp-oc-tnode.on .bp-oc-tcirc { background: var(--theme-accent); border-color: var(--theme-accent);
      color: #fff; box-shadow: 0 0 0 4px var(--color-focus-ring); }
    .bp-oc-tnode.on .bp-oc-tlbl { color: var(--theme-accent); }
    .bp-oc-tnode.done .bp-oc-tcirc { background: var(--theme-accent);
      border-color: var(--theme-accent); color: #fff; }
    .bp-oc-tnode.done .bp-oc-tlbl { color: var(--color-text-secondary); }
    .bp-oc-tline { flex: 1; height: 2px; background: var(--color-border);
      margin-top: 13px; border-radius: 2px; transition: background 0.15s; }
    .bp-oc-tline.done { background: var(--theme-accent); }

    /* header */
    .bp-oc-head { display: flex; justify-content: space-between; align-items: flex-start;
      padding: 6px 24px 14px; border-bottom: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-oc-eyebrow { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--theme-accent); }
    .bp-oc-title { font-family: var(--font-display); font-size: 19px;
      color: var(--color-text-primary); margin-top: 2px; line-height: 1.25; }
    .bp-oc-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }
    .bp-oc-x { background: none; border: none; font-size: 19px; line-height: 1;
      color: var(--color-text-muted); cursor: pointer; }

    .bp-oc-loading { padding: 40px 24px; text-align: center; font-size: 12.5px;
      color: var(--color-text-muted); }

    /* sub-step header (steps 2 & 3) */
    .bp-oc-substep { padding: 13px 24px; border-bottom: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-oc-substep-t { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
    .bp-oc-substep-s { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }

    .bp-oc-body { flex: 1; overflow-y: auto; padding: 16px 24px; }
    .bp-oc-sec { font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--color-text-muted); }
    .bp-oc-sechdr { margin: 16px 0 9px; }
    .bp-oc-empty { font-size: 12px; color: var(--color-text-muted); font-style: italic;
      text-align: center; padding: 22px; border: 0.5px dashed var(--color-border); border-radius: 8px; }

    /* requirement card */
    .bp-oc-reqcard { display: flex; align-items: center; gap: 11px; margin-top: 9px;
      border: 0.5px solid var(--theme-border); background: var(--color-fill);
      border-radius: 9px; padding: 11px 13px; }
    .bp-oc-reqic { width: 34px; height: 34px; border-radius: 7px; flex-shrink: 0;
      background: var(--theme-accent); color: #fff; display: flex; align-items: center;
      justify-content: center; font-family: var(--font-display); font-size: 14px; }
    .bp-oc-reqmid { flex: 1; min-width: 0; }
    .bp-oc-reqname { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-oc-reqsub { font-size: 10.5px; color: var(--color-text-muted); margin-top: 2px;
      line-height: 1.5; }
    .bp-oc-reqprice { font-family: var(--font-display); font-size: 14px;
      color: var(--color-text-primary); flex-shrink: 0; }

    /* supplier cards */
    .bp-oc-scard { display: flex; gap: 11px; align-items: flex-start;
      border: 1.5px solid var(--color-border); border-radius: 10px;
      padding: 11px 13px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.12s; }
    .bp-oc-scard:hover { border-color: var(--theme-border); }
    .bp-oc-scard.sel { border-color: var(--theme-accent); background: var(--color-fill); }
    .bp-oc-check { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      display: flex; align-items: center; justify-content: center; font-size: 11px;
      color: #fff; margin-top: 1px; }
    .bp-oc-check.on { background: var(--theme-accent); border-color: var(--theme-accent); }
    .bp-oc-smid { flex: 1; min-width: 0; }
    .bp-oc-sname { font-family: var(--font-display); font-size: 13.5px;
      color: var(--color-text-primary); }
    .bp-oc-smeta { font-size: 10px; color: var(--color-text-muted); margin-top: 2px;
      display: flex; gap: 4px; flex-wrap: wrap; }
    .bp-oc-sdesc { font-size: 11px; color: var(--color-text-secondary);
      line-height: 1.5; margin-top: 5px; }

    /* footer */
    .bp-oc-foot { display: flex; align-items: center; gap: 12px;
      padding: 14px 24px; border-top: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-oc-btn-primary { flex: 1; font-family: var(--font-body); font-size: 13px;
      font-weight: 600; color: #fff; background: var(--theme-accent); border: none;
      padding: 11px; border-radius: 9px; cursor: pointer; transition: filter 0.15s; }
    .bp-oc-btn-primary:hover:not(:disabled) { filter: brightness(1.07); }
    .bp-oc-btn-primary:disabled { background: var(--color-border);
      color: var(--color-text-muted); cursor: default; }
    .bp-oc-btn-ghost { font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
      color: var(--color-text-secondary); background: var(--color-surface);
      border: 0.5px solid var(--color-border); padding: 11px 18px; border-radius: 9px; cursor: pointer; }
    .bp-oc-foot-note { font-size: 11px; color: var(--color-text-muted); }

    /* requirements form */
    .bp-oc-flabel { font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: var(--color-text-secondary);
      margin: 14px 0 5px; }
    .bp-oc-flabel:first-child { margin-top: 0; }
    .bp-oc-input { width: 100%; font-family: var(--font-body); font-size: 12.5px;
      color: var(--color-text-primary); background: var(--color-fill);
      border: 0.5px solid var(--color-border); border-radius: 7px; padding: 9px 11px; outline: none; }
    .bp-oc-input:focus { border-color: var(--theme-accent); background: var(--color-surface); }
    .bp-oc-textarea { resize: vertical; line-height: 1.55; }

    /* v1.65em — cart-mode item list (step 2). Same visual language
       as the cart drawer's bp-cd-row so the agent recognises what
       they're sending. */
    .bp-oc-itemlist {
      display: flex; flex-direction: column;
      border: 0.5px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
    }
    .bp-oc-itemrow {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border-bottom: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }
    .bp-oc-itemrow:last-child { border-bottom: none; }
    .bp-oc-itemrow--adhoc { background: var(--theme-soft); }
    .bp-oc-itemimg {
      width: 32px; height: 32px;
      border-radius: 6px;
      background-color: var(--color-fill);
      background-size: cover;
      background-position: center;
      display: flex; align-items: center; justify-content: center;
      color: var(--theme-accent);
      font-weight: 600;
      font-size: 13px;
      flex-shrink: 0;
    }
    .bp-oc-itemimg--adhoc {
      background: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-oc-itembody {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 1px;
    }
    .bp-oc-itemname {
      font-size: 13px; font-weight: 500;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-oc-itemsupp {
      font-size: 10.5px; color: var(--color-text-muted);
    }
    .bp-oc-itemprice {
      font-size: 13px; font-weight: 500;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .bp-oc-itemrm {
      width: 24px; height: 24px;
      background: transparent; border: none; cursor: pointer;
      color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center;
      border-radius: 4px;
    }
    .bp-oc-itemrm:hover { color: var(--theme-accent); background: var(--color-fill); }

    /* Add-item input row */
    .bp-oc-addrow {
      display: flex; gap: 8px;
      margin-top: 10px;
    }
    .bp-oc-addinput { flex: 1; }
    .bp-oc-addbtn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 8px 14px;
      background: var(--theme-accent);
      color: var(--color-surface);
      border: none; border-radius: 7px;
      font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .bp-oc-addbtn:disabled { opacity: 0.4; cursor: not-allowed; }
    .bp-oc-addbtn:hover:not(:disabled) { opacity: 0.85; }
    .bp-oc-evbox { border: 0.5px solid var(--color-border); border-radius: 8px;
      overflow: hidden; margin-top: 16px; }
    .bp-oc-evhd { padding: 7px 13px; background: var(--color-fill);
      border-bottom: 0.5px solid var(--color-border); font-size: 9px; font-weight: 700;
      letter-spacing: 0.07em; text-transform: uppercase; color: var(--color-text-muted); }
    .bp-oc-evrow { display: flex; align-items: center; border-bottom: 0.5px solid var(--color-border); }
    .bp-oc-evrow:last-child { border-bottom: none; }
    .bp-oc-evk { width: 62px; padding: 8px 13px; font-size: 10.5px; font-weight: 600;
      color: var(--color-text-secondary); background: var(--color-fill);
      border-right: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-oc-evrow input { flex: 1; padding: 8px 12px; border: none; outline: none;
      font-family: var(--font-body); font-size: 12px; color: var(--color-text-primary);
      background: var(--color-surface); }
    .bp-oc-ballnote { background: var(--color-fill); border: 0.5px solid var(--theme-border);
      border-radius: 8px; padding: 10px 13px; font-size: 11.5px;
      color: var(--color-text-secondary); margin-top: 16px; }

    /* compose — flex column so the body textarea fills the drawer */
    .bp-oc-compose { padding: 0; display: flex; flex-direction: column; overflow: hidden; }
    .bp-oc-cline { display: flex; align-items: baseline; gap: 8px; padding: 11px 24px;
      border-bottom: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-oc-cline-to { align-items: flex-start; }
    .bp-oc-ck { font-size: 12px; color: var(--color-text-muted); width: 52px; flex-shrink: 0; }
    .bp-oc-cinput { flex: 1; border: none; outline: none; font-family: var(--font-body);
      font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); background: none; }
    .bp-oc-tochips { display: flex; flex-wrap: wrap; gap: 5px; }
    .bp-oc-tochip { font-size: 11px; font-weight: 600; color: var(--color-text-primary);
      background: var(--color-fill); border: 0.5px solid var(--theme-border);
      border-radius: 20px; padding: 3px 10px; }
    .bp-oc-tonote { display: flex; gap: 6px; padding: 8px 24px; flex-shrink: 0;
      border-bottom: 0.5px solid var(--color-border); font-size: 10.5px;
      color: var(--color-text-muted); line-height: 1.5; }
    .bp-oc-cbody { flex: 1; width: 100%; border: none; outline: none; resize: none;
      font-family: var(--font-body); font-size: 12.5px; line-height: 1.7;
      color: var(--color-text-secondary); padding: 15px 24px; }

    /* sent */
    .bp-oc-sent { text-align: center; padding: 26px 16px 8px; }
    .bp-oc-sent-ok { width: 50px; height: 50px; border-radius: 50%; margin: 0 auto 13px;
      background: var(--color-fill); color: var(--theme-accent); display: flex;
      align-items: center; justify-content: center; font-size: 24px; }
    .bp-oc-sent-h { font-family: var(--font-display); font-size: 19px; color: var(--color-text-primary); }
    .bp-oc-sent-p { font-size: 12px; color: var(--color-text-secondary); margin-top: 5px;
      line-height: 1.6; }
    .bp-oc-recap { margin-top: 18px; border: 0.5px solid var(--color-border);
      border-radius: 10px; padding: 13px 15px; }
    .bp-oc-recap-row { display: flex; align-items: center; gap: 8px; font-size: 12px;
      color: var(--color-text-primary); padding: 4px 0; }
    .bp-oc-recap-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--theme-accent); }
    .bp-oc-recap-st { margin-left: auto; font-size: 11px; color: var(--color-text-muted); }
  `]
})
export class OutreachComposeComponent implements OnInit, OnDestroy {
  req: OutreachRequest | null = null;
  step = 1;
  loading = false;
  sending = false;
  /** v1.51e — the "use 1 ball?" confirmation gate before the brief sends. */
  confirmingSend = false;
  ballsBalance: number | null = null;

  readonly trainSteps = [
    { n: 1, label: 'Suppliers' },
    { n: 2, label: 'Requirements' },
    { n: 3, label: 'Email' }
  ];

  suppliers: SupplierRow[] = [];
  selected = new Set<string>();

  oneLiner = '';
  details = '';
  evDate = '';
  evVenue = '';
  evGuests = '';

  subject = '';
  emailBody = '';

  /** v1.65em — when the outreach is opened from the cart (req.cartItems
      is set), step 2 renders these rows + an "Add additional ask"
      input. adhocItems collects what the agent types in that input.
      cartItems are read-only references to the project's cart. */
  cartItems: import('../../../core/services/outreach.service').OutreachCartItem[] = [];
  adhocItems: { name: string }[] = [];
  newAdhocName = '';
  guestCountHint = 0;

  /** Drives step 2's items panel — true when the outreach was opened
      from a cart (vs the legacy single-item per-category flow). */
  get hasCartItems(): boolean { return this.cartItems.length > 0; }

  private agencyName = '';
  private agencyEmail = '';
  private projectRef = '';
  private sub?: Subscription;

  constructor(
    private outreach: OutreachService,
    private api: ApiService,
    private projSvc: ProjectService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.outreach.request$.subscribe(req => {
      this.req = req;
      if (req) this.onOpen(req);
      this.cdr.markForCheck();
    });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── Derived ───────────────────────────────────────────────────────────
  get selectedCount(): number { return this.selected.size; }
  get selectedSuppliers(): SupplierRow[] {
    return this.suppliers.filter(s => this.selected.has(s.supplier_id));
  }
  catLetter(name?: string): string { return (name || '?').charAt(0).toUpperCase(); }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  private onOpen(req: OutreachRequest): void {
    this.step = 1;
    this.loading = true;
    this.sending = false;
    this.confirmingSend = false;
    this.ballsBalance = null;
    this.suppliers = [];
    this.selected.clear();
    this.oneLiner = (req.item.description || '').trim();
    this.details = '';
    this.evDate = this.evVenue = this.evGuests = '';
    this.subject = this.emailBody = '';
    this.agencyName = '';
    this.agencyEmail = '';
    // v1.65em — cart-mode wiring. cartItems are read-only mirrors of
    // the project's cart selection at open time; adhocItems is a
    // fresh array the agent fills via the "Add additional ask"
    // input in step 2.
    this.cartItems = (req.cartItems || []).map(it => ({ ...it }));
    // v1.65ep — pre-seed adhocItems[] from req.adhocAsks (ad-hoc
    // asks the agent already added in the cart drawer's ADDITIONAL
    // ASKS section). They show as the same ad-hoc rows in step 2;
    // agent can remove or add more.
    this.adhocItems = (req.adhocAsks || []).map(name => ({ name }));
    this.newAdhocName = '';
    this.guestCountHint = req.guestCount || 0;
    // When opened with cartItems, the per-item bullet description
    // synthesised by the legacy single-item path is redundant — the
    // structured list renders it visually instead.
    if (this.cartItems.length) this.oneLiner = '';

    forkJoin({
      project: this.projSvc.getById(req.projectId).pipe(catchError(() => of(null as any))),
      suppliers: this.api.get<SupplierRow[]>(
        `/taxonomy/category-suppliers?category_id=${req.categoryId}`
      ).pipe(catchError(() => of([] as SupplierRow[])))
    }).subscribe(({ project, suppliers }) => {
      // Event context — pre-filled from the project.
      if (project) {
        this.evDate = project.event_date || '';
        this.evVenue = [project.venue_name, project.venue_city].filter(Boolean).join(', ');
        this.evGuests = project.guest_count != null ? String(project.guest_count) : '';
        this.projectRef = project.ref || '';
        this.fetchAgencyName(project.org_id);
      }
      // Suppliers — AI-ranked first + pre-ticked when a ranking was passed.
      this.suppliers = this.orderSuppliers(suppliers || [], req);
      const ranked = new Set((req.suppliers || []).map(s => s.supplier_id));
      for (const s of this.suppliers) {
        if (ranked.size ? ranked.has(s.supplier_id) : true) this.selected.add(s.supplier_id);
      }
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  private orderSuppliers(rows: SupplierRow[], req: OutreachRequest): SupplierRow[] {
    const rank = new Map((req.suppliers || []).map((s, i) => [s.supplier_id, i]));
    return [...rows].sort((a, b) => {
      const ra = rank.has(a.supplier_id) ? rank.get(a.supplier_id)! : 999;
      const rb = rank.has(b.supplier_id) ? rank.get(b.supplier_id)! : 999;
      if (ra !== rb) return ra - rb;
      return (b.item_count || 0) - (a.item_count || 0);
    });
  }

  private fetchAgencyName(orgId?: string): void {
    if (!orgId) return;
    this.api.get<any>(`/orgs/${orgId}`).pipe(catchError(() => of(null))).subscribe(org => {
      if (org) {
        if (org.name)  this.agencyName  = org.name;
        if (org.email) this.agencyEmail = org.email;
        if (org.balls_balance != null) this.ballsBalance = Number(org.balls_balance);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Steps ─────────────────────────────────────────────────────────────
  goStep(n: number): void {
    if (n === 3) this.buildEmail();
    this.step = n;
    this.cdr.markForCheck();
  }

  toggleSupplier(id: string): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.cdr.markForCheck();
  }

  // v1.65em — ad-hoc item handlers for step 2's "Add additional ask"
  // input. Title-only entries; suppliers see them as bullet items
  // alongside the cart rows in the email body.
  addAdhoc(): void {
    const name = (this.newAdhocName || '').trim();
    if (!name) return;
    this.adhocItems.push({ name });
    this.newAdhocName = '';
    this.cdr.markForCheck();
  }
  removeAdhoc(idx: number): void {
    this.adhocItems.splice(idx, 1);
    this.cdr.markForCheck();
  }

  /** v1.65em — formatted bullet line for a cart row in the email
      body.
      v1.65en — tightened for the WhatsApp-style template: just the
      item name, no price math leak. Suppliers quote against THEIR
      catalogue, so showing the agent's expected line total feels
      odd ("I want to pay you exactly £21,250" undercuts the
      negotiation). Pricing comes back in their reply. */
  private cartItemLine(it: import('../../../core/services/outreach.service').OutreachCartItem): string {
    return `• ${it.name}`;
  }

  /** v1.65en — one-line event context for the email body, formatted
      as a natural sentence rather than a stacked Date/Venue/Guests
      block. Falls back gracefully when fields are missing. */
  private eventContextLine(): string {
    const parts: string[] = [];
    if (this.evDate) parts.push(this.evDate);
    if (this.evGuests) parts.push(`${this.evGuests} guests`);
    if (this.evVenue) parts.push(this.evVenue);
    return parts.join(' · ');
  }

  private buildEmail(): void {
    const r = this.req!;
    // Project ref leads the subject so suppliers can file the quote
    // against the right job.
    this.subject = (this.projectRef ? this.projectRef + ' — ' : '') + `Brief: ${r.item.name}`;

    // v1.65en — WhatsApp-style template:
    //   {greeting}
    //
    //   Quick brief for {date} · {N guests} · {venue}:
    //   • item
    //   • item
    //
    //   Send price + lead time?
    //
    //   {agencyName}
    //   {agencyEmail}
    //
    // Legacy fallback (no cartItems): keeps the old prose opener so
    // per-item recommend flows from the Brief tab stay sensible.
    const greeting = (this.details || '').trim();
    const itemBullets: string[] = [];
    if (this.cartItems.length) {
      itemBullets.push(...this.cartItems.map(it => this.cartItemLine(it)));
    }
    if (this.adhocItems.length) {
      itemBullets.push(...this.adhocItems.map(a => `• ${a.name}`));
    }
    if (!this.cartItems.length && this.oneLiner && this.oneLiner.trim()) {
      itemBullets.push(this.oneLiner.trim());
    }

    const eventLine = this.eventContextLine();
    const signoff: string[] = [this.agencyName || 'The team'];
    if (this.agencyEmail) signoff.push(this.agencyEmail);

    const blocks: string[] = [];
    if (this.hasCartItems) {
      // Cart-launched: tighter WhatsApp shape.
      if (greeting) blocks.push(greeting);
      const briefLead = eventLine
        ? `Quick brief — ${eventLine}:`
        : 'Quick brief:';
      blocks.push(itemBullets.length ? `${briefLead}\n${itemBullets.join('\n')}` : briefLead);
      blocks.push('Send price + lead time when you can?');
      blocks.push(signoff.join('\n'));
    } else {
      // Legacy single-item recommend flow.
      blocks.push('Hi,');
      blocks.push(`We're sourcing quotes for ${r.item.name} for an upcoming event and would like to include you.`);
      if (itemBullets.length) blocks.push(`What we need\n${itemBullets.join('\n')}`);
      const eventDetails = [
        this.evDate   ? `Date: ${this.evDate}`     : '',
        this.evVenue  ? `Venue: ${this.evVenue}`   : '',
        this.evGuests ? `Guests: ${this.evGuests}` : ''
      ].filter(Boolean).join('\n');
      if (eventDetails) blocks.push(`Event details\n${eventDetails}`);
      blocks.push('Could you send your price and lead time at your earliest convenience?');
      blocks.push(['Many thanks,', ...signoff].join('\n'));
    }

    this.emailBody = blocks.join('\n\n');
  }

  // ── Send ──────────────────────────────────────────────────────────────
  send(): void {
    const r = this.req;
    if (!r || this.sending || !this.selectedCount) return;
    this.sending = true;
    this.cdr.markForCheck();

    // v1.65eo — cart-launched outreaches send EACH cart row + EACH
    // ad-hoc ask as its own requirement, so the server creates one
    // message_item per ask. That's what the supplier needs in order
    // to accept/decline/adjust each line independently in the
    // conversation panel.
    //
    // Legacy per-item flow (Brief tab → recommend) still sends a
    // single requirement.
    let requirements: any[];
    if (this.hasCartItems) {
      const cartReqs = this.cartItems.map(it => {
        if (it.item_id) {
          return { kind: 'matched', item_id: it.item_id };
        }
        return {
          kind: 'new',
          name: it.name,
          description: it.description || '',
          estimated_price: Number(it.base_price) || 0,
        };
      });
      const adhocReqs = this.adhocItems.map(a => ({
        kind: 'new',
        name: a.name,
        description: '',
        estimated_price: 0,
      }));
      requirements = [...cartReqs, ...adhocReqs];
    } else {
      const single = (r.item.isNew || !r.item.item_id)
        ? {
            kind: 'new',
            name: r.item.name,
            description: [this.oneLiner, this.details].filter(t => t && t.trim()).join('\n\n')
              || r.item.description || '',
            estimated_price: r.item.price ?? 0
          }
        : { kind: 'matched', item_id: r.item.item_id };
      requirements = [single];
    }

    this.api.post<any>('/taxonomy/request-quotes', {
      project_id: r.projectId,
      category_id: r.categoryId,
      project_category_id: r.projectCategoryId || null,
      requirements,
      supplier_ids: [...this.selected],
      subject: this.subject,
      body: this.emailBody
    }).subscribe({
      next: () => {
        this.sending = false;
        this.confirmingSend = false;
        this.step = 4;
        // Let the Brief tab (and any other live surface) react — the
        // category status flips to "Out for Quote" server-side.
        this.outreach.markSent(r.projectId, r.categoryId);
        this.cdr.markForCheck();
      },
      error: err => {
        this.sending = false;
        this.msg.add({
          severity: 'error', summary: 'Could not send brief',
          detail: err?.error?.error || 'Please try again in a moment.', life: 4000
        });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Close ─────────────────────────────────────────────────────────────
  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.outreach.close(); }
}
