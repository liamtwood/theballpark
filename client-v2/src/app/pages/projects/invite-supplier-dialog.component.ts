import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ModalComponent } from '../../shared/modal/modal.component';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectCategoryBucket } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { CoachmarkComponent } from '../../shared/coachmark/coachmark.component';

/** What the host needs to seed the supplier's banner + its first request line. */
export interface InvitedSupplier {
  supplierId: string;
  supplierName: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  /** false = an ACTIVE supplier the agency chose to "Use" instead of inviting. */
  pending: boolean;
  /** The "what would you like quoted?" brief — seeds a custom request line under
   *  the supplier (may be empty: Save the supplier now, add items later). */
  quoteText: string;
  /** true = "Send invitation" (fire the invite now); false = "Save" (hold). */
  send: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** pV2-INVITE-SUPPLIER-01 — "Add outside supplier" from the estimate's Add line
 *  menu. One dialog that MERGES invite + first request + send (Liam 2026-11-10):
 *  Company name*, Email*, Category*, and "What would you like quoted?" (seeds a
 *  request line under the supplier). **Save** provisions the pending marketplace
 *  org + banner and holds; **Send invitation** does that then fires the invite.
 *  (No notifications yet — the email leg is a no-op; the pending-domain note says
 *  so.) A match on a supplier already on Ballpark (409) swaps the form for
 *  "Already on Ballpark: <Name>" + Use them. Reuse of someone else's pending
 *  invite is silent — the success path is identical either way. */
@Component({
  selector: 'app-invite-supplier-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalComponent, LucideAngularModule, SelectComponent, CoachmarkComponent],
  host: { class: 'contents' },
  template: `
    <app-modal
      title="Add outside supplier"
      width="440px"
      (close)="cancel.emit()"
    >
      @if (existing(); as ex) {
        <div class="flex items-start gap-3 rounded-[var(--radius-field)] px-3 py-3" style="background: var(--theme-soft)">
          <lucide-icon name="store" [size]="18" class="mt-0.5 shrink-0" style="color: var(--theme-accent)" />
          <div class="min-w-0">
            <p class="bp-list-title" style="color: var(--theme-text)">Already on Ballpark: {{ ex.name }}</p>
            <p class="bp-body-small mt-1 text-secondary">Add their banner to this category and put your request against them.</p>
          </div>
        </div>
      } @else {
        <div class="flex justify-center">
          <app-coachmark page="add-outside-supplier" name="intro" tail="up"
                         defaultText="Invite a supplier who isn't on Ballpark yet — they'll join the Marketplace, with your quote request waiting in their inbox. Send now, or Save to add more items first." />
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <label class="block">
            <span class="ed-label mb-1.5 block">Company name</span>
            <input class="ed-input" placeholder="e.g. Fern &amp; Stem Floristry" maxlength="100" [(ngModel)]="form.businessName" autocomplete="off" />
          </label>
          <label class="block">
            <span class="ed-label mb-1.5 block">Email address</span>
            <input type="email" class="ed-input" placeholder="supplier@example.com" maxlength="254" [(ngModel)]="form.email" autocomplete="off" />
          </label>
          <div class="block">
            <span class="ed-label mb-1.5 block">Category</span>
            <app-select ariaLabel="Category" [options]="categoryOptions()" [value]="categoryId()"
                        [placeholder]="categories().length ? 'Pick a category' : 'No categories on this project yet'"
                        (changed)="categoryId.set($event)" />
          </div>
          <label class="block">
            <span class="ed-label mb-1.5 block">What would you like quoted?</span>
            <textarea class="ed-textarea" rows="3" maxlength="2000"
                      placeholder="Items, quantities and any requirements" [(ngModel)]="form.quoteText"></textarea>
          </label>
        </div>

        @if (error()) {
          <p class="bp-body-small mt-3 text-danger">{{ error() }}</p>
        }

        <p class="bp-caption mt-4 rounded-[var(--radius-field)] px-3 py-2 text-secondary" style="background: var(--color-fill)">
          Email invitations are pending sender-domain setup.
        </p>
      }

      <!-- One modalFooter node per button (each @if single-root) so named-slot
           projection works — a multi-root @if would mis-slot (NG8011). -->
      @if (existing()) {
        <button modalFooter type="button" class="bp-btn--secondary" (click)="existing.set(null)">Back</button>
      }
      @if (existing(); as ex) {
        <button modalFooter type="button" class="bp-btn--primary" (click)="useExisting(ex)">Use them</button>
      }
      @if (!existing()) {
        <button modalFooter type="button" class="bp-btn--secondary" (click)="cancel.emit()">Cancel</button>
      }
      @if (!existing()) {
        <button modalFooter type="button" class="bp-btn--secondary" [disabled]="!canSubmit()" (click)="submit(false)">
          {{ busy() && pendingSend() === false ? 'Saving…' : 'Save' }}
        </button>
      }
      @if (!existing()) {
        <button modalFooter type="button" class="bp-btn--primary" [disabled]="!canSubmit()" (click)="submit(true)">
          {{ busy() && pendingSend() === true ? 'Sending…' : 'Send' }}
        </button>
      }
    </app-modal>
  `,
})
export class InviteSupplierDialogComponent {
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly categories = input<ProjectCategoryBucket[]>([]);
  readonly invited = output<InvitedSupplier>();
  readonly cancel = output<void>();

  protected form = { businessName: '', email: '', quoteText: '' };
  /** The picked CATALOGUE category id (any category, Liam 2026-11-10). */
  protected readonly categoryId = signal<string>('');
  protected readonly busy = signal(false);
  /** Which button is in flight (so only its label spins); null when idle. */
  protected readonly pendingSend = signal<boolean | null>(null);
  protected readonly error = signal<string | null>(null);
  /** 409 — an ACTIVE supplier matched. */
  protected readonly existing = signal<{ id: string; name: string } | null>(null);

  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.catalogueId, label: c.name })));

  /** The picked category's project section — added to the project first when
   *  it isn't there yet. */
  private async pickedBucket(): Promise<{ id: string; name: string; iconName: string | null }> {
    const c = this.categories().find((x) => x.catalogueId === this.categoryId());
    if (!c) throw new Error('Pick a category');
    if (c.id) return { id: c.id, name: c.name, iconName: c.iconName };
    const b = await firstValueFrom(this.projects.ensureProjectCategory(this.projectId(), c.catalogueId));
    return { id: b.id!, name: b.name, iconName: b.iconName };
  }

  protected canSubmit(): boolean {
    return !this.busy()
      && this.form.businessName.trim().length >= 2
      && EMAIL_RE.test(this.form.email.trim())
      && !!this.categoryId();
  }

  /** `send` = true for "Send invitation", false for "Save". Both provision the
   *  pending org + banner + request line; the host fires the invite only when
   *  send is true (and it's a no-op until notifications land). */
  protected async submit(send: boolean): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.pendingSend.set(send);
    this.error.set(null);
    try {
      const bucket = await this.pickedBucket();
      const res = await firstValueFrom(this.projects.inviteSupplier(this.projectId(), {
        businessName: this.form.businessName.trim(),
        contactName: null,
        email: this.form.email.trim(),
        website: null,
        categoryId: bucket.id,
      }));
      this.invited.emit({ supplierId: res.supplier.id, supplierName: res.supplier.name, categoryId: res.categoryId,
        categoryName: bucket.name, categoryIcon: bucket.iconName, pending: true,
        quoteText: this.form.quoteText.trim(), send });
    } catch (e) {
      const ex = e instanceof HttpErrorResponse && e.status === 409
        ? (e.error?.existingSupplier as { id: string; name: string } | undefined)
        : undefined;
      if (ex) this.existing.set(ex);
      else this.error.set(errorDetail(e) || "Couldn't add the supplier — please try again.");
    } finally {
      this.busy.set(false);
      this.pendingSend.set(null);
    }
  }

  /** "Use them" — an active supplier matched the invite. Reuse the Save/Send
   *  intent the agency pressed, carrying the same request brief. */
  protected async useExisting(ex: { id: string; name: string }): Promise<void> {
    this.busy.set(true);
    try {
      const bucket = await this.pickedBucket();
      this.invited.emit({ supplierId: ex.id, supplierName: ex.name, categoryId: bucket.id,
        categoryName: bucket.name, categoryIcon: bucket.iconName, pending: false,
        quoteText: this.form.quoteText.trim(), send: this.pendingSend() ?? false });
    } catch (e) {
      this.error.set(errorDetail(e) || "Couldn't add the supplier — please try again.");
    } finally {
      this.busy.set(false);
    }
  }
}
