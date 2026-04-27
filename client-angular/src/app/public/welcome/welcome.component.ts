import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, OnInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Public Welcome page — step-through deck.
// Intentionally outside the parchment design system per spec: inline
// brand colours, no PrimeNG, no CSS vars from the app theme.
//
// Visual approach:
//   - Each slide has a flat dark base + 2–3 absolutely-positioned circles
//     (border-radius: 50%) with radial gradients and filter: blur(80–120px)
//   - SVG turbulence grain overlay (baseFrequency 0.80, opacity ~0.20)
//   - Keyboard nav: ← →, Enter advances on slides 1–3
//
// Content is fetched from /api/welcome/content on init; defaults from the
// prototype render immediately so first paint never blocks on the network.

const TOTAL_STEPS = 4;

const ROLE_OPTIONS = [
  'Agency producer',
  'Freelance producer',
  'Supplier',
  'Brand / in-house',
  'Just curious'
];

interface Content {
  [key: string]: string | string[];
}

const DEFAULT_CONTENT: Content = {
  'hero.eyebrow':           'Coming soon · Event production reimagined',
  'hero.headline':          'REAL COSTS,\nREAL FAST.',
  'hero.subtitle':          'Turn your event brief into an accurate estimate in moments.',
  'suppliers.eyebrow':      'The network',
  'suppliers.headline':     'Powered by real costs from our network of incredible suppliers.',
  'suppliers.categories':   ['DESIGN', 'BUILD', 'VENUES', 'FURNITURE', 'AV', 'GRAPHICS', 'CATERING'],
  'producers.headline':     "A PRODUCER'S BEST FRIEND.",
  'producers.tagline':      'By producers, for creators.',
  'producers.body_1':       'Costing events can be a grind. Endless quotes, supplier chasing, tight turnarounds.',
  'producers.body_2':       'Ballpark makes it easy. Instant, accurate costs. Incredible suppliers. Everything in one place.',
  'producers.step_1_label': 'Brief in',
  'producers.step_1_text':  'Type, paste, or drop your event brief',
  'producers.step_2_label': 'AI parses',
  'producers.step_2_text':  'Categories, budget bands, supplier matches',
  'producers.step_3_label': 'Quotes back',
  'producers.step_3_text':  'Real prices from real suppliers',
  'guestlist.eyebrow':         'You made it',
  'guestlist.headline':        'Those who get in early, get ahead.',
  'guestlist.subtitle':        "Get on the guestlist and the moment we're live you'll be the first to know.",
  'guestlist.cta_label':       'Add me to the guestlist',
  'guestlist.success_headline': "You're on the guestlist.",
  'guestlist.success_body':    "We'll be in touch the moment Ballpark goes live, {{firstName}}."
};

@Component({
  selector: 'app-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bp-welcome-root">

      <!-- Persistent header -->
      <header class="bp-welcome-header">
        <button class="bp-welcome-logo" (click)="goTo(0)">BALLPARK</button>
        <div class="bp-welcome-counter">
          {{ stepLabel }} / {{ totalLabel }}
        </div>
      </header>

      <!-- Slide stage -->
      <div class="bp-welcome-stage" [class.forward]="direction === 'forward'" [class.backward]="direction === 'backward'" [attr.data-step]="step">

        <!-- ── Slide 1: Hero ────────────────────────────── -->
        <section *ngIf="step === 0" class="bp-slide bp-slide-1">
          <div class="bp-blob bp-blob-1a"></div>
          <div class="bp-blob bp-blob-1b"></div>
          <div class="bp-blob bp-blob-1c"></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-1-inner">
            <span class="bp-eyebrow-pill">{{ text('hero.eyebrow') }}</span>
            <h1 class="bp-hero-headline" [innerHTML]="multiline(text('hero.headline'))"></h1>
            <p class="bp-hero-subtitle">{{ text('hero.subtitle') }}</p>
          </div>
        </section>

        <!-- ── Slide 2: Suppliers ───────────────────────── -->
        <section *ngIf="step === 1" class="bp-slide bp-slide-2">
          <div class="bp-blob bp-blob-2a"></div>
          <div class="bp-blob bp-blob-2b"></div>
          <div class="bp-blob bp-blob-2c"></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-2-inner">
            <div class="bp-eyebrow">{{ text('suppliers.eyebrow') }}</div>
            <h2 class="bp-suppliers-headline">{{ text('suppliers.headline') }}</h2>
          </div>
          <div class="bp-marquee-wrap">
            <div class="bp-marquee-track">
              <div *ngFor="let cat of marqueeCategories" class="bp-marquee-item">
                {{ cat }}<span class="bp-marquee-sep">✦</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Slide 3: Producers ───────────────────────── -->
        <section *ngIf="step === 2" class="bp-slide bp-slide-3">
          <div class="bp-blob bp-blob-3a"></div>
          <div class="bp-blob bp-blob-3b"></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-3-inner">
            <div class="bp-producers-grid">
              <div>
                <h2 class="bp-producers-headline">{{ text('producers.headline') }}</h2>
                <p class="bp-producers-tagline">{{ text('producers.tagline') }}</p>
              </div>
              <div class="bp-producers-card">
                <p class="bp-producers-body">{{ text('producers.body_1') }}</p>
                <p class="bp-producers-body">{{ text('producers.body_2') }}</p>
                <div class="bp-producers-steps">
                  <div class="bp-producers-step">
                    <div class="bp-producers-step-label">{{ text('producers.step_1_label') }}</div>
                    <div class="bp-producers-step-text">{{ text('producers.step_1_text') }}</div>
                  </div>
                  <div class="bp-producers-step">
                    <div class="bp-producers-step-label">{{ text('producers.step_2_label') }}</div>
                    <div class="bp-producers-step-text">{{ text('producers.step_2_text') }}</div>
                  </div>
                  <div class="bp-producers-step">
                    <div class="bp-producers-step-label">{{ text('producers.step_3_label') }}</div>
                    <div class="bp-producers-step-text">{{ text('producers.step_3_text') }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Slide 4: Guestlist ───────────────────────── -->
        <section *ngIf="step === 3" class="bp-slide bp-slide-4">
          <div class="bp-blob bp-blob-4a"></div>
          <div class="bp-blob bp-blob-4b"></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-4-inner">
            <div class="bp-eyebrow">{{ text('guestlist.eyebrow') }}</div>
            <h2 class="bp-guestlist-headline">{{ text('guestlist.headline') }}</h2>
            <p class="bp-guestlist-subtitle">{{ text('guestlist.subtitle') }}</p>

            <div *ngIf="!submitted" class="bp-guestlist-form">
              <div class="bp-form-row">
                <div>
                  <label class="bp-form-label">Name</label>
                  <input class="bp-form-input" type="text" [(ngModel)]="form.name" placeholder="Jane Doe" />
                </div>
                <div>
                  <label class="bp-form-label">Email</label>
                  <input class="bp-form-input" type="email" [(ngModel)]="form.email" placeholder="jane@studio.com" />
                </div>
              </div>
              <div class="bp-form-block">
                <label class="bp-form-label">Company</label>
                <input class="bp-form-input" type="text" [(ngModel)]="form.company" placeholder="Studio name (optional)" />
              </div>
              <div class="bp-form-block">
                <label class="bp-form-label">I am a…</label>
                <select class="bp-form-input bp-form-select" [(ngModel)]="form.role">
                  <option *ngFor="let r of roleOptions" [value]="r">{{ r }}</option>
                </select>
              </div>
              <button
                class="bp-guestlist-submit"
                [disabled]="!canSubmit() || submitting"
                (click)="submit()">
                {{ submitting ? 'Adding…' : text('guestlist.cta_label') }}
              </button>
              <p *ngIf="errorMessage" class="bp-form-error">{{ errorMessage }}</p>
            </div>

            <div *ngIf="submitted" class="bp-guestlist-success">
              <div class="bp-success-tick">✓</div>
              <h3 class="bp-success-headline">{{ text('guestlist.success_headline') }}</h3>
              <p class="bp-success-body">{{ successBody }}</p>
            </div>
          </div>
        </section>

      </div>

      <!-- Persistent bottom nav -->
      <div class="bp-welcome-bottom">
        <button
          class="bp-welcome-back"
          (click)="prev()"
          [class.hidden]="step === 0"
          aria-label="Back">
          <span aria-hidden="true">←</span> Back
        </button>

        <div class="bp-welcome-dots">
          <button
            *ngFor="let _ of dots; let i = index"
            class="bp-welcome-dot"
            [class.active]="i === step"
            [attr.aria-label]="'Go to slide ' + (i + 1)"
            (click)="goTo(i)">
          </button>
        </div>

        <button
          class="bp-welcome-next"
          (click)="next()"
          [class.hidden]="step === TOTAL_STEPS - 1"
          aria-label="Next">
          {{ step === TOTAL_STEPS - 2 ? 'Get on the guestlist' : 'Next' }}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <!-- SVG noise filter (referenced by .bp-grain) -->
      <svg class="bp-grain-defs" aria-hidden="true">
        <filter id="bp-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.80" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.20 0"/>
        </filter>
      </svg>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;900&display=swap');

    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      color: #DCF0EB;
      height: 100vh;
      overflow: hidden;
    }

    .bp-welcome-root {
      position: relative;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Header ───────────────────────────────── */
    .bp-welcome-header {
      position: absolute; top: 0; left: 0; right: 0; z-index: 50;
      height: 64px; padding: 0 32px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .bp-welcome-logo {
      font-family: 'Inter', sans-serif;
      font-size: 22px; font-weight: 900; letter-spacing: 0.02em;
      color: #DCF0EB; background: none; border: none; cursor: pointer; padding: 0;
    }
    .bp-welcome-counter {
      font-size: 11px; font-weight: 500; letter-spacing: 0.2em;
      color: rgba(220,240,235,0.7);
      font-variant-numeric: tabular-nums;
    }

    /* ── Slide stage ──────────────────────────── */
    .bp-welcome-stage {
      position: absolute; inset: 0;
    }
    .bp-welcome-stage > section {
      animation: bp-slide-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .bp-welcome-stage.backward > section {
      animation: bp-slide-in-back 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes bp-slide-in {
      from { transform: translateX(40px);  opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes bp-slide-in-back {
      from { transform: translateX(-40px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }

    .bp-slide {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #DCF0EB;
      overflow: hidden;
      isolation: isolate;
    }
    .bp-slide-inner { position: relative; z-index: 5; max-width: 1100px; padding: 0 32px; text-align: center; }

    /* ── Blurred-circle blobs (per-slide) ─────── */
    .bp-blob {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
      filter: blur(110px);
      opacity: 0.95;
    }

    /* Slide 1 — hero · pink (#EB7396) base + pink gradient blobs (FA91B0 → DF5980) */
    .bp-slide-1 { background: #EB7396; }
    .bp-blob-1a { width: 720px; height: 720px; left: -120px; top: -160px;     background: radial-gradient(circle, #FA91B0 0%, #DF5980 55%, rgba(223,89,128,0) 100%); }
    .bp-blob-1b { width: 800px; height: 800px; right: -160px; top: 80px;       background: radial-gradient(circle, #DF5980 0%, #FA91B0 50%, rgba(250,145,176,0) 100%); }
    .bp-blob-1c { width: 600px; height: 600px; left: 30%; bottom: -200px;      background: radial-gradient(circle, #FA91B0 0%, #DF5980 60%, rgba(223,89,128,0) 100%); }

    /* Slide 2 — suppliers · blue (#6391A4) base + blue gradient blobs (79A8BA → 457187) */
    .bp-slide-2 {
      background: #6391A4;
      flex-direction: column;
      padding: 80px 0 100px;
    }
    .bp-slide-2-inner { margin-bottom: 56px; }
    .bp-blob-2a { width: 760px; height: 760px; left: -160px; top: -120px;      background: radial-gradient(circle, #79A8BA 0%, #457187 55%, rgba(69,113,135,0) 100%); }
    .bp-blob-2b { width: 760px; height: 760px; left: 30%;    top: 30%;          background: radial-gradient(circle, #457187 0%, #79A8BA 50%, rgba(121,168,186,0) 100%); }
    .bp-blob-2c { width: 740px; height: 740px; right: -180px; bottom: -120px;  background: radial-gradient(circle, #79A8BA 0%, #457187 60%, rgba(69,113,135,0) 100%); }

    /* Slide 3 — producers · green (#2D8E53) base + green gradient blobs (33A25F → 133C23) */
    .bp-slide-3 { background: #2D8E53; }
    .bp-blob-3a { width: 800px; height: 800px; left: -160px; top: -120px;      background: radial-gradient(circle, #33A25F 0%, #133C23 60%, rgba(19,60,35,0) 100%); }
    .bp-blob-3b { width: 720px; height: 720px; right: -200px; bottom: -160px;  background: radial-gradient(circle, #133C23 0%, #33A25F 45%, rgba(51,162,95,0) 100%); }

    /* Slide 4 — guestlist · same green base, varied composition for visual lift */
    .bp-slide-4 { background: #2D8E53; }
    .bp-blob-4a { width: 820px; height: 820px; left: -180px; top: -200px;      background: radial-gradient(circle, #33A25F 0%, #133C23 55%, rgba(19,60,35,0) 100%); }
    .bp-blob-4b { width: 720px; height: 720px; right: -180px; bottom: -120px;  background: radial-gradient(circle, #133C23 0%, #33A25F 50%, rgba(51,162,95,0) 100%); }

    /* ── Grain overlay ────────────────────────── */
    .bp-grain {
      position: absolute; inset: 0;
      z-index: 4;
      pointer-events: none;
      mix-blend-mode: overlay;
      opacity: 0.85; /* the SVG matrix already attenuates to ~0.20 */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.20 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .bp-grain-defs { position: absolute; width: 0; height: 0; }

    /* ── Slide 1 typography ───────────────────── */
    .bp-eyebrow-pill {
      display: inline-block;
      font-family: 'Inter', sans-serif;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.18em; text-transform: uppercase;
      background: rgba(220,240,235,0.15);
      border: 1px solid rgba(220,240,235,0.35);
      border-radius: 999px;
      padding: 6px 16px;
      margin-bottom: 32px;
      backdrop-filter: blur(8px);
    }
    .bp-hero-headline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(56px, 11vw, 144px);
      font-weight: 900;
      line-height: 0.95;
      letter-spacing: -0.04em;
      margin: 0 0 28px 0;
    }
    .bp-hero-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: clamp(17px, 2vw, 21px);
      font-weight: 500; line-height: 1.5;
      max-width: 560px; margin: 0 auto;
      opacity: 0.95;
    }

    /* ── Slide 2 typography + marquee ─────────── */
    .bp-eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.2em; text-transform: uppercase;
      opacity: 0.75;
      margin-bottom: 24px;
    }
    .bp-suppliers-headline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(40px, 6.5vw, 88px);
      font-weight: 900; line-height: 1.05; letter-spacing: -0.02em;
      margin: 0;
      max-width: 1000px;
    }
    .bp-marquee-wrap {
      width: 100%; overflow: hidden;
      border-top: 1px solid rgba(220,240,235,0.2);
      border-bottom: 1px solid rgba(220,240,235,0.2);
      padding: 24px 0;
      position: relative; z-index: 5;
    }
    .bp-marquee-track {
      display: flex; white-space: nowrap; width: max-content;
      animation: bp-scroll-x 28s linear infinite;
    }
    .bp-marquee-item {
      display: flex; align-items: center;
      font-family: 'Inter', sans-serif;
      font-size: clamp(36px, 5vw, 64px);
      font-weight: 900; letter-spacing: 0.02em;
      padding: 0 48px;
      flex-shrink: 0;
    }
    .bp-marquee-sep { margin-left: 48px; opacity: 0.4; font-size: 0.6em; }
    @keyframes bp-scroll-x {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* ── Slide 3 ──────────────────────────────── */
    .bp-slide-3-inner { max-width: 1200px; }
    .bp-producers-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 64px; align-items: center; text-align: left;
    }
    .bp-producers-headline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(48px, 8vw, 112px);
      font-weight: 900; line-height: 0.95;
      letter-spacing: -0.03em;
      margin: 0 0 24px 0;
    }
    .bp-producers-tagline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(20px, 2.4vw, 28px);
      font-weight: 500;
      opacity: 0.9; margin: 0;
    }
    .bp-producers-card {
      background: rgba(220,240,235,0.08);
      border: 1px solid rgba(220,240,235,0.18);
      border-radius: 16px; padding: 32px;
      backdrop-filter: blur(12px);
    }
    .bp-producers-body {
      font-family: 'Inter', sans-serif;
      font-size: 16px; font-weight: 500;
      line-height: 1.7; opacity: 0.95; margin: 0 0 20px 0;
    }
    .bp-producers-body:last-of-type { margin-bottom: 28px; }
    .bp-producers-steps { display: flex; flex-direction: column; gap: 12px; }
    .bp-producers-step { display: flex; align-items: baseline; gap: 16px; }
    .bp-producers-step-label {
      font-family: 'Inter', sans-serif;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.15em; text-transform: uppercase;
      opacity: 0.7; min-width: 80px;
    }
    .bp-producers-step-text {
      font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 500; opacity: 0.9;
    }

    @media (max-width: 768px) {
      .bp-producers-grid { grid-template-columns: 1fr; gap: 32px; text-align: center; }
      .bp-producers-step { justify-content: center; }
    }

    /* ── Slide 4 ──────────────────────────────── */
    .bp-slide-4-inner { max-width: 560px; width: 100%; }
    .bp-guestlist-headline {
      font-family: 'Inter', sans-serif;
      font-size: clamp(36px, 5.5vw, 64px);
      font-weight: 900; line-height: 1.05; letter-spacing: -0.02em;
      margin: 0 0 16px 0;
    }
    .bp-guestlist-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 16px; font-weight: 500;
      line-height: 1.6;
      opacity: 0.9; margin: 0 0 36px 0;
    }
    .bp-guestlist-form {
      background: rgba(220,240,235,0.08);
      border: 1px solid rgba(220,240,235,0.2);
      border-radius: 16px;
      padding: 28px;
      backdrop-filter: blur(12px);
      text-align: left;
    }
    .bp-form-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px; margin-bottom: 12px;
    }
    .bp-form-block { margin-bottom: 12px; }
    .bp-form-block:has(.bp-form-select) { margin-bottom: 20px; }
    .bp-form-label {
      display: block;
      font-family: 'Inter', sans-serif;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      opacity: 0.75; margin-bottom: 6px;
    }
    .bp-form-input {
      width: 100%; box-sizing: border-box;
      padding: 11px 14px;
      background: rgba(220,240,235,0.1);
      border: 1px solid rgba(220,240,235,0.25);
      border-radius: 8px;
      color: #DCF0EB; font-size: 14px;
      font-family: 'Inter', sans-serif; font-weight: 500;
      outline: none;
    }
    .bp-form-input::placeholder { color: rgba(220,240,235,0.45); }
    .bp-form-input:focus { border-color: rgba(220,240,235,0.55); }
    .bp-form-select { cursor: pointer; appearance: none; }
    .bp-form-select option { color: #133C23; }
    .bp-form-error {
      margin: 10px 0 0;
      font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 500;
      color: #FFD3DD;
    }
    .bp-guestlist-submit {
      width: 100%;
      margin-top: 4px;
      padding: 14px 24px;
      font-family: 'Inter', sans-serif;
      font-size: 15px; font-weight: 700;
      background: #DCF0EB; color: #133C23;
      border: none; border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .bp-guestlist-submit:disabled {
      background: rgba(220,240,235,0.3);
      color: rgba(220,240,235,0.6);
      cursor: not-allowed;
    }
    .bp-guestlist-success {
      background: rgba(220,240,235,0.1);
      border: 1px solid rgba(220,240,235,0.3);
      border-radius: 16px;
      padding: 40px;
      backdrop-filter: blur(12px);
    }
    .bp-success-tick {
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(220,240,235,0.18);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 18px; font-size: 28px;
    }
    .bp-success-headline {
      font-family: 'Inter', sans-serif;
      font-size: 26px; font-weight: 900;
      margin: 0 0 10px 0;
    }
    .bp-success-body {
      font-family: 'Inter', sans-serif;
      font-size: 15px; font-weight: 500;
      line-height: 1.6; opacity: 0.9; margin: 0;
    }

    /* ── Bottom nav ───────────────────────────── */
    .bp-welcome-bottom {
      position: absolute; bottom: 0; left: 0; right: 0; z-index: 50;
      padding: 20px 32px 28px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; pointer-events: none;
    }
    .bp-welcome-back, .bp-welcome-next, .bp-welcome-dots { pointer-events: auto; }
    .bp-welcome-back {
      background: rgba(220,240,235,0.14);
      border: 1px solid rgba(220,240,235,0.3);
      color: #DCF0EB;
      padding: 10px 18px; border-radius: 999px;
      font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 500;
      cursor: pointer; backdrop-filter: blur(8px);
      display: inline-flex; align-items: center; gap: 8px;
      transition: all 0.2s;
    }
    .bp-welcome-back:hover { background: rgba(220,240,235,0.22); }
    .bp-welcome-back.hidden { opacity: 0; visibility: hidden; }
    .bp-welcome-next {
      background: #DCF0EB; color: #133C23;
      border: none;
      padding: 12px 24px; border-radius: 999px;
      font-family: 'Inter', sans-serif;
      font-size: 14px; font-weight: 700;
      cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      transition: all 0.2s;
    }
    .bp-welcome-next:hover { transform: translateY(-1px); }
    .bp-welcome-next.hidden { opacity: 0; visibility: hidden; }
    .bp-welcome-dots { display: flex; gap: 8px; }
    .bp-welcome-dot {
      width: 8px; height: 8px;
      border-radius: 999px; border: none;
      background: rgba(220,240,235,0.45);
      cursor: pointer; padding: 0;
      transition: width 0.3s, background 0.3s;
    }
    .bp-welcome-dot.active { width: 28px; background: #DCF0EB; }
  `]
})
export class WelcomeComponent implements OnInit, OnDestroy {
  readonly TOTAL_STEPS = TOTAL_STEPS;
  readonly roleOptions = ROLE_OPTIONS;
  readonly dots = Array.from({ length: TOTAL_STEPS });

  step = 0;
  direction: 'forward' | 'backward' = 'forward';
  content: Content = { ...DEFAULT_CONTENT };

  form = {
    name:    '',
    email:   '',
    company: '',
    role:    ROLE_OPTIONS[0]
  };
  submitting = false;
  submitted  = false;
  errorMessage: string | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.http.get<Content>(`${environment.apiUrl}/welcome/content`).subscribe({
      next: (content) => {
        if (content && typeof content === 'object') {
          // Merge fetched values, falling back to defaults for any missing keys
          this.content = { ...DEFAULT_CONTENT, ...content };
          this.cdr.markForCheck();
        }
      },
      error: () => { /* keep defaults */ }
    });
  }

  ngOnDestroy() {}

  // ── Content access ────────────────────────────────────────────
  text(key: string): string {
    const v = this.content[key];
    return Array.isArray(v) ? v.join(', ') : (v ?? '');
  }
  list(key: string): string[] {
    const v = this.content[key];
    return Array.isArray(v) ? v : [];
  }
  multiline(s: string): string {
    // Convert literal "\n" (from longtext seed) and real newlines into <br>
    return (s || '').replace(/\\n/g, '\n').replace(/\n/g, '<br>');
  }

  get marqueeCategories(): string[] {
    const cats = this.list('suppliers.categories');
    if (!cats.length) return [];
    // 3× repeat for seamless scroll
    return [...cats, ...cats, ...cats];
  }

  get stepLabel(): string  { return String(this.step + 1).padStart(2, '0'); }
  get totalLabel(): string { return String(TOTAL_STEPS).padStart(2, '0'); }

  // ── Navigation ────────────────────────────────────────────────
  next() {
    if (this.step < TOTAL_STEPS - 1) {
      this.direction = 'forward';
      this.step++;
      this.cdr.markForCheck();
    }
  }
  prev() {
    if (this.step > 0) {
      this.direction = 'backward';
      this.step--;
      this.cdr.markForCheck();
    }
  }
  goTo(i: number) {
    if (i === this.step) return;
    this.direction = i > this.step ? 'forward' : 'backward';
    this.step = i;
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.submitted) return;
    const tag = (e.target as HTMLElement)?.tagName;
    const isFormField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft' && !isFormField) this.prev();
    if (e.key === 'Enter' && this.step < TOTAL_STEPS - 1 && !isFormField) this.next();
  }

  // ── Submit ────────────────────────────────────────────────────
  canSubmit(): boolean {
    return this.form.name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  submit() {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const body = {
      name:    this.form.name.trim(),
      email:   this.form.email.trim(),
      company: this.form.company.trim() || null,
      role:    this.form.role
    };
    this.http.post<{ success: boolean; alreadyRegistered?: boolean }>(
      `${environment.apiUrl}/guestlist/signup`, body
    ).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 429) {
          this.errorMessage = 'Slow down — too many signups from this connection. Try again in a minute.';
        } else if (err.status === 400 && err.error?.error) {
          this.errorMessage = err.error.error;
        } else {
          // Network or 500 — show success anyway, log under the hood
          console.warn('[welcome] Signup request failed, showing success:', err);
          this.submitted = true;
        }
        this.cdr.markForCheck();
      }
    });
  }

  get successBody(): string {
    const tpl = this.text('guestlist.success_body');
    const firstName = this.form.name.trim().split(' ')[0] || this.form.name.trim();
    return tpl.replace(/\{\{firstName\}\}/g, firstName);
  }
}
