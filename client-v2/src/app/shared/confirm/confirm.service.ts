import { Injectable, signal } from '@angular/core';

/** Options for a single confirmation (DIALOGS.md — the blocking modal that
 *  MUST pair with every destructive `.bp-btn-danger` action). */
export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Confirm button copy — Delete / Remove / Yes (DIALOGS.md). Default 'Confirm'. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive (red Confirm button + trash icon) — the default. Set false for
   *  a neutral confirmation (gradient Confirm). */
  danger?: boolean;
  /** Lucide icon in the header puck (default 'trash-2'). */
  icon?: string;
}

/** pV2-STORE-01 — one app-wide confirmation dialog (mounted once in the shell).
 *  Any feature calls `ask()` and awaits the boolean — no per-consumer p-dialog,
 *  no N-dialogs-per-grid. The dialog component binds to this state. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly open = signal(false);
  readonly options = signal<ConfirmOptions | null>(null);
  private resolver: ((v: boolean) => void) | null = null;

  /** Open the dialog; resolves true on Confirm, false on Cancel/ESC/backdrop. */
  ask(options: ConfirmOptions): Promise<boolean> {
    this.options.set(options);
    this.open.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  confirm(): void {
    this.settle(true);
  }
  cancel(): void {
    this.settle(false);
  }

  private settle(value: boolean): void {
    if (!this.resolver) return; // already settled (e.g. confirm → close → cancel)
    this.open.set(false);
    const resolve = this.resolver;
    this.resolver = null;
    resolve(value);
  }
}
