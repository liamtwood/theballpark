import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, OnInit, OnDestroy, AfterViewInit,
  ViewChildren, QueryList, ElementRef, ViewChild
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
  // v1.65gY — client design review pass:
  //   · slide 1 headline: drop the comma + trailing period
  //   · slide 2 headline: prepend "AI " and add a subtitle line
  //   · slide 3 tagline: drop the comma, drop the "s" off producers
  //   · slide 4 headline: store as UPPERCASE (CSS uses sans-serif),
  //     drop eyebrow + subtitle in favour of a footer text line below
  //     the form
  'hero.eyebrow':           'Coming soon · Event production reimagined',
  'hero.headline':          'REAL COSTS\nREAL FAST',
  'hero.subtitle':          'Turn your event into an accurate estimate in moments.',
  'hero.cta':               'Get on the guestlist',
  'suppliers.eyebrow':      'The network',
  'suppliers.headline':     'AI Powered by real costs from our network of incredible suppliers.',
  'suppliers.subtitle':     'The best suppliers in the UK with quotes in minutes.',
  'suppliers.categories':   ['DESIGN', 'BUILD', 'VENUES', 'FURNITURE', 'AV', 'GRAPHICS', 'CATERING'],
  'producers.headline':     "A PRODUCERS BEST FRIEND.",
  'producers.tagline':      'By producers for creators',
  'producers.body_1':       'Costing events can be a grind. Endless quotes, supplier chasing, tight turnarounds.',
  'producers.body_2':       'Ballpark makes it easy. Instant, accurate costs. Incredible suppliers. Everything in one place.',
  'guestlist.eyebrow':         'You made it',
  'guestlist.headline':        'THOSE WHO GET IN EARLY,\nGET AHEAD',
  'guestlist.subtitle':        "Get on the guestlist",
  'guestlist.cta_label':       'APPLY',
  'guestlist.footer_text':     "Get on the guestlist and the moment we're live you'll be the first to know.",
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
           first paint never blocks on the network.
           v1.65gY — counter dropped per client review; top-right CTA
           pill appears on slides 2 & 3, jumps the user to slide 4. -->
      <header class="bp-welcome-header">
        <button class="bp-welcome-logo" (click)="goTo(0)" [class.bp-welcome-logo--img]="logoUrl">
          <img *ngIf="logoUrl" [src]="logoUrl" alt="Ballpark" class="bp-welcome-logo-img"/>
          <span *ngIf="!logoUrl">BALLPARK</span>
        </button>
        <!-- v1.65gZ20 — header CTA now advances by one slide (next())
             rather than jumping straight to slide 4, per client
             review. Label keeps reading "Get on the guestlist" since
             that's still the eventual destination. -->
        <button
          *ngIf="step > 0 && step < TOTAL_STEPS - 1"
          class="bp-welcome-header-cta"
          (click)="next()">
          Get on the guestlist
        </button>
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
        <!-- v1.65gZ — orbs reverted to r=280 (the v1.65gY zoom was
             undone per the next-day review: "the orbs should not
             have been changed, only the text styling"). Centred CTA
             pill below the subtitle stays. -->
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
            <!-- v1.65gZ22 — slide-1 centred CTA acts as a "next"
                 button (advances one slide) for consistency with the
                 top-right header CTA. Same label, same behaviour. -->
            <button class="bp-hero-cta" (click)="next()">
              {{ text('hero.cta') }}
            </button>
          </div>
        </section>

        <!-- ── Slide 2: Suppliers ───────────────────────── -->
        <!-- v1.65gY — eyebrow dropped, subtitle line added below the
             headline ("The best suppliers in the UK with quotes in
             minutes.").
             v1.65gZ — orbs reverted to r=280 (no zoom). -->
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
            <h2 class="bp-suppliers-headline">{{ text('suppliers.headline') }}</h2>
            <p class="bp-suppliers-subtitle">{{ text('suppliers.subtitle') }}</p>
          </div>
          <!-- v1.65gZ8 — ✦ separator between items removed and the
               top/bottom border rules on .bp-marquee-wrap dropped
               per client review (let the marquee run freely without
               visual frames around it). -->
          <div class="bp-marquee-wrap">
            <div class="bp-marquee-track">
              <div *ngFor="let cat of marqueeCategories" class="bp-marquee-item">{{ cat }}</div>
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
            <!-- v1.65gZ17 — r=280 had the top + bottom orbs
                 overlapping in the middle band (combined diameter 560
                 > viewBox height 500). Dropped to r=240 so they leave
                 a 20-unit gap and the two colours read as separate
                 blobs. -->
            <g filter="url(#s3-blur)">
              <circle cx="400" cy="0"   r="240" fill="url(#s3-dark)"/>
              <circle cx="400" cy="500" r="240" fill="url(#s3-light)"/>
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
                <!-- v1.65gZ6 — body_1 + body_2 collapsed into a single
                     paragraph so the copy flows as one block with no
                     paragraph return between them. -->
                <p class="bp-producers-body">{{ text('producers.body_1') }} {{ text('producers.body_2') }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Slide 4: Guestlist ───────────────────────── -->
        <!-- v1.65gY — content redesigned per client review:
              · eyebrow + subtitle dropped
              · headline rendered uppercase + sans-serif (Inter 900)
              · narrow vertical card replaced by a wide glassmorphism
                panel filling most of the viewport width
              · form collapsed to one horizontal row:
                First Name | Surname | Email | APPLY (role + company
                removed; backend still receives a single "name" field
                composed from First + Surname)
              · footer line below the form + Contact/Instagram/TikTok/
                Legal/copyright row pinned to the bottom of the slide
             v1.65gZ — orb position + gradient reverted to the
             pre-v1.65gY values (cx=100/700 cy=250, diagonal gradient)
             per "the orbs should not have been changed". -->
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
            <!-- v1.65gZ3 — innerHTML + multiline() so the headline
                 splits explicitly after the comma ("THOSE WHO GET IN
                 EARLY,\nGET AHEAD"), no longer relying on natural
                 word-wrap which broke at viewport-width changes. -->
            <h2 class="bp-guestlist-headline" [innerHTML]="multiline(text('guestlist.headline'))"></h2>

            <div *ngIf="!submitted" class="bp-guestlist-form">
              <input class="bp-form-input" type="text"  [(ngModel)]="form.firstName" placeholder="First Name" />
              <input class="bp-form-input" type="text"  [(ngModel)]="form.surname"   placeholder="Surname" />
              <input class="bp-form-input" type="email" [(ngModel)]="form.email"     placeholder="Email Address" />
              <button
                class="bp-guestlist-submit"
                [disabled]="!canSubmit() || submitting"
                (click)="submit()">
                {{ submitting ? '…' : text('guestlist.cta_label') }}
              </button>
            </div>
            <p *ngIf="!submitted && errorMessage" class="bp-form-error">{{ errorMessage }}</p>
            <p *ngIf="!submitted" class="bp-guestlist-footer-text">
              {{ text('guestlist.footer_text') }}
            </p>

            <div *ngIf="submitted" class="bp-guestlist-success">
              <div class="bp-success-tick">✓</div>
              <h3 class="bp-success-headline">{{ text('guestlist.success_headline') }}</h3>
              <p class="bp-success-body">{{ successBody }}</p>
            </div>

            <!-- v1.65gZ5 — footer (Contact / Instagram / TikTok / (c)
                 / Legal) moved INSIDE the glass panel per client
                 review. It absolute-positions to the bottom of the
                 panel rather than to the viewport. -->
            <div class="bp-welcome-footer">
              <div class="bp-footer-links">
                <a href="mailto:hello@theballpark.ai" class="bp-footer-link">Contact</a>
                <a href="https://instagram.com" target="_blank" rel="noopener" class="bp-footer-link">Instagram</a>
                <a href="https://tiktok.com" target="_blank" rel="noopener" class="bp-footer-link">TikTok</a>
              </div>
              <div class="bp-footer-copy">© 2026. All Rights Reserved.</div>
              <button type="button" class="bp-footer-link bp-footer-link--right bp-footer-link--button" (click)="openLegal($event)">Legal</button>
            </div>
          </div>
        </section>

      </div>

      <!-- v1.65gY — pagination train + bottom nav (Back / Next pills)
           removed per client review. Navigation is now exclusively
           scroll-driven (wheel, trackpad, swipe, arrow keys) with the
           header CTA jumping straight to the form on slides 2 & 3. -->

      <!-- v1.65gZ20 — Legal modal. Triggered by the Legal link in the
           slide-4 footer. Backdrop click + close button + ESC all
           dismiss. -->
      <!-- v1.65gZ21 — replaced the generic 6-bullet placeholder with
           the actual Ballpark welcome-page privacy + cookie statement
           drafted from the client's notes. -->
      <div *ngIf="legalOpen" class="bp-legal-overlay" (click)="closeLegal()">
        <div class="bp-legal-modal" (click)="$event.stopPropagation()">
          <button type="button" class="bp-legal-close" (click)="closeLegal()" aria-label="Close">×</button>
          <h2 class="bp-legal-title">Legal</h2>

          <h3 class="bp-legal-section">Your privacy</h3>
          <p class="bp-legal-body">
            Information about our customers is an important part of our business, and we are not in the business of selling our customers' personal information to others.
          </p>

          <h3 class="bp-legal-section">What we collect, and why</h3>
          <p class="bp-legal-body">
            We collect your contact information on this site for one reason only: so we can invite you to Ballpark when it becomes available. Your name and email address are stored securely and never shared with third parties.
          </p>

          <h3 class="bp-legal-section">Cookies</h3>
          <p class="bp-legal-body">
            There are no cookies in use on the Ballpark welcome page. None are currently set. If tracking technologies are introduced in the future, a full Cookie Policy will be added here and a banner will appear before any cookies are set.
          </p>

          <h3 class="bp-legal-section">Changes</h3>
          <p class="bp-legal-body">
            This statement may be updated as Ballpark evolves. Material changes will be communicated to anyone on the guestlist before they take effect.
          </p>

          <button type="button" class="bp-legal-dismiss" (click)="closeLegal()">Close</button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* v1.65g8 — Fraunces (OFL, free for commercial) stands in for
       the personal-use-only Sharpe trial until the licensed Sharpe
       pack is bought and dropped in. Closest free-for-commercial
       match: variable serif, high contrast, full weight range,
       italics. Swap back to Sharpe by replacing this @import and
       changing 'Fraunces' → 'Sharpe' across the rules below.
       v1.65gY — Inter (OFL) added for the slide-4 headline, per
       client review ("bold uppercase sans-serif"). */
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@400;500;600;700;900&display=swap');

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
    /* v1.65gY — top-right header CTA. Shown on slides 2 + 3 only
       (slide 1 has its own centred CTA, slide 4 IS the form).
       Subtle glass pill matching the slide-1 hero CTA so the
       branding stays consistent as you scroll. */
    .bp-welcome-header-cta {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: #DCF0EB;
      background: rgba(220, 240, 235, 0.14);
      border: 1px solid rgba(220, 240, 235, 0.32);
      border-radius: 999px;
      padding: 9px 20px;
      cursor: pointer;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: background 0.2s, transform 0.2s;
    }
    .bp-welcome-header-cta:hover {
      background: rgba(220, 240, 235, 0.22);
      transform: translateY(-1px);
    }

    /* ── Slide stage ──────────────────────────── */
    /* v1.65gL — scroll-snap container. All four slides stack
       vertically at 100vh each; the browser handles wheel/trackpad
       /touch/keyboard scroll natively. IntersectionObserver in TS
       adds .in-view to the current slide (one-shot) which fires the
       per-slide entry animations. */
    /* v1.65gZ23 — scrollbar re-enabled per client mockup (their
       reference shows a slim right-edge scrollbar). Replaces the
       v1.65gL hide rules. Custom-styled as a glass pill so it
       reads as part of the welcome aesthetic rather than the OS
       default chrome. */
    .bp-welcome-stage {
      position: absolute; inset: 0;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
      scrollbar-width: thin;                                     /* Firefox */
      scrollbar-color: rgba(220, 240, 235, 0.45) transparent;    /* Firefox */
      overscroll-behavior: contain;                              /* iOS rubber-band suppression */
    }
    .bp-welcome-stage::-webkit-scrollbar {
      width: 6px;
      height: 6px;
      background: transparent;
    }
    .bp-welcome-stage::-webkit-scrollbar-track {
      background: transparent;
    }
    .bp-welcome-stage::-webkit-scrollbar-thumb {
      background: rgba(220, 240, 235, 0.45);
      border-radius: 999px;
    }
    .bp-welcome-stage::-webkit-scrollbar-thumb:hover {
      background: rgba(220, 240, 235, 0.65);
    }
    .bp-welcome-stage::-webkit-scrollbar-corner {
      background: transparent;
    }

    /* v1.65gL — bg layer wrapper. With scroll-snap the user is
       already scrolling, so the orbs "scroll in" naturally as the
       slide enters the viewport. The wrapper exists for layering
       only; we do NOT transform it (transforming the SVG or any
       ancestor breaks the Gaussian blur). */
    .bp-bg-layer {
      position: absolute; inset: 0;
      z-index: 1;
      pointer-events: none;
    }

    /* v1.65gW — orb wipe-in restored by animating the individual
       <circle> elements INSIDE the filtered group instead of the
       SVG / group / wrapper. CSS transforms on SVG children render
       inside the SVG's own coordinate space — the filter recomputes
       over the moved circles natively, no HTML compositing layer is
       created, and the Gaussian blur survives. */
    .bp-svg-bg circle {
      transform-box: view-box;
      transform-origin: center;
      transform: translateX(-100%);
    }
    .bp-slide.in-view .bp-svg-bg circle {
      animation: bp-orb-wipe-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes bp-orb-wipe-in {
      from { transform: translateX(-100%); }
      to   { transform: translateX(0); }
    }

    /* v1.65gX  — slide 3's two orbs both sit at cx=400 (vertically
       stacked, not side-by-side), so a horizontal wipe leaves the
       right half of the viewport showing the bare blue background
       during the transition. Override to a scale-bloom from the
       viewport centre instead — the orbs expand outward into their
       final positions, no exposed corner.
       v1.65gZ18 — scale-bloom produced a rectangular filter-region
       artifact mid-transition (when scale 0 collapses the <g>'s
       bbox to a point, the blur filter's relative region
       degenerates and Chrome briefly paints a rectangle in that
       area). Swapped to a pure opacity fade: orbs stay at their
       final geometric position the whole time, only their alpha
       animates 0 -> 1, so the bbox never collapses and the filter
       region stays stable. The translateX(-100%) base rule for
       circles is OVERRIDDEN to transform:none here so the global
       wipe doesn't also fire on slide 3. */
    .bp-slide-3 .bp-svg-bg circle {
      transform: none;
      opacity: 0;
    }
    .bp-slide-3.in-view .bp-svg-bg circle {
      animation: bp-orb-fade-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes bp-orb-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* v1.65gT — animation declared ONLY under .in-view, with the
       "from" pose as the element's direct (no-class) state. When
       the scroll handler removes .in-view (user navigates away)
       the element snaps back to the from-pose; when .in-view is
       added again on return, the animation declaration is freshly
       applied and the reveal replays from scratch. Adding/removing
       a class that ALSO toggles animation-play-state was no good —
       paused→running on a completed animation holds the end frame
       and never replays. */

    /* ── Slide 2 from-pose + reveal ── */
    .bp-slide-2 .bp-slide-2-inner,
    .bp-slide-2 .bp-marquee-wrap {
      transform: translateY(80px); opacity: 0;
    }
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

    /* ── Slide 3 from-pose + reveal (right column delayed 1.1s) ── */
    .bp-slide-3 .bp-producers-grid > div:first-child {
      transform: translateX(-120px); opacity: 0;
    }
    .bp-slide-3 .bp-producers-grid > div:last-child {
      transform: translateX(120px); opacity: 0;
    }
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

    /* ── Slide 4 from-pose + reveal ── */
    .bp-slide-4 .bp-slide-4-inner .bp-eyebrow {
      transform: scale(0) rotate(-12deg); opacity: 0;
    }
    .bp-slide-4 .bp-guestlist-headline {
      transform: scale(0.7) translateY(30px); opacity: 0;
    }
    .bp-slide-4 .bp-guestlist-form {
      transform: translateY(28px) scale(0.96); opacity: 0;
    }
    .bp-slide-4.in-view .bp-slide-4-inner .bp-eyebrow {
      animation: bp-stamp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
    }
    .bp-slide-4.in-view .bp-guestlist-headline {
      animation: bp-bounce-in 1.05s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both;
    }
    .bp-slide-4.in-view .bp-guestlist-form {
      animation: bp-form-rise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.9s both;
    }
    @keyframes bp-stamp {
      0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
      70%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); opacity: 1; }
    }
    @keyframes bp-bounce-in {
      0%   { transform: scale(0.7) translateY(30px); opacity: 0; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes bp-form-rise {
      from { transform: translateY(28px) scale(0.96); opacity: 0; }
      to   { transform: translateY(0)    scale(1);    opacity: 1; }
    }

    .bp-slide {
      position: relative;
      height: 100vh;
      width: 100%;
      scroll-snap-align: start;
      /* v1.65gV — scroll-snap-stop: always reinstated. Without it,
         natural wheel + swipe scrolls could end between two snap
         points (user-reported screenshot showed slide 1 + slide 2
         half-visible). The original concern was that always broke
         programmatic Next/Back scrollIntoView, but the wheel/swipe
         UX is the priority — one swipe = one slide. */
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
    /* v1.65gZ10 — gap between headline/subtitle block and the marquee
       trimmed 56 -> 16 so the scrolling row sits closer to the copy. */
    .bp-slide-2-inner { margin-bottom: 16px; }
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
    /* v1.65gY — headline shrunk + comma/period dropped (REAL COSTS /
       REAL FAST as two clean lines), more breathing room before the
       subtitle, centred CTA pill below. Per client review. */
    .bp-hero-headline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(48px, 8.5vw, 116px);
      font-weight: 900;
      line-height: 1.0;
      letter-spacing: -0.04em;
      margin: 0 0 48px 0;
    }
    /* v1.65gZ11  — subtitle font bumped + max-width tightened so the
       copy wraps to multiple lines per client review.
       v1.65gZ12 — max-width widened 380 -> 560 so the copy wraps
       once (two lines), not multiple times. */
    .bp-hero-subtitle {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(22px, 2.6vw, 30px);
      font-weight: 500; line-height: 1.4;
      max-width: 560px; margin: 0 auto 40px;
      opacity: 0.95;
    }
    .bp-hero-cta {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: #DCF0EB;
      background: rgba(220, 240, 235, 0.14);
      border: 1px solid rgba(220, 240, 235, 0.32);
      border-radius: 999px;
      padding: 11px 26px;
      cursor: pointer;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: background 0.2s, transform 0.2s;
    }
    .bp-hero-cta:hover {
      background: rgba(220, 240, 235, 0.24);
      transform: translateY(-1px);
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
      /* v1.65gY — headline trimmed (was clamp 40-88) so the AI
         prefix fits on the same compact 3-line block.
         v1.65gZ9 — weight dropped 900 -> 500 (regular Fraunces) +
         max-width 900 -> 700 per client review. Subtitle below
         tracks the same width so its side-lines still extend just
         beyond the headline. */
      font-size: clamp(32px, 4.8vw, 60px);
      font-weight: 500; line-height: 1.1; letter-spacing: -0.02em;
      /* v1.65gQ — centre the headline block. text-align: center is
         inherited from .bp-slide-inner, but the block itself was
         left-aligned because of max-width: 1000px without auto
         margins. */
      margin: 0 auto 28px;
      max-width: 700px;
    }
    /* v1.65gY — subtitle below the suppliers headline.
       v1.65gZ8 — flex layout + ::before/::after rules paint a 1px
       line either side of the text, sized to match the headline
       max-width (900px) so the lines extend just beyond the text
       and span roughly the headline's footprint. */
    .bp-suppliers-subtitle {
      /* v1.65gZ13 — switched Fraunces -> Inter per client review
         (same family as the slide-4 headline). */
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: clamp(15px, 1.5vw, 18px);
      font-weight: 500;
      line-height: 1.55;
      opacity: 0.9;
      max-width: 700px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
    }
    .bp-suppliers-subtitle::before,
    .bp-suppliers-subtitle::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(220, 240, 235, 0.4);
    }
    /* v1.65gZ8  — top + bottom 1px separators dropped.
       v1.65gZ10 — wrap padding trimmed 24 -> 8 so the marquee
       sits closer to the subtitle; item font shrunk
       clamp(36-64) -> clamp(22-40) per client review. */
    .bp-marquee-wrap {
      width: 100%; overflow: hidden;
      padding: 8px 0;
      position: relative; z-index: 5;
    }
    .bp-marquee-track {
      display: flex; white-space: nowrap; width: max-content;
      animation: bp-scroll-x 28s linear infinite;
    }
    .bp-marquee-item {
      display: flex; align-items: center;
      /* v1.65gZ13 — switched Fraunces -> Inter per client review. */
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: clamp(22px, 3vw, 40px);
      font-weight: 900; letter-spacing: 0.02em;
      padding: 0 36px;
      flex-shrink: 0;
    }
    /* v1.65gZ8 — .bp-marquee-sep rule kept for safety in case any
       admin-injected content still contains the glyph; the template
       no longer emits one. */
    .bp-marquee-sep { display: none; }
    @keyframes bp-scroll-x {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* v1.65gD — vertical marquee variant. Two-column layout: copy
       on the left, scrolling category column on the right. The
       track scrolls upward; the ✦ separator sits centred BELOW
       each label, not to its right. Categories are repeated 3×
       in marqueeCategories so the loop is seamless. */
    /* v1.65gR — vertical-marquee experiment styles removed.
       The block here previously left the .bp-slide-2-inner with
       text-align: left + align-items: flex-start (intended for the
       abandoned 2-column vertical-train layout), which was
       overriding the default .bp-slide-inner text-align: center
       and breaking the headline centring on phone. */

    /* ── Slide 3 ──────────────────────────────── */
    /* v1.65gY — headline shrunk + pulled centre-left, body tightened.
       Per client review the headline shouldn't span the full left
       column at maximum size; the new clamp keeps it compact and the
       grid columns are more balanced. */
    .bp-slide-3-inner { max-width: 1100px; }
    /* v1.65gZ14 — horizontal gap widened 64 -> 140 per client review. */
    .bp-producers-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 140px; align-items: center; text-align: left;
    }
    /* v1.65gZ15 — headline knocked down ~ half a step per client
       review ("reduce size by 1/2 a size if you can"). */
    .bp-producers-headline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(32px, 4.8vw, 56px);
      font-weight: 900; line-height: 1.0;
      letter-spacing: -0.02em;
      margin: 0 0 14px 0;
    }
    /* v1.65gZ7 — tagline + body sizes bumped + body width capped per
       client review ("increase the font size of By producers… and
       Costing events…; decrease the width of the container"). */
    .bp-producers-tagline {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 500;
      opacity: 0.85; margin: 0;
    }
    .bp-producers-body {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(18px, 1.6vw, 22px);
      font-weight: 700;
      line-height: 1.5;
      opacity: 0.95;
      margin: 0;
      max-width: 380px;
    }

    @media (max-width: 768px) {
      .bp-producers-grid { grid-template-columns: 1fr; gap: 32px; text-align: center; }
    }

    /* ── Slide 4 ──────────────────────────────── */
    /* v1.65gY — full redesign per client review:
        · wide centred glass panel (was a narrow 560px card)
        · uppercase sans-serif headline (was serif title-case)
        · single horizontal row of inputs + APPLY button
        · explanatory footer text below the form
        · contact/instagram/tiktok/copyright/legal pinned to slide
          bottom */
    /* v1.65gZ3 — slide-4 inner is now a glass panel that fills the
       viewport below the header with rounded top corners. We absolute
       -position it so the section's flex centering doesn't constrain
       its width to the shared .bp-slide-inner max-width: 1100px. The
       footer (links + (c) + Legal) overlays the panel's bottom via a
       higher z-index — that's why border-bottom is none, the panel
       slides off the bottom edge of the viewport. */
    /* v1.65gZ4 — narrower + more rounded per client review. Anchored
       via left:50% + translateX(-50%) so the max-width 960px caps the
       panel and it stays centred regardless of viewport. Radius
       bumped to 56px so the top corners read as a clear curve. */
    .bp-slide-4-inner {
      position: absolute;
      top: 56px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 80px);
      max-width: 960px;
      bottom: 0;
      max-height: none;
      box-sizing: border-box;
      /* v1.65gZ16 — content anchored toward the top of the panel
         (justify-content flex-start) so the headline / form / footer
         text sit higher; padding-top widened to give the headline
         room to breathe below the panel's rounded edge. */
      padding: 96px 60px 96px;

      background: rgba(220, 240, 235, 0.08);
      border: 1px solid rgba(220, 240, 235, 0.20);
      border-bottom: none;
      border-radius: 56px 56px 0 0;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);

      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      gap: 32px;
    }
    /* The gap collapses to flex-item margins; clear the headline's
       own bottom margin so the gap is the single source of truth. */
    .bp-slide-4-inner .bp-guestlist-headline { margin-bottom: 0; }
    .bp-slide-4-inner .bp-guestlist-footer-text { margin-top: 0; }
    @media (max-width: 720px) {
      .bp-slide-4-inner {
        width: calc(100% - 24px);
        padding: 48px 24px 80px;
        border-radius: 36px 36px 0 0;
      }
    }
    .bp-guestlist-headline {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: clamp(28px, 4.2vw, 52px);
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      margin: 0 0 32px 0;
    }
    .bp-guestlist-form {
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr auto;
      gap: 12px;
      align-items: stretch;
      background: rgba(220,240,235,0.06);
      border: 1px solid rgba(220,240,235,0.18);
      border-radius: 999px;
      padding: 10px;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      max-width: 880px;
      margin: 0 auto;
    }
    /* v1.65gZ2 — name/email inputs render on a solid white pill,
       with dark-green text. APPLY button stays glass so the action
       reads as the accent. */
    .bp-form-input {
      box-sizing: border-box;
      padding: 11px 18px;
      background: #FFFFFF;
      border: 1px solid #FFFFFF;
      border-radius: 999px;
      color: #133C23;
      font-size: 14px;
      font-family: 'Fraunces', Georgia, serif; font-weight: 500;
      outline: none;
      text-align: center;
    }
    .bp-form-input::placeholder { color: rgba(19,60,35,0.45); }
    .bp-form-input:focus { border-color: rgba(19,60,35,0.25); }
    .bp-form-error {
      margin: 14px 0 0;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 13px; font-weight: 500;
      color: #FFD3DD;
    }
    .bp-guestlist-submit {
      padding: 11px 28px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px; font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(220,240,235,0.18);
      color: #DCF0EB;
      border: 1px solid rgba(220,240,235,0.25);
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .bp-guestlist-submit:hover:not(:disabled) {
      background: rgba(220,240,235,0.30);
    }
    .bp-guestlist-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bp-guestlist-footer-text {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(14px, 1.4vw, 17px);
      font-weight: 500;
      line-height: 1.5;
      opacity: 0.85;
      max-width: 720px;
      margin: 36px auto 0;
    }

    /* Slide 4 form responsive collapse — on narrow viewports the
       horizontal row would otherwise crush the inputs unreadably
       small. Stack them at <720px. */
    @media (max-width: 720px) {
      .bp-guestlist-form {
        grid-template-columns: 1fr;
        border-radius: 24px;
        padding: 16px;
      }
    }

    .bp-guestlist-success {
      background: rgba(220,240,235,0.1);
      border: 1px solid rgba(220,240,235,0.3);
      border-radius: 16px;
      padding: 40px;
      backdrop-filter: blur(12px);
      max-width: 560px;
      margin: 0 auto;
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

    /* ── Slide 4 footer (Contact / Instagram / TikTok / © / Legal) ─
       v1.65gZ2 — switched from flex space-between to a 3-column grid
       so the © line sits in the centre of the PAGE (the middle 1fr
       column), not just between the left/right blocks. Left & right
       blocks justify-self to keep their edges aligned. */
    .bp-welcome-footer {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      z-index: 6;
      padding: 18px 32px 22px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 24px;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 12px;
      opacity: 0.85;
    }
    .bp-footer-links {
      display: flex; gap: 24px; align-items: center;
      justify-self: start;
    }
    .bp-footer-link {
      color: #DCF0EB;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .bp-footer-link:hover { opacity: 0.7; }
    .bp-footer-link--right {
      justify-self: end;
    }
    .bp-footer-copy {
      text-align: center;
      opacity: 0.6;
      letter-spacing: 0.02em;
    }
    @media (max-width: 720px) {
      .bp-welcome-footer {
        grid-template-columns: 1fr;
        justify-items: center;
        gap: 8px;
        font-size: 11px;
        padding-bottom: 16px;
      }
      .bp-footer-links { justify-self: center; }
      .bp-footer-link--right { display: none; }
    }

    /* v1.65gY — Bottom-nav (Back / Next pills) + vertical pagination
       train styles removed alongside their template markup. Scroll-
       snap + header CTA + slide-1 centred CTA cover every nav need;
       any leftover .bp-welcome-bottom / .bp-welcome-dot rules would
       be unreferenced dead code. */

    /* ── Legal modal ─────────────────────────────────────────────────
       v1.65gZ20 — opened by the Legal link in the slide-4 footer.
       Backdrop overlay sits above every slide (z 100); the modal
       card centres on screen with a glass treatment that matches
       the rest of the welcome aesthetic. */
    .bp-legal-overlay {
      position: fixed; inset: 0;
      z-index: 100;
      background: rgba(15, 30, 24, 0.55);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .bp-legal-modal {
      position: relative;
      max-width: 560px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 40px 40px 32px;
      background: rgba(220, 240, 235, 0.14);
      border: 1px solid rgba(220, 240, 235, 0.28);
      border-radius: 24px;
      color: #DCF0EB;
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }
    .bp-legal-close {
      position: absolute;
      top: 12px; right: 16px;
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      border: none;
      color: #DCF0EB;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .bp-legal-close:hover { opacity: 1; }
    .bp-legal-title {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin: 0 0 18px 0;
    }
    .bp-legal-list {
      list-style: disc;
      padding-left: 22px;
      margin: 0 0 28px 0;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 15px;
      line-height: 1.55;
    }
    .bp-legal-list li {
      margin-bottom: 10px;
      opacity: 0.92;
    }
    .bp-legal-list li:last-child { margin-bottom: 0; }

    /* v1.65gZ21 — section headings + body paragraphs for the new
       privacy / cookies / changes content. */
    .bp-legal-section {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      opacity: 0.75;
      margin: 22px 0 8px 0;
    }
    .bp-legal-section:first-of-type { margin-top: 4px; }
    .bp-legal-body {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 15px;
      line-height: 1.55;
      margin: 0 0 6px 0;
      opacity: 0.92;
    }
    .bp-legal-dismiss {
      margin-top: 24px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #DCF0EB;
      background: rgba(220, 240, 235, 0.18);
      border: 1px solid rgba(220, 240, 235, 0.28);
      border-radius: 999px;
      padding: 10px 24px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .bp-legal-dismiss:hover { background: rgba(220, 240, 235, 0.30); }

    /* Footer "Legal" link now renders as a button (so we can wire a
       click handler without a phantom navigation). Strip the default
       button chrome so it still reads as a footer link. */
    .bp-footer-link--button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font: inherit;
      letter-spacing: inherit;
    }
  `]
})
export class WelcomeComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly TOTAL_STEPS = TOTAL_STEPS;
  readonly roleOptions = ROLE_OPTIONS;
  readonly dots = Array.from({ length: TOTAL_STEPS });

  /** v1.65gL — references to the four <section #slideRef> elements
      so we can scroll a target slide into view + add .in-view based
      on scroll position. */
  @ViewChildren('slideRef') slideRefs!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('stage') stageRef!: ElementRef<HTMLElement>;

  step = 0;
  /** Kept for legacy bindings (template still references it). Now
      always 'forward' since per-slide animations are one-shot. */
  direction: 'forward' | 'backward' = 'forward';
  /** v1.65gN — scroll listener cleanup. */
  private scrollListener?: () => void;
  /** v1.65gT — last settled slide index. Used to gate the class
      toggle so animations only replay when the user actually
      changes slide (not on every scroll event). */
  private lastSettledIdx = -1;
  content: Content = { ...DEFAULT_CONTENT };
  /** v1.65g9 — marketplace logo URL, hydrated from /api/org on init.
      Empty string until the fetch lands; the template falls back to
      the "BALLPARK" text wordmark in that window so first paint
      never feels broken. */
  logoUrl = '';

  // v1.65gY — form simplified to First Name / Surname / Email per
  // the client review. The submit() call still posts a single "name"
  // field (firstName + " " + surname) so the existing backend route
  // stays unchanged; role + company are sent as null.
  form = {
    firstName: '',
    surname:   '',
    email:     ''
  };
  submitting = false;
  submitted  = false;
  errorMessage: string | null = null;

  /** v1.65gZ20 — Legal modal open state. Backdrop click + Close
      button + ESC keydown all flip this back to false. */
  legalOpen = false;

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
    // v1.65gT — scroll-position handler.
    // Two responsibilities, decoupled:
    //   1. step state — updated on EVERY scroll frame so the
    //      pagination train + counter respond in real time as the
    //      user scrolls.
    //   2. .in-view class — moved to the settled slide ONLY after
    //      150ms of scroll silence (so the animation runs once
    //      the snap has landed and the user is looking at the
    //      slide). Class is REMOVED from non-current slides so
    //      backwards-scrolling re-triggers the animation: each
    //      time you arrive at a slide, the reveal plays again.
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;

    let settleTimer: any = null;
    const setCurrentInView = (idx: number) => {
      if (idx === this.lastSettledIdx) return;
      this.lastSettledIdx = idx;
      const refs = this.slideRefs?.toArray() || [];
      refs.forEach((ref, i) => {
        const el = ref.nativeElement;
        if (i === idx) {
          // v1.65gU — force-restart the CSS animation. classList.add
          // on an element that ALREADY has the class is a no-op and
          // doesn't replay the animation, so backward-nav to a slide
          // we previously visited wouldn't trigger its entry reveal.
          // The remove + reflow + add cycle makes the browser treat
          // the animation declaration as a fresh application.
          el.classList.remove('in-view');
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          el.offsetWidth;  // force reflow
          el.classList.add('in-view');
        } else {
          el.classList.remove('in-view');
        }
      });
    };

    const onScroll = () => {
      const vh = stage.clientHeight || window.innerHeight;
      const idx = Math.max(0, Math.min(TOTAL_STEPS - 1,
        Math.round(stage.scrollTop / vh)));

      if (idx !== this.step) {
        this.step = idx;
        this.cdr.markForCheck();
      }

      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const settledIdx = Math.max(0, Math.min(TOTAL_STEPS - 1,
          Math.round(stage.scrollTop / vh)));
        setCurrentInView(settledIdx);
      }, 150);
    };

    stage.addEventListener('scroll', onScroll, { passive: true });
    this.scrollListener = () => {
      clearTimeout(settleTimer);
      stage.removeEventListener('scroll', onScroll);
    };

    // Slide 0 is in view on load — mark immediately so first paint
    // doesn't sit in the from-pose for 150ms.
    setCurrentInView(0);
  }

  ngOnDestroy() {
    this.scrollListener?.();
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
    // v1.65gZ20 — ESC closes the Legal modal first if open; nothing
    // else binds to ESC, so it's an additive handler.
    if (e.key === 'Escape' && this.legalOpen) {
      this.closeLegal();
      return;
    }
    // While the modal is up, swallow arrow / Enter nav so scrolling
    // doesn't fire underneath the dialog.
    if (this.legalOpen) return;

    if (this.submitted) return;
    const tag = (e.target as HTMLElement)?.tagName;
    const isFormField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft' && !isFormField) this.prev();
    if (e.key === 'Enter' && this.step < TOTAL_STEPS - 1 && !isFormField) this.next();
  }

  // ── Legal modal ───────────────────────────────────────────────
  openLegal(e?: Event) {
    if (e) e.preventDefault();
    this.legalOpen = true;
    this.cdr.markForCheck();
  }
  closeLegal() {
    this.legalOpen = false;
    this.cdr.markForCheck();
  }

  // ── Submit ────────────────────────────────────────────────────
  canSubmit(): boolean {
    return this.form.firstName.trim().length > 0
        && this.form.surname.trim().length > 0
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  submit() {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const fullName = `${this.form.firstName.trim()} ${this.form.surname.trim()}`.trim();
    const body = {
      name:    fullName,
      email:   this.form.email.trim(),
      company: null,
      role:    null
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
    const firstName = this.form.firstName.trim() || 'friend';
    return tpl.replace(/\{\{firstName\}\}/g, firstName);
  }
}
