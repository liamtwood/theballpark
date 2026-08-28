import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import * as pdfjs from 'pdfjs-dist';

// pdf.js worker — the ESM worker file is copied to the served root by
// angular.json (assets). Resolve it against the app's base href so it works
// under any deploy path.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

/** pV2-BUILDUP-04 — render a PDF as a stack of full-width page images (canvas),
 *  inline with the surrounding document — NO viewer chrome, so an attached PDF
 *  (e.g. the SOW's Annex A T&Cs) reads as more pages of the same document rather
 *  than an embedded "other file". A screen preview; the crisp vector merge into
 *  the final combined PDF is the server (Puppeteer) stage. */
@Component({
  selector: 'app-pdf-pages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div #host class="flex flex-col gap-3"></div>
    @if (loading()) { <p class="bp-body-small p-4 text-center text-secondary">Loading pages…</p> }
    @if (failed()) { <p class="bp-body-small p-4 text-center text-danger">Couldn't render the PDF.</p> }
  `,
  styles: [`
    :host ::ng-deep canvas { display: block; width: 100%; height: auto; }
  `],
})
export class PdfPagesComponent {
  readonly url = input.required<string>();
  private readonly hostRef = viewChild<ElementRef<HTMLDivElement>>('host');
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private token = 0;

  constructor() {
    effect(() => {
      const url = this.url();
      const host = this.hostRef()?.nativeElement;
      if (host) void this.render(url, host);
    });
    inject(DestroyRef).onDestroy(() => { this.token += 1; });
  }

  private async render(url: string, host: HTMLElement): Promise<void> {
    const mine = ++this.token;
    host.replaceChildren();
    if (!url) return;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const pdf = await pdfjs.getDocument({ url }).promise;
      const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.5);
      for (let i = 1; i <= pdf.numPages; i += 1) {
        if (mine !== this.token) return; // a newer render superseded this one
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (mine !== this.token) return;
        host.appendChild(canvas);
      }
    } catch {
      if (mine === this.token) this.failed.set(true);
    } finally {
      if (mine === this.token) this.loading.set(false);
    }
  }
}
