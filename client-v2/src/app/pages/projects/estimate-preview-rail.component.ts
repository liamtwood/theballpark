import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { LinePreviewComponent } from './line-preview.component';
import { QuoteLine } from '../../core/projects/project.types';
import { ProjectService } from '../../core/projects/project.service';
import { lineCost } from './quote-line.util';
import { LineEditorComponent, LineEdit } from './line-editor.component';

/** pV2-CART-01 — the right-rail marketplace preview for the selected quote
 *  line. Owns the eye toggle (hides the card for ALL selections until clicked
 *  again). Extracted from project-estimate (audit M1). */
@Component({
  selector: 'app-estimate-preview-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, LucideAngularModule, LinePreviewComponent, LineEditorComponent],
  host: { class: 'contents' },
  template: `
    @if (line(); as l) {
      <!-- Rail spans the gap between the centered column's right edge
           (50% + half of max-w-2xl = 21rem) and the screen edge; the card is
           centered in it. Full-height so the inner sticky card stays put. -->
      <aside class="absolute inset-y-0 right-0 left-[calc(50%_+_21rem)] hidden items-start justify-center lg:flex">
        <div class="sticky top-32 w-80">
          @if (hidden()) {
            <!-- Hidden: just the eye, in the same top-right spot as the preview
                 card's eye (matches the card's p-4 inset). -->
            <div class="flex justify-end px-4 pt-4">
              <button type="button" class="bp-itemprev-close" (click)="hidden.set(false)"
                      title="Show item preview" aria-label="Show item preview">
                <lucide-icon name="eye" [size]="14" />
              </button>
            </div>
          } @else {
            <div class="bp-card p-4">
            @if (editing()) {
              <!-- pV2-BUILDUP-04 — the agent edits their own line inline (shared
                   LineEditor: name/cost/unit/category/description/services/details). -->
              <app-line-editor [line]="l" [categories]="categories()" [saving]="saving()"
                               (save)="onSave(l, $event)" (cancel)="editing.set(false)" />
            } @else {
              <!-- pV2-PREVIEW-01 — the shared project preview (total + the four
                   text blocks, nulls hidden). The pencil on the Client description
                   block opens the inline editor below. -->
              <app-line-preview [line]="l" [clientDescriptionEditable]="!editingDesc()"
                                closeIcon="eye" closeLabel="Hide preview"
                                (closed)="hidden.set(true)" (editClientDescription)="startDesc(l)" />
              @if (editingDesc()) {
                <div class="mt-3 border-t border-hairline pt-3">
                  <span class="bp-field-label">Client description <span class="bp-meta font-normal">· on the quote</span></span>
                  <textarea rows="6" class="bp-store-textarea mt-1.5 w-full" placeholder="Describe this line for the client…"
                            [ngModel]="descDraft()" (ngModelChange)="descDraft.set($event)"></textarea>
                  <div class="mt-2 flex items-center gap-2">
                    <button type="button" class="bp-btn-grad flex-1" [disabled]="savingDesc()" (click)="saveDesc(l)">
                      {{ savingDesc() ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="bp-btn-outline" (click)="editingDesc.set(false)">Cancel</button>
                  </div>
                </div>
              }
              <!-- Agent edits their own line (custom / self-entered). -->
              @if (canEdit()) {
                <button type="button"
                        class="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-hairline px-3 py-2.5 text-secondary transition-colors hover:bg-fill hover:text-text"
                        (click)="editing.set(true)">
                  <lucide-icon name="square-pen" [size]="15" /> Edit line
                </button>
              }
              <!-- pV2-BUILDUP-03 — this line's picked options, listed on the card. -->
              @if (options().length) {
                <div class="mt-3 rounded-[var(--radius-card)] border border-hairline">
                  <div class="flex items-center gap-2 border-b border-hairline bg-fill px-3 py-2">
                    <lucide-icon name="list-checks" [size]="14" class="shrink-0 text-muted" />
                    <span class="bp-field-label">Options</span>
                  </div>
                  @for (op of options(); track op.id) {
                    <div class="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0">
                      <span class="min-w-0 flex-1 truncate bp-meta text-text">{{ op.name }}</span>
                      <span class="bp-meta shrink-0 tabular-nums text-secondary">× {{ op.quantity }}</span>
                      <span class="bp-body-small w-16 shrink-0 text-right tabular-nums text-secondary">{{ optCost(op) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                    </div>
                  }
                </div>
              }
              <!-- pV2-BUILDUP-01 (UI1): browse more of this item's supplier. -->
              @if (l.supplierId) {
                <button type="button"
                        class="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-hairline px-3 py-2.5 text-secondary transition-colors hover:bg-fill hover:text-text"
                        (click)="exploreMore.emit()">
                  <lucide-icon name="layout-grid" [size]="15" /> Explore More
                </button>
              }
            }
            </div>
          }
        </div>
      </aside>
    }
  `,
})
export class EstimatePreviewRailComponent {
  private readonly projects = inject(ProjectService);
  readonly line = input<QuoteLine | null>(null);
  readonly projectId = input.required<string>();
  /** pV2-BUILDUP-03 — the selected line's picked options, listed on the card. */
  readonly options = input<QuoteLine[]>([]);
  readonly cur = input<string>('GBP');
  /** pV2-BUILDUP-04 — project categories for the inline editor's category picker. */
  readonly categories = input<{ id: string; name: string }[]>([]);
  /** Whether the agent can edit this line inline (their own custom lines). */
  readonly canEdit = input<boolean>(false);
  /** "Explore More" → the host opens the supplier-browse dialog for this line. */
  readonly exploreMore = output<void>();
  /** A line was edited + saved → the host reloads the quote + cascade. */
  readonly changed = output<void>();
  protected optCost(l: QuoteLine): number { return lineCost(l); }
  /** Eye toggle — suppresses the preview for ALL selections (session-local). */
  protected readonly hidden = signal(false);
  /** Inline-edit mode — resets to false whenever the selected line changes. */
  protected readonly editing = linkedSignal(() => (this.line(), false));
  protected readonly saving = signal(false);

  // ── pV2-BUILDUP-04 — the agent's client-facing (quote) description ──────────
  /** The client-facing description: the agent's override, else the supplier text. */
  /** Edit mode for the quote description — resets when the selected line changes. */
  protected readonly editingDesc = linkedSignal(() => (this.line(), false));
  protected readonly descDraft = signal('');
  protected readonly savingDesc = signal(false);
  protected startDesc(l: QuoteLine): void {
    // Seed from the current client text (agent override, else supplier default).
    this.descDraft.set(l.quoteDescription ?? l.description ?? '');
    this.editingDesc.set(true);
  }
  protected async saveDesc(l: QuoteLine): Promise<void> {
    if (this.savingDesc()) return;
    this.savingDesc.set(true);
    try {
      const text = this.descDraft().trim();
      await firstValueFrom(this.projects.setQuoteDescription(this.projectId(), l.id, text || null));
      this.editingDesc.set(false);
      this.changed.emit();
    } catch {
      // Keep the editor open on failure; nothing cleared locally.
    } finally {
      this.savingDesc.set(false);
    }
  }
  /** Persist the agent's edit to their own line (direct — no negotiation), then
   *  tell the host to reload. */
  protected async onSave(line: QuoteLine, edit: LineEdit): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.projects.updateLineDetails(this.projectId(), line.id, {
        name: edit.name, cost: edit.cost, unit: edit.unit, categoryId: edit.categoryId,
        description: edit.description, services: edit.services, details: edit.details,
      }));
      this.editing.set(false);
      this.changed.emit();
    } catch {
      // Keep the editor open on failure; nothing cleared locally.
    } finally {
      this.saving.set(false);
    }
  }
}
