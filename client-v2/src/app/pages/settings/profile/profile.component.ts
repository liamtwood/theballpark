import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { can } from '../../../core/auth/permissions';
import { errorDetail } from '../../../core/http-error';
import { OrgProfile, OrganisationService } from '../../../core/organisation.service';
import { EditFieldComponent } from '../../../shared/edit-field/edit-field.component';
import { EditSectionComponent } from '../../../shared/edit-section/edit-section.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** The editable form state (strings throughout — edit-field's surface). */
interface ProfileForm {
  name: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  refPrefix: string;
  vat: string;
  margin: string;
  contingency: string;
}

/** pV2 Profile — /settings/profile: the v2 port of v1's
 *  /settings/organisation, and the REFERENCE consumer of the page-density
 *  <app-edit-section> + <app-edit-field> standard. Two sections
 *  (Organisation 2-col / Financial defaults 3-col), per-section pencil →
 *  snapshot → Cancel restores / Save PUTs. Members view read-only; org
 *  admins (org.manage_billing — matches the server's PUT gate) edit. */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, PageHeroComponent, EditSectionComponent, EditFieldComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero title="Profile" [subtitle]="auth.user()?.activeOrgName ?? ''" />

    <div class="bp-page-body">
      @if (profile.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (profile.error()) {
        <p class="bp-body-small text-warn">Couldn't load your organisation.</p>
      } @else {
        <div class="bp-settings-body">
          <app-edit-section
            title="Organisation"
            [editable]="canEdit()"
            [(editing)]="editingOrg"
            [saving]="saving()"
            (edit)="snapshot('org')"
            (cancelled)="restore('org')"
            (save)="save('org')"
          >
            <div class="bp-field-grid-2">
              <app-edit-field label="Organisation name" density="page" [editing]="editingOrg()" [value]="form().name" (valueChange)="patch({ name: $event })" />
              <app-edit-field label="City" density="page" [editing]="editingOrg()" [value]="form().city" (valueChange)="patch({ city: $event })" />
              <app-edit-field label="Address" density="page" [span2]="true" [editing]="editingOrg()" [value]="form().address" (valueChange)="patch({ address: $event })" />
              <app-edit-field label="Email" type="email" density="page" [editing]="editingOrg()" [value]="form().email" (valueChange)="patch({ email: $event })" />
              <app-edit-field label="Phone" type="tel" density="page" [editing]="editingOrg()" [value]="form().phone" (valueChange)="patch({ phone: $event })" />
              <app-edit-field label="Project reference prefix" density="page" [maxLength]="4" placeholder="e.g. WA" [editing]="editingOrg()" [value]="form().refPrefix" (valueChange)="patch({ refPrefix: $event.toUpperCase() })" />
              <app-edit-field label="Projects numbered so far" density="page" [readonlyAlways]="true" [value]="String(refCounter())" />
            </div>
          </app-edit-section>

          <app-edit-section
            title="Financial defaults"
            [editable]="canEdit()"
            [(editing)]="editingFin"
            [saving]="saving()"
            (edit)="snapshot('fin')"
            (cancelled)="restore('fin')"
            (save)="save('fin')"
          >
            <div class="bp-field-grid-3">
              <app-edit-field label="VAT" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().vat" (valueChange)="patch({ vat: $event })" />
              <app-edit-field label="Margin" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().margin" (valueChange)="patch({ margin: $event })" />
              <app-edit-field label="Contingency" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().contingency" (valueChange)="patch({ contingency: $event })" />
            </div>
          </app-edit-section>
        </div>
      }
    </div>

    <p-toast position="bottom-right" />
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly orgs = inject(OrganisationService);
  private readonly toast = inject(MessageService);

  protected readonly String = String;

  /** The org profile — resource per the v2 fetch-into-state standard. */
  protected readonly profile = resource<OrgProfile, void>({
    loader: async () => {
      const org = await firstValueFrom(this.orgs.get());
      this.form.set(toForm(org));
      this.refCounter.set(org.refCounter);
      return org;
    },
  });

  protected readonly form = signal<ProfileForm>(toForm(null));
  protected readonly refCounter = signal(0);

  protected readonly editingOrg = signal(false);
  protected readonly editingFin = signal(false);
  protected readonly saving = signal(false);

  /** Pencils mirror the server's PUT gate (org.manage_billing = org admins). */
  protected readonly canEdit = computed(() => can(this.auth.role(), 'org.manage_billing'));

  private snapshots: { org?: ProfileForm; fin?: ProfileForm } = {};

  protected patch(p: Partial<ProfileForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected snapshot(section: 'org' | 'fin'): void {
    this.snapshots[section] = { ...this.form() };
  }

  protected restore(section: 'org' | 'fin'): void {
    const snap = this.snapshots[section];
    if (snap) this.form.set({ ...snap });
  }

  protected async save(section: 'org' | 'fin'): Promise<void> {
    this.saving.set(true);
    const f = this.form();
    try {
      const fresh = await firstValueFrom(
        this.orgs.update({
          name: f.name,
          address: f.address,
          city: f.city,
          email: f.email,
          phone: f.phone,
          refPrefix: f.refPrefix.trim().toUpperCase(),
          defaultVatPct: Number(f.vat) || 0,
          defaultMarginPct: Number(f.margin) || 0,
          defaultContingencyPct: Number(f.contingency) || 0,
        })
      );
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      if (section === 'org') this.editingOrg.set(false);
      else this.editingFin.set(false);
      this.toast.add({ severity: 'success', summary: 'Saved', life: 2500 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Could not save', detail: errorDetail(e), life: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}

/** Org → editable string form (and a blank default pre-load). */
function toForm(org: OrgProfile | null): ProfileForm {
  return {
    name: org?.name ?? '',
    city: org?.city ?? '',
    address: org?.address ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    refPrefix: (org?.refPrefix ?? '').toUpperCase(),
    vat: String(org?.defaultVatPct ?? 20),
    margin: String(org?.defaultMarginPct ?? 20),
    contingency: String(org?.defaultContingencyPct ?? 5),
  };
}
