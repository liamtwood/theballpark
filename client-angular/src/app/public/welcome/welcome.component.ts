import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, OnInit, OnDestroy, AfterViewInit,
  ViewChildren, QueryList, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Public Welcome page — step-through deck.
// Intentionally outside the parchment design system per spec: inline
// brand colours, no PrimeNG, no CSS vars from the app theme.
//
// Visual approach — locked recipe, see WORKING_STANDARDS.md → Marketing Visual Recipe:
//   - Flat brand-coloured base per slide + inline <svg viewBox="0 0 800 500"> with two
//     gradient-filled <circle> elements wrapped in <g filter="url(#blur)">; <feGaussianBlur
//     stdDeviation="20">. Don't substitute CSS filter: blur() — calibrated against prototype.
//   - SVG turbulence grain overlay (baseFrequency 0.80, numOctaves 3, opacity 0.20, mix-blend overlay)
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

      <!-- Persistent header. v1.65g9 — logo is now an image when the
           agency's marketplace-logo has been uploaded (loaded from
           /api/org on init), with the text wordmark as a fallback so
           first paint never blocks on the network. -->
      <header class="bp-welcome-header">
        <button class="bp-welcome-logo" (click)="goTo(0)" [class.bp-welcome-logo--img]="logoUrl">
          <img *ngIf="logoUrl" [src]="logoUrl" alt="Ballpark" class="bp-welcome-logo-img"/>
          <span *ngIf="!logoUrl">BALLPARK</span>
        </button>
        <div class="bp-welcome-counter">
          {{ stepLabel }} / {{ totalLabel }}
        </div>
      </header>

      <!-- Slide stage. v1.65gL — restructured as a scroll-snap
           container. All four slides render simultaneously stacked
           vertically; CSS scroll-snap handles mouse wheel, trackpad,
           touch swipe, and the browser's native keyboard scroll.
           IntersectionObserver in TS tracks which slide is in view
           and adds .in-view to its section (one-shot — animations
           don't replay on scroll back). Step state is derived from
           scroll position; pagination + counter still bind to it. -->
      <div class="bp-welcome-stage" #stage>

        <!-- ── Slide 1: Hero ────────────────────────────── -->
        <section #slideRef data-slide="0" class="bp-slide bp-slide-1">
          <div class="bp-bg-layer"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s1-pink" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#FA91B0"/>
                <stop offset="100%" stop-color="#DF5980"/>
              </linearGradient>
              <filter id="s1-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g filter="url(#s1-blur)">
              <circle cx="100" cy="250" r="280" fill="url(#s1-pink)"/>
              <circle cx="700" cy="250" r="280" fill="url(#s1-pink)"/>
            </g>
          </svg></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-1-inner">
            <!-- v1.65gB — eyebrow pill replaced with "Welcome to" +
                 the BALLPARK wordmark, per the design review. Falls
                 back to the original eyebrow text when the logo
                 hasn't loaded so first paint never feels empty. -->
            <div class="bp-eyebrow-welcome">
              <span class="bp-eyebrow-welcome-prefix">Welcome to</span>
              <img *ngIf="logoUrl" [src]="logoUrl" alt="Ballpark" class="bp-eyebrow-welcome-logo"/>
              <span *ngIf="!logoUrl" class="bp-eyebrow-welcome-fallback">BALLPARK</span>
            </div>
            <h1 class="bp-hero-headline" [innerHTML]="multiline(text('hero.headline'))"></h1>
            <p class="bp-hero-subtitle">{{ text('hero.subtitle') }}</p>
          </div>
        </section>

        <!-- ── Slide 2: Suppliers ───────────────────────── -->
        <section #slideRef data-slide="1" class="bp-slide bp-slide-2">
          <div class="bp-bg-layer"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s2-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#79A8BA"/>
                <stop offset="100%" stop-color="#457187"/>
              </linearGradient>
              <filter id="s2-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g filter="url(#s2-blur)">
              <circle cx="700" cy="0"   r="280" fill="url(#s2-blue)"/>
              <circle cx="100" cy="500" r="280" fill="url(#s2-blue)"/>
            </g>
          </svg></div>
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
        <section #slideRef data-slide="2" class="bp-slide bp-slide-3">
          <div class="bp-bg-layer"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s3-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stop-color="#2D8E53"/>
                <stop offset="100%" stop-color="#133C23"/>
              </linearGradient>
              <linearGradient id="s3-light" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stop-color="#33A25F"/>
                <stop offset="100%" stop-color="#2D8E53"/>
              </linearGradient>
              <filter id="s3-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g filter="url(#s3-blur)">
              <circle cx="400" cy="0"   r="280" fill="url(#s3-dark)"/>
              <circle cx="400" cy="500" r="280" fill="url(#s3-light)"/>
            </g>
          </svg></div>
          <div class="bp-grain"></div>
          <div class="bp-slide-inner bp-slide-3-inner">
            <div class="bp-producers-grid">
              <div>
                <h2 class="bp-producers-headline">{{ text('producers.headline') }}</h2>
                <p class="bp-producers-tagline">{{ text('producers.tagline') }}</p>
              </div>
              <div>
                <p class="bp-producers-body">{{ text('producers.body_1') }}</p>
                <p class="bp-producers-body">{{ text('producers.body_2') }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Slide 4: Guestlist ───────────────────────── -->
        <section #slideRef data-slide="3" class="bp-slide bp-slide-4">
          <div class="bp-bg-layer"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s4-darkgreen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#33A25F"/>
                <stop offset="100%" stop-color="#133C23"/>
              </linearGradient>
              <filter id="s4-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g filter="url(#s4-blur)">
              <circle cx="100" cy="250" r="280" fill="url(#s4-darkgreen)"/>
              <circle cx="700" cy="250" r="280" fill="url(#s4-darkgreen)"/>
            </g>
          </svg></div>
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

      <!-- v1.65gE — slide indicator "train" is now a vertical pill
           strip on the LEFT edge (per design review mockup). The
           Back / Next CTAs stay in the bottom nav. -->
      <div class="bp-welcome-dots bp-welcome-dots--vertical">
        <button
          *ngFor="let _ of dots; let i = index"
          class="bp-welcome-dot"
          [class.active]="i === step"
          [attr.aria-label]="'Go to slide ' + (i + 1)"
          (click)="goTo(i)">
        </button>
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

        <button
          class="bp-welcome-next"
          (click)="next()"
          [class.hidden]="step === TOTAL_STEPS - 1"
          aria-label="Get on the guestlist">
          Get on the guestlist
          <span aria-hidden="true">→</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    /* v1.65g8 — Fraunces (OFL, free for commercial) stands in for
       the personal-use-only Sharpe trial until the licensed Sharpe
       pack is bought and dropped in. Closest free-for-commercial
       match: variable serif, high contrast, full weight range,
       italics. Swap back to Sharpe by replacing this @import and
       changing 'Fraunces' → 'Sharpe' across the rules below. */
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap');

    :host {
      display: block;
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
      font-size: 22px; font-weight: 900; letter-spacing: 0.02em;
      color: #DCF0EB; background: none; border: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center;
    }
    /* v1.65g9 — image variant. The uploaded BALLPARK wordmark sits
       at the same vertical height as the text fallback so swapping
       between the two doesn't shift the header layout.
       v1.65gA — render as solid white on the coloured welcome
       backgrounds via brightness(0) + invert(1) (drops every
       non-transparent pixel to pure white). This REQUIRES the
       uploaded logo to have a transparent background — re-upload
       through /ballpark-settings/marketplace with the "Remove
       background" checkbox enabled. A magenta-on-white JPG would
       end up as a white rectangle blocking the gradient. */
    .bp-welcome-logo-img {
      height: 32px;
      width: auto;
      display: block;
      object-fit: contain;
      filter: brightness(0) invert(1);
    }
    .bp-welcome-counter {
      font-size: 11px; font-weight: 500; letter-spacing: 0.2em;
      color: rgba(220,240,235,0.7);
      font-variant-numeric: tabular-nums;
    }

    /* ── Slide stage ──────────────────────────── */
    /* v1.65gL — scroll-snap container. All four slides stack
       vertically at 100vh each; the browser handles wheel/trackpad
       /touch/keyboard scroll natively. IntersectionObserver in TS
       adds .in-view to the current slide (one-shot) which fires the
       per-slide entry animations. */
    .bp-welcome-stage {
      position: absolute; inset: 0;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
      /* Hide scrollbar across browsers. Safari (desktop + iOS)
         ignores plain `display: none` on ::-webkit-scrollbar under
         scroll-snap — the track stays as a faint coloured strip on
         the right edge of the welcome page (client-reported v1.65gL).
         Forcing width: 0 + transparent track/thumb removes it. */
      scrollbar-width: none;             /* Firefox */
      -ms-overflow-style: none;          /* Edge legacy */
      overscroll-behavior: contain;      /* iOS rubber-band suppression */
    }
    .bp-welcome-stage::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
      background: transparent;
    }
    .bp-welcome-stage::-webkit-scrollbar-track,
    .bp-welcome-stage::-webkit-scrollbar-thumb,
    .bp-welcome-stage::-webkit-scrollbar-corner {
      background: transparent;
    }

    /* v1.65gL — bg layer wrapper. With scroll-snap the user is
       already scrolling, so the orbs "scroll in" naturally as the
       slide enters the viewport — no separate CSS wipe animation
       needed (and any transform/clip-path on an ancestor of the
       filtered SVG breaks the Gaussian blur compositing). */
    .bp-bg-layer {
      position: absolute; inset: 0;
      z-index: 1;
      pointer-events: none;
    }

    /* ── Slide 2 enters: text scrolls up ── */
    .bp-slide-2.in-view .bp-slide-2-inner {
      animation: bp-scroll-up 1.05s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bp-slide-2.in-view .bp-marquee-wrap {
      animation: bp-scroll-up 1.05s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both;
    }
    @keyframes bp-scroll-up {
      from { transform: translateY(80px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* ── Slide 3 enters: left from left, right (delayed 1.1s) from right ── */
    .bp-slide-3.in-view .bp-producers-grid > div:first-child {
      animation: bp-from-left 1.05s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bp-slide-3.in-view .bp-producers-grid > div:last-child {
      animation: bp-from-right 1.05s cubic-bezier(0.22, 1, 0.36, 1) 1.1s both;
    }
    @keyframes bp-from-left {
      from { transform: translateX(-120px); opacity: 0; }
      to   { transform: translateX(0);      opacity: 1; }
    }
    @keyframes bp-from-right {
      from { transform: translateX(120px);  opacity: 0; }
      to   { transform: translateX(0);      opacity: 1; }
    }

    /* ── Slide 4 enters — SURPRISE ── */
    .bp-slide-4.in-view .bp-slide-4-inner .bp-eyebrow {
      animation: bp-stamp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
    }
    @keyframes bp-stamp {
      0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
      70%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); opacity: 1; }
    }
    .bp-slide-4.in-view .bp-guestlist-headline {
      animation: bp-bounce-in 1.05s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both;
    }
    @keyframes bp-bounce-in {
      0%   { transform: scale(0.7) translateY(30px); opacity: 0; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    .bp-slide-4.in-view .bp-guestlist-subtitle {
      animation: bp-fade-up 0.75s ease-out 0.8s both;
    }
    @keyframes bp-fade-up {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .bp-slide-4.in-view .bp-form-row > div,
    .bp-slide-4.in-view .bp-form-block {
      animation: bp-cascade 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bp-slide-4.in-view .bp-form-row > div:nth-child(1) { animation-delay: 1.0s; }
    .bp-slide-4.in-view .bp-form-row > div:nth-child(2) { animation-delay: 1.15s; }
    .bp-slide-4.in-view .bp-form-block:nth-of-type(1)  { animation-delay: 1.3s; }
    .bp-slide-4.in-view .bp-form-block:nth-of-type(2)  { animation-delay: 1.45s; }
    @keyframes bp-cascade {
      from { transform: translateY(20px) scale(0.97); opacity: 0; }
      to   { transform: translateY(0)    scale(1);    opacity: 1; }
    }
    .bp-slide-4.in-view .bp-guestlist-submit {
      animation: bp-button-pop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) 1.7s both;
    }
    @keyframes bp-button-pop {
      0%   { transform: scale(0.6); opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }

    .bp-slide {
      position: relative;
      height: 100vh;
      width: 100%;
      scroll-snap-align: start;
      scroll-snap-stop: always;
      display: flex; align-items: center; justify-content: center;
      color: #DCF0EB;
      overflow: hidden;
      isolation: isolate;
    }
    .bp-slide-inner { position: relative; z-index: 5; max-width: 1100px; padding: 0 32px; text-align: center; }

    /* ── SVG circle background (per-slide) ──────────────────────────────
       Locked recipe — see WORKING_STANDARDS.md → Marketing Visual Recipe.
       Each slide template inlines an <svg viewBox="0 0 800 500"> with two
       gradient-filled circles wrapped in <g filter="url(#blur)">.
       Don't substitute CSS filter: blur() — calibrated against prototype. */
    .bp-svg-bg {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      display: block;
      z-index: 1;
      pointer-events: none;
    }

    /* Per-slide bases (circle gradients live in template <linearGradient> defs) */
    .bp-slide-1 { background: #287F4D; }
    .bp-slide-2 {
      background: #EB7396;
      flex-direction: column;
      padding: 80px 0 100px;
    }
    .bp-slide-2-inner { margin-bottom: 56px; }
    .bp-slide-3 { background: #6391A4; }
    .bp-slide-4 { background: #6391A4; }

    /* ── Grain overlay (identical on every slide) ───────────────────────
       Calibrated: numOctaves=3, matrix alpha 0.5, div opacity 0.20.
       Don't add div opacity attenuation — the matrix already attenuates. */
    .bp-grain {
      position: absolute; inset: 0;
      z-index: 4;
      pointer-events: none;
      mix-blend-mode: overlay;
      opacity: 0.20;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* ── Slide 1 typography ───────────────────── */
    .bp-eyebrow-pill {
      display: inline-block;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.18em; text-transform: uppercase;
      background: rgba(220,240,235,0.15);
      border: 1px solid rgba(220,240,235,0.35);
      border-radius: 999px;
      padding: 6px 16px;
      margin-bottom: 32px;
      backdrop-filter: blur(8px);
    }
    /* v1.65gB — "Welcome to BALLPARK" replaces the eyebrow pill on
       slide 1. "Welcome to" sits as light italic prefix; the
       wordmark renders inline at the same vertical anchor as the
       text (brightness(0)+invert(1) so the magenta uploaded asset
       reads as pure white on the gradient). */
    .bp-eyebrow-welcome {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 32px;
      color: #DCF0EB;
    }
    .bp-eyebrow-welcome-prefix {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 22px;
      font-weight: 400;
      letter-spacing: -0.01em;
    }
    .bp-eyebrow-welcome-logo {
      height: 28px;
      width: auto;
      display: block;
      object-fit: contain;
      filter: brightness(0) invert(1);
    }
    .bp-eyebrow-welcome-fallback {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.02em;
    }
    .bp-hero-headline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(56px, 11vw, 144px);
      font-weight: 900;
      line-height: 0.95;
      letter-spacing: -0.04em;
      margin: 0 0 28px 0;
    }
    .bp-hero-subtitle {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(17px, 2vw, 21px);
      font-weight: 500; line-height: 1.5;
      max-width: 560px; margin: 0 auto;
      opacity: 0.95;
    }

    /* ── Slide 2 typography + marquee ─────────── */
    .bp-eyebrow {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.2em; text-transform: uppercase;
      opacity: 0.75;
      margin-bottom: 24px;
    }
    .bp-suppliers-headline {
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
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

    /* v1.65gD — vertical marquee variant. Two-column layout: copy
       on the left, scrolling category column on the right. The
       track scrolls upward; the ✦ separator sits centred BELOW
       each label, not to its right. Categories are repeated 3×
       in marqueeCategories so the loop is seamless. */
    .bp-slide-2-grid {
      position: relative; z-index: 5;
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 96px;
      align-items: center;
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 64px;
    }
    .bp-slide-2-inner { padding: 0; text-align: left; align-items: flex-start; }
    .bp-marquee-wrap--vertical {
      width: auto;
      max-height: 70vh;
      overflow: hidden;
      border-top: none;
      border-bottom: none;
      padding: 0;
      mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
    }
    .bp-marquee-track--vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: auto;
      white-space: normal;
      animation: bp-scroll-y 28s linear infinite;
    }
    .bp-marquee-item--vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
      text-align: center;
      font-size: clamp(40px, 6.5vw, 96px);
      line-height: 1;
    }
    .bp-marquee-sep--vertical {
      margin-left: 0;
      margin-top: 18px;
      font-size: 0.4em;
    }
    @keyframes bp-scroll-y {
      0%   { transform: translateY(0); }
      100% { transform: translateY(-33.333%); }
    }

    @media (max-width: 768px) {
      .bp-slide-2-grid { grid-template-columns: 1fr; gap: 40px; padding: 0 32px; }
      .bp-marquee-wrap--vertical { max-height: 40vh; }
    }

    /* ── Slide 3 ──────────────────────────────── */
    .bp-slide-3-inner { max-width: 1400px; }
    .bp-producers-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 96px; align-items: center; text-align: left;
    }
    .bp-producers-headline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(48px, 8vw, 112px);
      font-weight: 900; line-height: 0.95;
      letter-spacing: -0.03em;
      margin: 0 0 24px 0;
    }
    .bp-producers-tagline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(20px, 2.4vw, 28px);
      font-weight: 500;
      opacity: 0.9; margin: 0;
    }
    .bp-producers-body {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 20px; font-weight: 500;
      line-height: 1.6; opacity: 0.95; margin: 0 0 20px 0;
    }
    .bp-producers-body:last-of-type { margin-bottom: 0; }

    @media (max-width: 768px) {
      .bp-producers-grid { grid-template-columns: 1fr; gap: 32px; text-align: center; }
    }

    /* ── Slide 4 ──────────────────────────────── */
    .bp-slide-4-inner { max-width: 560px; width: 100%; }
    .bp-guestlist-headline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(36px, 5.5vw, 64px);
      font-weight: 900; line-height: 1.05; letter-spacing: -0.02em;
      margin: 0 0 16px 0;
    }
    .bp-guestlist-subtitle {
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif; font-weight: 500;
      outline: none;
    }
    .bp-form-input::placeholder { color: rgba(220,240,235,0.45); }
    .bp-form-input:focus { border-color: rgba(220,240,235,0.55); }
    .bp-form-select { cursor: pointer; appearance: none; }
    .bp-form-select option { color: #133C23; }
    .bp-form-error {
      margin: 10px 0 0;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 13px; font-weight: 500;
      color: #FFD3DD;
    }
    .bp-guestlist-submit {
      width: 100%;
      margin-top: 4px;
      padding: 14px 24px;
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
      font-size: 26px; font-weight: 900;
      margin: 0 0 10px 0;
    }
    .bp-success-body {
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
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
      font-family: 'Fraunces', Georgia, serif;
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
      transition: width 0.3s, height 0.3s, background 0.3s;
    }
    .bp-welcome-dot.active { width: 28px; background: #DCF0EB; }
    /* v1.65gE → v1.65gF — vertical train variant for the slide
       indicator. Fixed to the RIGHT edge of the viewport, vertically
       centred. Each dot stacks; the active dot becomes a tall pill
       (height grows, width stays slim) so the indicator reads
       top→bottom like the mockup (active migrates top→bottom as
       you move slide 1 → 4). */
    .bp-welcome-dots--vertical {
      position: fixed;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      flex-direction: column;
      gap: 10px;
      z-index: 60;
      pointer-events: auto;
    }
    .bp-welcome-dots--vertical .bp-welcome-dot.active {
      width: 8px; height: 32px;
    }
  `]
})
export class WelcomeComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly TOTAL_STEPS = TOTAL_STEPS;
  readonly roleOptions = ROLE_OPTIONS;
  readonly dots = Array.from({ length: TOTAL_STEPS });

  /** v1.65gL — references to the four <section #slideRef> elements
      so we can scroll a target slide into view and attach an
      IntersectionObserver. */
  @ViewChildren('slideRef') slideRefs!: QueryList<ElementRef<HTMLElement>>;

  step = 0;
  /** Kept for legacy bindings (template still references it). Now
      always 'forward' since per-slide animations are one-shot. */
  direction: 'forward' | 'backward' = 'forward';
  /** v1.65gL — IntersectionObserver instance for cleanup on destroy. */
  private slideObserver?: IntersectionObserver;
  content: Content = { ...DEFAULT_CONTENT };
  /** v1.65g9 — marketplace logo URL, hydrated from /api/org on init.
      Empty string until the fetch lands; the template falls back to
      the "BALLPARK" text wordmark in that window so first paint
      never feels broken. */
  logoUrl = '';

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
    // v1.65g9 — pull the agency's logo_url from /api/org so the
    // marketplace logo (uploaded via /ballpark-settings/marketplace)
    // appears in the top-left of the welcome page too. /api/org is
    // public, so unauthenticated visitors get the same branding the
    // signed-in admin sees in the app shell. Falls through silently
    // on error — the text fallback covers it.
    this.http.get<any>(`${environment.apiUrl}/org`).subscribe({
      next: (org) => {
        if (org?.logo_url) {
          this.logoUrl = org.logo_url;
          this.cdr.markForCheck();
        }
      },
      error: () => { /* keep text fallback */ }
    });
  }

  ngAfterViewInit() {
    // v1.65gL — IntersectionObserver tracks which slide is in view.
    // Each entry gets .in-view added (one-shot — never removed) so
    // the per-slide entry animations fire when the slide becomes
    // visible and stay settled if the user scrolls back.
    // The most-visible slide drives `step` for the pagination train
    // + counter + Back / Get on the guestlist visibility.
    if (typeof IntersectionObserver === 'undefined') return;

    let mostVisible: { idx: number; ratio: number } = { idx: 0, ratio: 0 };
    this.slideObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset['slide'] || '0');
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('in-view');
        }
        if (e.intersectionRatio > mostVisible.ratio) {
          mostVisible = { idx, ratio: e.intersectionRatio };
        }
      }
      // Snapshot the current best across this callback batch.
      const best = entries
        .filter(en => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (best) {
        const idx = Number((best.target as HTMLElement).dataset['slide'] || '0');
        if (idx !== this.step) {
          this.step = idx;
          this.cdr.markForCheck();
        }
      }
    }, {
      // Fire at multiple thresholds so the active-slide handoff is
      // responsive (don't wait for 50% before switching the dot
      // train; update as the next slide takes over).
      threshold: [0.25, 0.5, 0.75]
    });

    this.slideRefs.forEach(ref => this.slideObserver!.observe(ref.nativeElement));

    // Slide 1 is in view on first paint — observer fires for it
    // immediately, so animations there get .in-view straight away.
  }

  ngOnDestroy() {
    this.slideObserver?.disconnect();
  }

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
  // v1.65gL — buttons + keyboard arrows now scroll the target slide
  // into view; the IntersectionObserver picks it up and updates step
  // + adds .in-view (which triggers the per-slide animations).
  next()       { this.scrollToSlide(Math.min(this.step + 1, TOTAL_STEPS - 1)); }
  prev()       { this.scrollToSlide(Math.max(this.step - 1, 0));               }
  goTo(i: number) { this.scrollToSlide(i); }

  private scrollToSlide(i: number) {
    const el = this.slideRefs?.toArray()[i]?.nativeElement;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
