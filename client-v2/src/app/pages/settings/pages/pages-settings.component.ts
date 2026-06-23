import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { CodelistService } from '../../../core/codelists/codelist.service';
import { PageConfigPayload, mergeConfig } from '../../../core/config/page-config.types';
import { PageConfigService } from '../../../core/config/page-config.service';
import { EditFieldComponent, EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** The two customer org types whose page settings the table edits. */
const ROLES = ['agency', 'supplier', 'ballpark'] as const;
type RoleType = (typeof ROLES)[number];

/** pV2-04c-pre — /settings/pages: the simple TABLE view of page settings
 *  (Liam's 2026-06-11 simplification — replaces the per-page cog + drawer).
 *  Ballpark admins only (ballparkAdminGuard + the server's PUT gate): one
 *  row block per customer role, edit-fields save-on-change to the same
 *  PUT /api/config/:orgType the drawer used. Title2/Subtitle2 rows join
 *  when pages consume them. */
@Component({
  selector: 'app-pages-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditFieldComponent, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      title="Page settings"
      subtitle="Hero defaults per customer role — changes apply to every organisation of that type."
    />

    <div class="bp-page-body">
      <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
        <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
          <span class="bp-table-column-header">Role</span>
          <span class="bp-table-column-header">Setting</span>
          <span class="bp-table-column-header">Value</span>
        </div>

        @for (role of roles; track role) {
          @let cfg = configFor(role);
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span class="bp-body-small capitalize">{{ role }}</span>
            <span class="bp-field-label">Home title</span>
            <app-edit-field
              label=""
              type="select"
              [options]="titleModes()"
              [value]="cfg?.heroTitleMode ?? 'greeting'"
              [editing]="true"
              (valueChange)="save(role, { heroTitleMode: asTitleMode($event) })"
            />
          </div>
          @if ((cfg?.heroTitleMode ?? 'greeting') === 'fixed') {
            <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
              <span></span>
              <span class="bp-field-label">Title text</span>
              <app-edit-field
                label=""
                type="text"
                [value]="cfg?.heroTitleFixed ?? ''"
                placeholder="e.g. Mission Control"
                [maxLength]="80"
                [editing]="true"
                (valueChange)="save(role, { heroTitleFixed: $event })"
              />
            </div>
          }
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span></span>
            <span class="bp-field-label">Home subtitle</span>
            <app-edit-field
              label=""
              type="text"
              [value]="cfg?.heroSubtitle ?? ''"
              placeholder="Shown under the greeting"
              [editing]="true"
              (valueChange)="save(role, { heroSubtitle: $event })"
            />
          </div>
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span></span>
            <span class="bp-field-label">Position</span>
            <app-edit-field
              label=""
              type="select"
              [options]="aligns()"
              [value]="cfg?.heroAlign ?? 'center'"
              [editing]="true"
              (valueChange)="save(role, { heroAlign: $event === 'left' ? 'left' : 'center' })"
            />
          </div>
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span></span>
            <span class="bp-field-label">Profile title</span>
            <app-edit-field
              label=""
              type="text"
              [value]="cfg?.pages?.profile?.title ?? ''"
              placeholder="Profile"
              [maxLength]="80"
              [editing]="true"
              (valueChange)="savePageHero(role, 'profile', 'title', $event)"
            />
          </div>
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span></span>
            <span class="bp-field-label">Profile subtitle</span>
            <app-edit-field
              label=""
              type="text"
              [value]="cfg?.pages?.profile?.subtitle ?? ''"
              placeholder="Defaults to the organisation name"
              [editing]="true"
              (valueChange)="savePageHero(role, 'profile', 'subtitle', $event)"
            />
          </div>
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5">
            <span></span>
            <span class="bp-field-label">Marketplace title</span>
            <app-edit-field
              label=""
              type="text"
              [value]="cfg?.pages?.marketplace?.title ?? ''"
              placeholder="Marketplace"
              [maxLength]="80"
              [editing]="true"
              (valueChange)="savePageHero(role, 'marketplace', 'title', $event)"
            />
          </div>
          <div class="grid grid-cols-[120px_160px_1fr] items-center gap-x-4 border-b border-hairline px-4 py-1.5 last:border-b-0">
            <span></span>
            <span class="bp-field-label">Marketplace subtitle</span>
            <app-edit-field
              label=""
              type="text"
              [value]="cfg?.pages?.marketplace?.subtitle ?? ''"
              placeholder="Browse suppliers, products and services…"
              [editing]="true"
              (valueChange)="savePageHero(role, 'marketplace', 'subtitle', $event)"
            />
          </div>
        }
      </div>

      @if (error()) {
        <p class="bp-caption mt-3 text-danger">{{ error() }}</p>
      }
    </div>
  `,
})
export class PagesSettingsComponent {
  private readonly api = inject(ApiService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly codelists = inject(CodelistService);

  protected readonly roles = ROLES;
  protected readonly error = signal('');

  /** Codelist-fed dropdowns (pV2-CODELISTS-02 — closes RP-04 here): the
   *  option space lives in page_title_mode / hero_align rows, not code. */
  private readonly titleModeRes = resource({
    loader: () => this.codelists.list('page_title_mode'),
  });
  private readonly alignRes = resource({
    loader: () => this.codelists.list('hero_align'),
  });
  protected readonly titleModes = computed<EditFieldOption[]>(
    () => this.titleModeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  protected readonly aligns = computed<EditFieldOption[]>(
    () => this.alignRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  /** One config resource per customer role; optimistic local edits. */
  private readonly configs = {
    agency: signal<PageConfigPayload | null>(null),
    supplier: signal<PageConfigPayload | null>(null),
    ballpark: signal<PageConfigPayload | null>(null),
  };

  private readonly loader = resource<void, void>({
    loader: async () => {
      for (const role of ROLES) {
        try {
          const cfg = await firstValueFrom(this.api.get<PageConfigPayload>(`/api/config/${role}`));
          this.configs[role].set(cfg ?? {});
        } catch (err) {
          // Surfaced to the admin — a half-loaded settings table must not
          // silently save over unknown server state (Rule 5).
          console.warn(`[PagesSettings] load failed for ${role}`, err);
          this.error.set(`Couldn't load ${role} settings — edits disabled until reload.`);
        }
      }
    },
  });

  protected configFor(role: RoleType): PageConfigPayload | null {
    return this.configs[role]();
  }

  protected asTitleMode(v: string): PageConfigPayload['heroTitleMode'] {
    const valid = ['greeting', 'username', 'orgName', 'fixed'] as const;
    return valid.find((m) => m === v) ?? 'greeting';
  }

  /** Per-page hero fields nest under pages.<page> — mergeConfig is shallow,
   *  so build the FULL pages object from current state before saving (a
   *  marketplace save must not drop the profile keys, and vice versa). */
  protected savePageHero(
    role: RoleType,
    page: 'profile' | 'marketplace',
    key: 'title' | 'subtitle',
    value: string
  ): void {
    const pages = this.configs[role]()?.pages ?? {};
    void this.save(role, {
      pages: { ...pages, [page]: { ...(pages[page] ?? {}), [key]: value || undefined } },
    });
  }

  protected async save(role: RoleType, patch: Partial<PageConfigPayload>): Promise<void> {
    if (this.configs[role]() === null) return; // load failed — don't save blind
    const next = mergeConfig(this.configs[role](), patch);
    this.configs[role].set(next); // optimistic
    try {
      await firstValueFrom(this.api.put(`/api/config/${role}`, { payload: next }));
      // Keep the admin's own app chrome in sync if they edited their visible type.
      await this.pageConfig.load();
    } catch (err) {
      console.warn(`[PagesSettings] save failed for ${role}; reloading`, err);
      this.loader.reload();
    }
  }
}
