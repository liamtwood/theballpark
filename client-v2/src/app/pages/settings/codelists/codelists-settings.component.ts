import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CodelistService } from '../../../core/codelists/codelist.service';
import {
  Codelist,
  CodelistValue,
  CodelistValuePatch,
} from '../../../core/codelists/codelist.types';
import { EditFieldComponent } from '../../../shared/edit-field/edit-field.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { CodelistValueRowComponent } from './codelist-value-row.component';

/** pV2-CODELISTS-01 — /settings/codelists: master/detail curation
 *  (ballparkAdminGuard). Left: parents grouped by application (type
 *  badge, value counts). Right: the selected list's values — code
 *  read-only, label/symbol/sort editable save-on-change, Visible|Hidden
 *  with the in-use gate copy, status-pill preview when meta carries
 *  color. Add-value row on BALLPARK lists only; system lists read-only
 *  (locked rule 1). No delete anywhere (locked rule 2). */
@Component({
  selector: 'app-codelists-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodelistValueRowComponent, EditFieldComponent, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      title="Codelists"
      subtitle="Reference data — statuses, units, currencies. Values are added or retired, never deleted."
    />

    <div class="bp-page-body">
      <div class="grid grid-cols-[260px_1fr] gap-6">
        <!-- Master: parents by application -->
        <nav class="flex flex-col gap-0.5">
          @for (app of applications(); track app) {
            <p class="bp-field-label mt-3 px-3 uppercase tracking-wide first:mt-0">{{ app }}</p>
            @for (list of parentsFor(app); track list.listName) {
              <button
                type="button"
                class="bp-catstrip-row"
                [class.bp-catstrip-row--active]="selected() === list.listName"
                (click)="select(list.listName)"
              >
                <span class="truncate">{{ list.listName }}</span>
                <span class="flex items-center gap-1.5">
                  <span class="bp-meta">{{ list.activeCount }}/{{ list.valueCount }}</span>
                  <span class="bp-type-badge" [class.bp-type-badge--system]="list.type === 'system'">
                    {{ list.type }}
                  </span>
                </span>
              </button>
            }
          }
        </nav>

        <!-- Detail: the selected list -->
        <div class="min-w-0">
          @if (selectedParent(); as parent) {
            <p class="bp-body-small text-secondary">{{ parent.description }}</p>
            @if (parent.type === 'system') {
              <p class="bp-caption mt-1 text-muted">
                System list — code paths depend on these values; read-only here (new values require a code change).
              </p>
            }

            <div class="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface">
              <div class="grid grid-cols-[110px_1fr_80px_70px_120px_110px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
                <span class="bp-table-column-header">Code</span>
                <span class="bp-table-column-header">Label</span>
                <span class="bp-table-column-header">Symbol</span>
                <span class="bp-table-column-header">Sort</span>
                <span class="bp-table-column-header">Preview</span>
                <span class="bp-table-column-header">Visibility</span>
              </div>

              @for (v of values(); track v.code) {
                <app-codelist-value-row
                  [listName]="parent.listName"
                  [value]="v"
                  [editable]="parent.type === 'ballpark'"
                  (save)="save(v, $event)"
                  (toggleActive)="toggleActive(parent, v, $event)"
                />
              }

              <!-- Add value — ballpark lists only (locked rule 1) -->
              @if (parent.type === 'ballpark') {
                <div class="grid grid-cols-[110px_1fr_80px_70px_120px_110px] items-center gap-x-4 bg-fill px-4 py-2">
                  <app-edit-field label="" type="text" [maxLength]="50" placeholder="code" [value]="draft().code" [editing]="true" (valueChange)="patchDraft({ code: $event })" />
                  <app-edit-field label="" type="text" [maxLength]="100" placeholder="Label" [value]="draft().label" [editing]="true" (valueChange)="patchDraft({ label: $event })" />
                  <app-edit-field label="" type="text" [maxLength]="20" placeholder="£" [value]="draft().symbol" [editing]="true" (valueChange)="patchDraft({ symbol: $event })" />
                  <span></span>
                  <span></span>
                  <button type="button" class="bp-btn-outline !px-4 !py-1.5" [disabled]="!draft().code || !draft().label" (click)="add(parent)">
                    Add
                  </button>
                </div>
              }
            </div>

            @if (gateNote()) {
              <p class="bp-caption mt-3 text-secondary">{{ gateNote() }}</p>
            }
            @if (error()) {
              <p class="bp-caption mt-3 text-danger">{{ error() }}</p>
            }
          } @else {
            <p class="bp-body-small text-secondary">Select a codelist.</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class CodelistsSettingsComponent {
  private readonly codelists = inject(CodelistService);

  protected readonly error = signal('');
  protected readonly gateNote = signal('');

  protected readonly parents = signal<Codelist[]>([]);
  protected readonly selected = signal<string | null>(null);
  protected readonly values = signal<CodelistValue[]>([]);
  protected readonly draft = signal({ code: '', label: '', symbol: '' });

  protected readonly loader = resource<void, void>({
    loader: async () => {
      const parents = await firstValueFrom(this.codelists.parents());
      this.parents.set(parents);
      if (!this.selected() && parents.length) await this.select(parents[0].listName);
    },
  });

  protected readonly applications = computed(() => [
    ...new Set(this.parents().map((p) => p.application)),
  ]);

  protected parentsFor(app: string): Codelist[] {
    return this.parents().filter((p) => p.application === app);
  }

  protected readonly selectedParent = computed(
    () => this.parents().find((p) => p.listName === this.selected()) ?? null
  );

  protected async select(listName: string): Promise<void> {
    this.selected.set(listName);
    this.gateNote.set('');
    this.error.set('');
    this.values.set([]);
    try {
      this.values.set(await firstValueFrom(this.codelists.valuesAll(listName)));
    } catch (err) {
      console.warn('[Codelists] values load failed', err);
      this.error.set('Could not load values.');
    }
  }

  protected patchDraft(p: Partial<{ code: string; label: string; symbol: string }>): void {
    this.draft.update((d) => ({ ...d, ...p }));
  }

  protected async add(parent: Codelist): Promise<void> {
    const d = this.draft();
    try {
      const created = await firstValueFrom(
        this.codelists.addValue(parent.listName, {
          code: d.code.trim(),
          label: d.label.trim(),
          symbol: d.symbol.trim() || undefined,
        })
      );
      this.values.update((list) => [...list, created]);
      this.draft.set({ code: '', label: '', symbol: '' });
      this.error.set('');
    } catch (err) {
      console.warn('[Codelists] add failed', err);
      this.error.set("Couldn't add — a value with this code already exists in this list.");
    }
  }

  protected async save(v: CodelistValue, patch: CodelistValuePatch): Promise<void> {
    const list = this.selected();
    if (!list) return;
    const before = this.values();
    this.values.update((arr) => arr.map((x) => (x.code === v.code ? { ...x, ...patch } : x)));
    try {
      const fresh = await firstValueFrom(this.codelists.patchValue(list, v.code, patch));
      this.values.update((arr) => arr.map((x) => (x.code === v.code ? fresh : x)));
      this.error.set('');
    } catch (err) {
      console.warn('[Codelists] save failed', err);
      this.values.set(before);
      this.error.set(`Couldn't save "${v.code}" — change reverted.`);
    }
  }

  /** Deactivation runs the in-use gate first (locked rule 2 UI copy). */
  protected async toggleActive(parent: Codelist, v: CodelistValue, makeVisible: boolean): Promise<void> {
    this.gateNote.set('');
    if (!makeVisible) {
      try {
        const { count } = await firstValueFrom(this.codelists.usage(parent.listName, v.code));
        if (count !== null && count > 0) {
          this.gateNote.set(
            `Advisory: ${count} record${count === 1 ? '' : 's'} currently use "${v.label}" — they keep displaying it, but no new records can select it. The value was hidden.`
          );
        }
      } catch {
        // Gate count is advisory — its absence must not block curation.
      }
    }
    await this.save(v, { isActive: makeVisible });
  }
}
