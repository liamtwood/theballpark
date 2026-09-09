import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectCard } from '../../core/projects/project.types';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';

/** The item being placed — enough for the title + the add call. */
export interface AddToProjectItem {
  id: string;
  name: string;
  basePrice: number | null;
  unit: string | null;
}

/** pV2 — the marketplace "Add to project" picker (v1 feature, rebuilt).
 *  Lists "Add to a new project" + the 3 most-recent projects (name, client
 *  name, status pill). New → the brief flow; existing → adds the item to that
 *  project's quote. Parent-controlled: renders when `item` is set. */
@Component({
  selector: 'app-add-to-project-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DialogModule, StatusPillComponent],
  template: `
    <p-dialog
      [visible]="!!item()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '460px' }"
    >
      <ng-template pTemplate="header">
        @if (item(); as it) {
          <div>
            <h2 class="bp-card-title">Add {{ it.name }}</h2>
            <p class="bp-body mt-1 text-secondary">
              @if (it.basePrice !== null) {
                Indicative {{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}{{ it.unit ? ' per ' + it.unit : '' }}.
              }
              Choose where this should go.
            </p>
          </div>
        }
      </ng-template>

      <div class="flex flex-col gap-2 py-1">
        <!-- New project -->
        <button type="button" class="bp-atp-opt" [class.bp-atp-opt--sel]="selected() === 'new'" (click)="selected.set('new')">
          <span class="bp-atp-radio" [class.bp-atp-radio--on]="selected() === 'new'"></span>
          <span class="min-w-0 flex-1 text-left">
            <span class="bp-atp-name">Add to a new project</span>
            <span class="bp-atp-sub">Takes you to the brief so we can ballpark the whole event.</span>
          </span>
        </button>

        @if (recent().length) {
          @for (p of recent(); track p.id) {
            <button type="button" class="bp-atp-opt" [class.bp-atp-opt--sel]="selected() === p.id" (click)="selected.set(p.id)">
              <span class="bp-atp-radio" [class.bp-atp-radio--on]="selected() === p.id"></span>
              <span class="min-w-0 flex-1 text-left">
                <span class="bp-atp-name">{{ p.name }}</span>
                @if (p.clientName) {
                  <span class="bp-atp-sub">{{ p.clientName }}</span>
                }
              </span>
              <app-status-pill list="project_status" [code]="p.status" />
            </button>
          }
        }
      </div>

      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="close.emit()">Cancel</button>
        <button type="button" class="bp-btn-grad" [disabled]="busy()" (click)="confirm()">
          {{ selected() === 'new' ? 'Start new project' : busy() ? 'Adding…' : 'Add to project' }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .bp-atp-opt {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        cursor: pointer;
        text-align: left;
      }
      .bp-atp-opt:hover {
        background: var(--color-fill);
      }
      .bp-atp-opt--sel {
        border-color: var(--theme-accent);
        background: var(--theme-soft);
      }
      .bp-atp-radio {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid var(--color-border-medium);
        background: var(--color-surface);
      }
      .bp-atp-radio--on {
        border-color: var(--theme-accent);
        background: radial-gradient(circle at center, var(--theme-accent) 0 5px, var(--color-surface) 6px);
      }
      .bp-atp-name {
        display: block;
        font-family: var(--font-body);
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--color-text);
      }
      .bp-atp-sub {
        display: block;
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class AddToProjectDialogComponent {
  private readonly projects = inject(ProjectService);
  private readonly router = inject(Router);

  readonly item = input<AddToProjectItem | null>(null);
  readonly close = output<void>();
  readonly added = output<{ projectId: string; itemName: string }>();

  /** Resets to "new" whenever a different item opens the dialog. */
  protected readonly selected = linkedSignal<string | null, string>({
    source: () => this.item()?.id ?? null,
    computation: () => 'new',
  });
  protected readonly busy = signal(false);

  private readonly projectsRes = resource({
    loader: () => firstValueFrom(this.projects.list()),
  });
  /** Three most-recently-updated projects. */
  protected readonly recent = computed<ProjectCard[]>(() =>
    [...(this.projectsRes.value() ?? [])]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 3)
  );

  protected onVisible(visible: boolean): void {
    if (!visible) this.close.emit();
  }

  protected async confirm(): Promise<void> {
    const it = this.item();
    if (!it) return;
    const target = this.selected();
    if (target === 'new') {
      void this.router.navigate(['/projects/new']);
      this.close.emit();
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.projects.addQuoteItem(target, it.id));
      this.added.emit({ projectId: target, itemName: it.name });
      this.close.emit();
    } catch (err) {
      console.warn('[AddToProject] add failed', err);
    } finally {
      this.busy.set(false);
    }
  }
}
