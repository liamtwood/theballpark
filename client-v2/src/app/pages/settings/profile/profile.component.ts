import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { can } from '../../../core/auth/permissions';
import { errorDetail } from '../../../core/http-error';
import { PageConfigService } from '../../../core/config/page-config.service';
import { CodelistService } from '../../../core/codelists/codelist.service';
import { OrgProfile, OrganisationService } from '../../../core/organisation.service';
import { EditFieldComponent, EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { EditSectionComponent } from '../../../shared/edit-section/edit-section.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** The editable form state (strings throughout — edit-field's surface). */
interface ProfileForm {
  name: string;
  city: string;
  country: string;
  address: string;
  email: string;
  phone: string;
  refPrefix: string;
  vat: string;
  margin: string;
  contingency: string;
  currency: string;
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
    <app-page-hero [back]="{ label: 'Back', href: '/home' }" [title]="heroTitle()" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body">
      @if (profile.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (profile.error()) {
        <p class="bp-body-small text-warn">Couldn't load your organisation.</p>
      } @else {
        <div class="bp-settings-body">
          <app-edit-section
            title="Company Information"
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
              <app-edit-field label="Country" type="select" density="page" [filter]="true" [options]="countryOptions()" [editing]="editingOrg()" [value]="form().country" (valueChange)="patch({ country: $event })" />
              <app-edit-field label="Address" density="page" [editing]="editingOrg()" [value]="form().address" (valueChange)="patch({ address: $event })" />
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
              <app-edit-field label="Currency" type="select" density="page" [options]="currencyOptions()" [editing]="editingFin()" [value]="form().currency" (valueChange)="patch({ currency: $event })" />
              <app-edit-field label="VAT" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().vat" (valueChange)="patch({ vat: $event })" />
              <app-edit-field label="Margin" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().margin" (valueChange)="patch({ margin: $event })" />
              <app-edit-field label="Contingency" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().contingency" (valueChange)="patch({ contingency: $event })" />
            </div>
          </app-edit-section>
        </div>
      }
    </div>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly orgs = inject(OrganisationService);
  private readonly toast = inject(MessageService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly codelists = inject(CodelistService);

  /** Codelist-fed selects (pV2-CODELISTS-02 — RP-04: no inline arrays).
   *  Country labels show the name; the stored value is the ISO-2 code. */
  private readonly countryRes = resource({
    loader: () => this.codelists.list('country'),
  });
  private readonly currencyRes = resource({
    loader: () => this.codelists.list('currency'),
  });
  protected readonly countryOptions = computed<EditFieldOption[]>(
    () => this.countryRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  protected readonly currencyOptions = computed<EditFieldOption[]>(
    () => this.currencyRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  /** Hero (title2/subtitle2 roles): /settings/pages overrides win;
   *  defaults are "Profile" / the org name. */
  protected readonly heroTitle = computed(() => this.pageConfig.profileTitle() || 'Profile');
  protected readonly heroSubtitle = computed(
    () => this.pageConfig.profileSubtitle() || (this.auth.user()?.activeOrgName ?? '')
  );

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
    // Per-section payloads (audit 02-F-2): saving Company Information must
    // not write possibly-stale Financial values back, and vice versa — the
    // PUT is partial; only the edited section's fields travel.
    const patch =
      section === 'org'
        ? {
            name: f.name,
            address: f.address,
            city: f.city,
            country: f.country,
            email: f.email,
            phone: f.phone,
            refPrefix: f.refPrefix.trim().toUpperCase(),
          }
        : {
            // defaultCurrency is never-clearable BY DESIGN (an org always
            // has one — unlike country, '' is not accepted server-side).
            defaultCurrency: f.currency || 'GBP',
            defaultVatPct: Number(f.vat) || 0,
            defaultMarginPct: Number(f.margin) || 0,
            defaultContingencyPct: Number(f.contingency) || 0,
          };
    try {
      const fresh = await firstValueFrom(this.orgs.update(patch));
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      if (section === 'org') this.editingOrg.set(false);
      else this.editingFin.set(false);
      // Locked toast copy (DIALOGS.md standard messages).
      this.toast.add({ severity: 'success', summary: 'Saved.', life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
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
    country: org?.country ?? '',
    address: org?.address ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    refPrefix: (org?.refPrefix ?? '').toUpperCase(),
    vat: String(org?.defaultVatPct ?? 20),
    margin: String(org?.defaultMarginPct ?? 20),
    contingency: String(org?.defaultContingencyPct ?? 5),
    currency: org?.defaultCurrency ?? 'GBP',
  };
}
