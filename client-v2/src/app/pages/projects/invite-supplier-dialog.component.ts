import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectCategoryBucket } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';

/** What the host needs to seed the supplier's banner. */
export interface InvitedSupplier {
  supplierId: string;
  supplierName: string;
  categoryId: string;
  /** false = an ACTIVE supplier the agency chose to "Use" instead of inviting. */
  pending: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** pV2-INVITE-SUPPLIER-01 — "Invite a new supplier" from the estimate's Add line
 *  menu. Same overlay chrome as the add-line dialog. Business name*, Contact,
 *  Email*, Website, Category* (the project's buckets). A match on a supplier
 *  already on Ballpark (409) swaps the form for "Already on Ballpark: <Name>" +
 *  Use them. A reuse of someone else's pending invite is silent — the success
 *  path is identical either way (no "already invited" oracle). */
@Component({
  selector: 'app-invite-supplier-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, SelectComponent],
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cancel.emit()">
      <div class="bp-card w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between">
          <h3 class="bp-card-title text-lg">Invite a new supplier</h3>
          <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="cancel.emit()">
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>

        @if (existing(); as ex) {
          <div class="mt-4 flex items-start gap-3 rounded-[var(--radius-field)] px-3 py-3" style="background: var(--theme-soft)">
            <lucide-icon name="store" [size]="18" class="mt-0.5 shrink-0" style="color: var(--theme-accent)" />
            <div class="min-w-0">
              <p class="bp-list-title" style="color: var(--theme-text)">Already on Ballpark: {{ ex.name }}</p>
              <p class="bp-body-small mt-1 text-secondary">Add their banner to this category and put your lines against them.</p>
            </div>
          </div>
          <div class="mt-5 flex gap-2.5">
            <button type="button" class="bp-btn-cancel flex-1" (click)="existing.set(null)">Back</button>
            <button type="button" class="bp-btn-grad flex-1" (click)="useExisting(ex)">Use them</button>
          </div>
        } @else {
          <p class="bp-body-small mt-2 text-secondary">
            Add your lines for them first. The invite is emailed when you press Send on their banner.
          </p>
          <div class="mt-4 flex flex-col gap-3">
            <label class="block">
              <span class="bp-field-label mb-1 block pl-3">Business name</span>
              <input class="bp-input-field" placeholder="e.g. Fern &amp; Stem Floristry" maxlength="100" [(ngModel)]="form.businessName" autocomplete="off" />
            </label>
            <label class="block">
              <span class="bp-field-label mb-1 block pl-3">Contact name (optional)</span>
              <input class="bp-input-field" maxlength="100" [(ngModel)]="form.contactName" autocomplete="off" />
            </label>
            <label class="block">
              <span class="bp-field-label mb-1 block pl-3">Email</span>
              <input type="email" class="bp-input-field" placeholder="name@business.com" maxlength="254" [(ngModel)]="form.email" autocomplete="off" />
            </label>
            <label class="block">
              <span class="bp-field-label mb-1 block pl-3">Website (optional)</span>
              <input class="bp-input-field" placeholder="business.com" maxlength="300" [(ngModel)]="form.website" autocomplete="off" />
            </label>
            <div class="block">
              <span class="bp-field-label mb-1 block pl-3">Category</span>
              <app-select ariaLabel="Category" [options]="categoryOptions()" [value]="categoryId()"
                          [placeholder]="categories().length ? 'Pick a category' : 'No categories on this project yet'"
                          (changed)="categoryId.set($event)" />
            </div>
          </div>
          @if (error()) {
            <p class="bp-body-small mt-3 text-danger">{{ error() }}</p>
          }
          <button type="button" class="bp-btn-grad mt-5 w-full" [disabled]="!canSubmit()" (click)="submit()">
            {{ busy() ? 'Adding…' : 'Add supplier' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class InviteSupplierDialogComponent {
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly categories = input<ProjectCategoryBucket[]>([]);
  /** Pre-pick (e.g. the only bucket). */
  readonly initialCategoryId = input<string | null>(null);
  readonly invited = output<InvitedSupplier>();
  readonly cancel = output<void>();

  protected form = { businessName: '', contactName: '', email: '', website: '' };
  protected readonly categoryId = signal<string>('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  /** 409 — an ACTIVE supplier matched. */
  protected readonly existing = signal<{ id: string; name: string } | null>(null);

  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: c.name })));

  constructor() {
    queueMicrotask(() => {
      const only = this.categories().length === 1 ? this.categories()[0].id : null;
      this.categoryId.set(this.initialCategoryId() ?? only ?? '');
    });
  }

  protected canSubmit(): boolean {
    return !this.busy()
      && this.form.businessName.trim().length >= 2
      && EMAIL_RE.test(this.form.email.trim())
      && !!this.categoryId();
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.projects.inviteSupplier(this.projectId(), {
        businessName: this.form.businessName.trim(),
        contactName: this.form.contactName.trim() || null,
        email: this.form.email.trim(),
        website: this.form.website.trim() || null,
        categoryId: this.categoryId(),
      }));
      this.invited.emit({ supplierId: res.supplier.id, supplierName: res.supplier.name, categoryId: res.categoryId, pending: true });
    } catch (e) {
      const ex = e instanceof HttpErrorResponse && e.status === 409
        ? (e.error?.existingSupplier as { id: string; name: string } | undefined)
        : undefined;
      if (ex) this.existing.set(ex);
      else this.error.set(errorDetail(e) || "Couldn't add the supplier — please try again.");
    } finally {
      this.busy.set(false);
    }
  }

  protected useExisting(ex: { id: string; name: string }): void {
    this.invited.emit({ supplierId: ex.id, supplierName: ex.name, categoryId: this.categoryId(), pending: false });
  }
}
