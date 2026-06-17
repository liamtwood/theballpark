import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, OnInit, OnDestroy, AfterViewInit,
  ViewChildren, QueryList, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RuntimeConfigService } from '../../core/runtime-config.service';

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
  'hero.subtitle':          'Turn your event into an accurate estimate in seconds.',
  'hero.cta':               'Get on the guestlist',
  'suppliers.eyebrow':      'The network',
  'suppliers.headline':     'AI Powered by real costs of our incredible suppliers.',
  'suppliers.subtitle':     'The best suppliers in the UK with quotes in minutes.',
  'suppliers.categories':   ['DESIGN', 'BUILD', 'VENUES', 'FURNITURE', 'AV', 'GRAPHICS', 'CATERING'],
  'producers.headline':     "A PRODUCERS BEST FRIEND.",
  'producers.tagline':      'By producers for creators',
  'producers.body_1':       'Costing events can be a grind. Endless quotes, supplier chasing, tight turnarounds.',
  'producers.body_2':       'Ballpark makes it easy. Instant, accurate costs. Incredible suppliers. Everything in one place.',
  'guestlist.eyebrow':         'You made it',
  'guestlist.headline':        "Get on the guestlist and the moment we're live you'll be the first to know.",
  'guestlist.subtitle':        "Get on the guestlist",
  'guestlist.cta_label':       'APPLY',
  'guestlist.footer_text':     'Those who get in early get ahead.',
  'guestlist.success_headline': "You're on the guestlist.",
  'guestlist.success_body':    "We'll be in touch the moment Ballpark goes live, {{firstName}}."
};

@Component({
  selector: 'app-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- v1.65j1 — fixed green overlay used for the BALLPARK-click
         dissolve. Sits above everything; fades in to fully cover
         the page green, the scroll jumps to slide 1 underneath,
         then it fades out revealing slide 1. -->
    <div class="bp-ballpark-fade" [class.active]="ballparkFading" aria-hidden="true"></div>
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
        <!-- v1.65gZ42 — header CTA now shows on slide 1 too. Was
             previously hidden on step 0 because slide 1 had its own
             centred CTA below the subtitle; that has been removed
             so all three "Get on the guestlist" pills live in the
             same top-right spot for consistency.
             v1.65gZ43 — fast-track: clicking the CTA now jumps
             straight to slide 4 (the form) instead of advancing one
             slide at a time. Scroll + arrow keys still do the slow
             walk; the button is the shortcut. -->
        <!-- v1.65hZ — "Get on the guestlist" CTA removed per client
             review (chevron + scroll already cover navigation to
             slide 4). Markup kept commented in case we restore.
        <button
          *ngIf="step < TOTAL_STEPS - 1"
          class="bp-welcome-header-cta"
          (click)="goTo(TOTAL_STEPS - 1)">
          Get on the guestlist
        </button>
        -->
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
        <section #slideRef data-slide="0" class="bp-slide bp-slide-1" [class.bp-slide-exiting]="exitingFromSlide === 0" [class.bp-credits-rolling]="slide1CreditsRolling" (click)="next()" style="cursor: pointer;">
          <!-- v1.65i5 — *ngIf instead of CSS hide. iOS Safari was
               caching the Gaussian-blur filter texture and momentarily
               redrawing it during the scroll-jump even when the parent
               was display:none. Removing the SVG (and grain) from the
               DOM entirely on exit forces a clean teardown — no
               compositor cache to leak. -->
          <div class="bp-bg-layer" *ngIf="exitingFromSlide !== 0"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s1-pink" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#FA91B0"/>
                <stop offset="100%" stop-color="#DF5980"/>
              </linearGradient>
              <filter id="s1-blur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g>
              <circle cx="100" cy="250" r="280" fill="url(#s1-pink)" filter="url(#s1-blur)"/>
              <circle cx="700" cy="250" r="280" fill="url(#s1-pink)" filter="url(#s1-blur)"/>
            </g>
          </svg></div>
          <div class="bp-grain" *ngIf="exitingFromSlide !== 0"></div>
          <div class="bp-slide-inner bp-slide-1-inner"
               [class.bp-credits-exit]="slide1CreditsRolling"
               *ngIf="exitingFromSlide !== 0">
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
            <!-- v1.65gZ42 — centred "Get on the guestlist" CTA removed.
                 Moved to the top-right header so it sits in the same
                 spot on every slide. .bp-hero-cta CSS rules kept
                 (unused) in case we want to restore it later. -->

          </div>
        </section>

        <!-- ── Slide 2: Suppliers ───────────────────────── -->
        <!-- v1.65gY — eyebrow dropped, subtitle line added below the
             headline ("The best suppliers in the UK with quotes in
             minutes.").
             v1.65gZ — orbs reverted to r=280 (no zoom). -->
        <section #slideRef data-slide="1" class="bp-slide bp-slide-2" [class.bp-slide-exiting]="exitingFromSlide === 1" [class.bp-credits-rolling]="slide2CreditsRolling" (click)="next()" style="cursor: pointer;">
          <div class="bp-bg-layer" *ngIf="exitingFromSlide !== 1"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s2-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#79A8BA"/>
                <stop offset="100%" stop-color="#457187"/>
              </linearGradient>
              <filter id="s2-blur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g>
              <circle cx="700" cy="0"   r="280" fill="url(#s2-blue)" filter="url(#s2-blur)"/>
              <circle cx="100" cy="500" r="280" fill="url(#s2-blue)" filter="url(#s2-blur)"/>
            </g>
          </svg></div>
          <div class="bp-grain" *ngIf="exitingFromSlide !== 1"></div>
          <div class="bp-slide-inner bp-slide-2-inner" *ngIf="exitingFromSlide !== 1">
            <h2 class="bp-suppliers-headline">{{ text('suppliers.headline') }}</h2>
            <p class="bp-suppliers-subtitle">{{ text('suppliers.subtitle') }}</p>
          </div>
          <!-- v1.65gZ8 — ✦ separator between items removed and the
               top/bottom border rules on .bp-marquee-wrap dropped
               per client review (let the marquee run freely without
               visual frames around it). -->
          <div class="bp-marquee-wrap" *ngIf="exitingFromSlide !== 1">
            <div class="bp-marquee-track">
              <div *ngFor="let cat of marqueeCategories" class="bp-marquee-item">{{ cat }}</div>
            </div>
          </div>
        </section>

        <!-- ── Slide 3: Producers ───────────────────────── -->
        <section #slideRef data-slide="2" class="bp-slide bp-slide-3" [class.bp-slide-exiting]="exitingFromSlide === 2" [class.bp-credits-rolling]="slide3CreditsRolling" (click)="next()" style="cursor: pointer;">
          <div class="bp-bg-layer" *ngIf="exitingFromSlide !== 2"><svg class="bp-svg-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="s3-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stop-color="#2D8E53"/>
                <stop offset="100%" stop-color="#133C23"/>
              </linearGradient>
              <linearGradient id="s3-light" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stop-color="#33A25F"/>
                <stop offset="100%" stop-color="#2D8E53"/>
              </linearGradient>
              <filter id="s3-blur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <!-- v1.65gZ17 — r=280 had the top + bottom orbs
                 overlapping in the middle band (combined diameter 560
                 > viewBox height 500). Dropped to r=240 so they leave
                 a 20-unit gap and the two colours read as separate
                 blobs. -->
            <g>
              <circle cx="400" cy="0"   r="240" fill="url(#s3-dark)"  filter="url(#s3-blur)"/>
              <circle cx="400" cy="500" r="240" fill="url(#s3-light)" filter="url(#s3-blur)"/>
            </g>
          </svg></div>
          <div class="bp-grain" *ngIf="exitingFromSlide !== 2"></div>
          <div class="bp-slide-inner bp-slide-3-inner" *ngIf="exitingFromSlide !== 2">
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
              <filter id="s4-blur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="20"/>
              </filter>
            </defs>
            <g>
              <circle cx="100" cy="250" r="280" fill="url(#s4-darkgreen)" filter="url(#s4-blur)"/>
              <circle cx="700" cy="250" r="280" fill="url(#s4-darkgreen)" filter="url(#s4-blur)"/>
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
            <!-- v1.65gZ29 — Cloudflare Turnstile widget. Renders via
                 explicit window.turnstile.render() after the script
                 loads (see ngAfterViewInit). Managed mode is usually
                 invisible; occasional checkbox for suspicious traffic. -->
            <div *ngIf="!submitted" #turnstileEl class="bp-turnstile-wrap"></div>
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
              <!-- v1.65iB — Legal moved INTO the links row next to
                   TikTok (was an isolated right-aligned button). Reads
                   as part of the same group and stays visible on
                   mobile where the old right column was display:none. -->
              <div class="bp-footer-links">
                <a href="mailto:hello@theballpark.ai" class="bp-footer-link">Contact</a>
                <a href="https://www.cloudflare.com/en-gb/turnstile-privacy-policy/" target="_blank" rel="noopener" class="bp-footer-link">Privacy</a>
              </div>
              <div class="bp-footer-copy">© 2026. All Rights Reserved.</div>
            </div>
          </div>
        </section>

      </div>

      <!-- v1.65gY — pagination train + bottom nav (Back / Next pills)
           removed per client review. Navigation is now exclusively
           scroll-driven (wheel, trackpad, swipe, arrow keys) with the
           header CTA jumping straight to the form on slides 2 & 3. -->

      <!-- v1.65gZ44 — chevrons-right next-button. Bottom-right of the
           viewport on slides 1, 2 and 3; hidden on slide 4 where the
           user is already at the form. One click advances one slide
           via next() (slide-by-slide); contrast with the header CTA
           which fast-tracks straight to slide 4. -->
      <button
        *ngIf="step < TOTAL_STEPS - 1"
        type="button"
        class="bp-next-icon"
        (click)="next()"
        aria-label="Next slide">
        <!-- v1.65hU — chevrons-right → chevrons-down to match the
             slide-stack vertical scroll direction. -->
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m7 6 5 5 5-5"/>
          <path d="m7 13 5 5 5-5"/>
        </svg>
      </button>

      <!-- v1.65gZ24  — custom scroll progress pill (per client mockup).
           Position is driven by --scroll-progress on .bp-welcome-root,
           updated by the scroll listener in ngAfterViewInit.
           v1.65gZ25 — pill wrapped in an invisible clickable track.
           Clicking above the pill moves to the previous slide;
           clicking below moves to the next. The pill itself has
           pointer-events: none so the track always owns the click. -->
      <div class="bp-scroll-track"
           (click)="onScrollTrackClick($event)"
           role="button"
           aria-label="Previous or next slide">
        <div #scrollPill class="bp-scroll-pill" aria-hidden="true"></div>
      </div>

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
            We don't set any cookies of our own on this page, and we don't use analytics or advertising trackers. The only cookie involved is <code>__cf_bm</code>, set by Cloudflare on <code>challenges.cloudflare.com</code> when their bot-check runs on the signup form. It expires after 30 minutes and exists solely to remember that your browser has already passed a bot check. Cloudflare classifies it as strictly necessary for security, which exempts it from cookie-banner consent under GDPR/ePrivacy. If we ever introduce other cookies, a full Cookie Policy will be added here and a banner will appear before any are set.
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
       client review ("bold uppercase sans-serif").
       v2 port: the Fraunces+Inter @import moved to index.html (a <link>) so
       Angular's font-inlining budget (8kB/component-style) isn't tripped by
       the 29kB variable-font CSS. Same fonts, same rules below — no visual
       change. */

    :host {
      display: block;
      font-family: 'Fraunces', Georgia, serif;
      color: #DCF0EB;
      height: 100vh;
      overflow: hidden;
    }

    /* v1.65j1 — BALLPARK-click dissolve overlay. Sits above the
       welcome-root via z-index:100, opacity 0 by default. When the
       user clicks the BALLPARK logo from a non-home slide, goTo(0)
       toggles .active → opacity 1 (fade to green), an instant
       scroll resets to slide 1 underneath, then .active is removed
       → opacity 0 reveals slide 1 with its existing .in-view orb
       fade-in playing through the curtain. */
    .bp-ballpark-fade {
      position: fixed;
      inset: 0;
      background: #287F4D;
      opacity: 0;
      pointer-events: none;
      z-index: 100;
      transition: opacity 400ms ease-in-out;
    }
    .bp-ballpark-fade.active {
      opacity: 1;
    }

    .bp-welcome-root {
      position: relative;
      height: 100vh;
      overflow: hidden;
      /* v1.65hS — opaque coloured floor on the root so iOS Safari's
         scroll-snap handoff can't reveal body parchment for a frame.
         v1.65i2 — unified green per client request ("make the
         background 1 color, lets go for green leave the animation
         the same"). Slides 2/3/4 backgrounds + stage gradient all
         changed to the same green so there's nothing for a
         compositor gap to expose as a mismatch. The orb / fade
         animations are untouched — orbs still paint their own pink
         / blue / etc. gradient fills on top of the green base. */
      background: #287F4D;
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
      /* v1.65iA — header wordmark trimmed 32 → 26 per client review. */
      height: 26px;
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
    /* v1.65gZ24 — native scrollbar hidden again; replaced with a
       custom fixed-size pill (.bp-scroll-pill) that just slides
       down the right edge as scroll progresses. The client's idea
       is "just a pill, no bar" — no track, no growing/shrinking
       thumb that tracks content ratio, just a constant-size
       indicator that signals position. */
    .bp-welcome-stage {
      position: absolute; inset: 0;
      /* v1.65j0 — overflow scroll → hidden disabled user wheel/touch
         scrolling so the only nav path was the chevron / slide click.
         v2 (Liam) — RE-ENABLED native scrolling for back-nav (no button
         wanted). Tradeoff accepted: wheel/trackpad scrolling forward
         snaps directly and bypasses the credits-roll exit animations
         (those still play via the chevron/click path). scroll-snap keeps
         each slide aligned; the IntersectionObserver settle still fires
         each slide's .in-view entry animations on scroll arrival. */
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
      scrollbar-width: none;                       /* Firefox */
      -ms-overflow-style: none;                    /* Edge legacy */
      overscroll-behavior: contain;                /* iOS rubber-band suppression */
      /* v1.65jG — scroll-height-tall gradient (v1.65hW) removed.
         The gradient existed to paint the CORRECT slide colour
         behind any one-frame compositor gap iOS Safari left
         during a smooth scroll-snap handoff. With v1.65j0's
         click-only nav, all forward transitions use
         scrollTo({ behavior: 'instant' }) — there's no smooth
         scroll-snap that could expose a gap, so the gradient is
         no longer needed.
         Suspected source of the bright-pink rectangle the
         client saw on slide 2 in Safari: background-attachment:
         local on a scroll container creates an oversized
         compositor layer that WebKit clips erratically. Removing
         the gradient removes that layer entirely. If a green
         flash reappears between any two slides, the gradient
         (or per-slide overlay) needs to come back in a form
         that doesn't trip Safari. */
      background: transparent;
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

    /* v1.65gZ25 — invisible clickable track that owns the right-edge
       hit area. The visible pill sits inside it, positioned by the
       --scroll-progress CSS variable (0 to 1) set on .bp-welcome-root
       by the scroll listener in ngAfterViewInit. */
    .bp-scroll-track {
      position: fixed;
      right: 8px;
      top: 96px;
      bottom: 96px;
      width: 20px;
      z-index: 50;
      cursor: pointer;
      background: transparent;
      border: none;
      padding: 0;
    }
    /* v1.65gZ26 — width nudged 6 -> 8 (just a little fatter, per
       client review). Height unchanged at 40. */
    .bp-scroll-pill {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: calc(var(--scroll-progress, 0) * (100% - 40px));
      width: 8px;
      height: 40px;
      background: rgba(220, 240, 235, 0.55);
      border-radius: 999px;
      pointer-events: none;
      transition: top 0.18s ease-out, background 0.2s;
    }
    .bp-scroll-track:hover .bp-scroll-pill {
      background: rgba(220, 240, 235, 0.75);
    }

    /* v1.65gZ44  — chevrons-right next-slide icon button.
       v1.65gZ45 — chrome stripped (no glass pill / border / blur),
       icon bumped 24 -> 40, centred horizontally and dropped to
       ~85vh — roughly halfway between slide-1's subtitle and the
       bottom of the viewport. Hidden on slide 4 via the *ngIf in
       the template. */
    .bp-next-icon {
      position: fixed;
      left: 50%;
      bottom: 10vh;
      transform: translateX(-50%);
      width: 56px;
      height: 56px;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0;
      background: transparent;
      border: none;
      color: #DCF0EB;
      cursor: pointer;
      z-index: 50;
      opacity: 0.85;
      transition: opacity 0.2s, transform 0.2s;
    }
    .bp-next-icon:hover {
      opacity: 1;
      transform: translateX(-50%) translateY(2px);
    }
    .bp-next-icon:active {
      transform: translateX(-50%) translateY(2px) scale(0.96);
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
      /* v1.65jE / jF — Safari (Mac + iOS) leaks the SVG
         Gaussian-blur filter region past the slide's
         overflow:hidden boundary, rendering a bright pink (or
         blue) rectangle on the right side of slide 2 where the
         upper-right orb's filter region extends.
         jE tried HTML-level clip-path + contain:paint here —
         Chromium honoured it, Safari did not. The SVG filter
         appears to be composited on a GPU layer that bypasses
         HTML clip-path on the parent wrapper.
         jF adds -webkit-backface-visibility: hidden to coerce
         THIS wrapper into its own GPU compositor layer (no
         visible transform, blur quality preserved). GPU layers
         respect their parent's overflow rules, so the inner
         SVG filter layer now gets clipped at this wrapper's
         box. clip-path + contain:paint kept as defence in depth
         for Chromium. */
      clip-path: inset(0);
      contain: paint;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }

    /* v1.65gW  — orb entry animated by animating the individual
       <circle> elements INSIDE the filtered group rather than the
       SVG / group / wrapper. CSS animations on SVG children render
       inside the SVG's own coordinate space — the filter recomputes
       over the children natively, no HTML compositing layer is
       created, and the Gaussian blur survives.
       v1.65gZ40 — all slides now share the same opacity fade-in
       (per client review — "liked slide 3 animation and wanted the
       same approach on all the pages"). Earlier the global animation
       was a translateX wipe-in; that's retired here, slide 3's
       override is removed below, and every slide's orbs fade in
       cleanly together. */
    .bp-svg-bg circle {
      opacity: 0;
    }
    .bp-slide.in-view .bp-svg-bg circle {
      animation: bp-orb-fade-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes bp-orb-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* v1.65gZ40 — slide-3 orb-entry override removed. Was previously
       a custom path (scale-bloom -> opacity-fade -> scale 0.5->1 over
       v1.65gX / v1.65gZ18 / v1.65gZ39) to work around slide-3-specific
       issues (cx=400 centred orbs exposed the bg during a horizontal
       wipe; scale(0) collapsed the filter bbox). The global rule now
       does opacity fade for every slide, so slide 3 inherits it
       without a custom override. */

    /* v1.65gT — animation declared ONLY under .in-view, with the
       "from" pose as the element's direct (no-class) state. When
       the scroll handler removes .in-view (user navigates away)
       the element snaps back to the from-pose; when .in-view is
       added again on return, the animation declaration is freshly
       applied and the reveal replays from scratch. Adding/removing
       a class that ALSO toggles animation-play-state was no good —
       paused→running on a completed animation holds the end frame
       and never replays. */

    /* ── Slide 2 from-pose + reveal ──
       v1.65j2 — animation split per element. The headline scrolls
       up from below the visible area (starts at translateY(70vh),
       i.e. just below the slide bottom, and travels to its final
       resting position). The subtitle ("The best suppliers in the
       UK with quotes in minutes.") and the marquee stay hidden
       until the headline lands, then snap in (steps(1, end) gives
       a hard pop — no fade — exactly as the headline finishes).
       v1.65j3 — duration bumped 1.05s -> 1.5s and curve switched
       to linear so the rise matches the slide-1 credits-roll
       exit. The two animations run end-to-end (slide-1 inner
       rolls up off the top over 1.5s, then a 1-frame jump, then
       slide-2 inner rolls up from below over 1.5s) and read as a
       single continuous movie-credits crawl across the cut. */
    .bp-slide-2 .bp-suppliers-headline {
      transform: translateY(70vh); opacity: 0;
    }
    .bp-slide-2 .bp-suppliers-subtitle,
    .bp-slide-2 .bp-marquee-wrap {
      opacity: 0;
    }
    .bp-slide-2.in-view .bp-suppliers-headline {
      animation: bp-headline-rise 1.0s linear both;
    }
    .bp-slide-2.in-view .bp-suppliers-subtitle,
    .bp-slide-2.in-view .bp-marquee-wrap {
      animation: bp-snap-in 1.0s steps(1, end) both;
    }
    @keyframes bp-headline-rise {
      from { transform: translateY(70vh); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes bp-snap-in {
      0%   { opacity: 0; }
      100% { opacity: 1; }
    }

    /* ── Slide 1 credits-roll exit ──
       v1.65j3 — when the user clicks to leave slide 1, the inner
       lifts up off the top of the viewport at a constant speed,
       like the credits at the end of a film. Pairs with slide 2's
       headline rising from below for a continuous credits feel.
       Animation lasts 1.5s; the scroll-jump to slide 2 fires once
       the animation completes (orchestrated in scrollToSlide).
       opacity stays 1 — credits don't fade, they leave.
       v1.65j4 — during the 1.5s credits roll we ALSO transition
       slide-1's background from welcome green to slide-2's pink
       (#287F4D -> #EB7396) AND grow the pink orbs from r=280 to
       r=1780 so they fill the viewport. By the moment the
       scroll-jump fires (T=1.5s), the on-screen colour matches
       slide-2's bg exactly, hiding the cut. Slide 2 then animates
       its blue orbs from opacity 0 -> 1 over the same 1.5s as the
       headline rise, so "spheres appear" as the new text crawls
       up — reading as one continuous credits moment instead of
       two separate slide animations. */
    .bp-slide-1-inner.bp-credits-exit {
      animation: bp-credits-up 1s linear forwards;
    }
    .bp-slide-1.bp-credits-rolling {
      animation: bp-slide1-bg-to-pink 1s linear forwards;
    }
    /* v1.65jD — bp-orb-grow on slide-1 + slide-2 credits-roll
       removed. Growing the circles to r=1780 expanded the SVG
       Gaussian-blur filter region to a ~7000px-wide bounding box
       that iOS Safari (and Mac Safari) composited on its own
       layer, leaking a bright-pink rectangle past the parent's
       overflow:hidden onto slide 2. Same family of bug as the
       v1.65hT pink ghost-box. The bg-color shift alone (green ->
       pink for slide 1, pink -> teal for slide 2) is enough to
       bridge the colour into the next slide; the orb-grow was
       only adding the filter-region trap. */
    @keyframes bp-credits-up {
      from { transform: translateY(0);      opacity: 1; }
      to   { transform: translateY(-110vh); opacity: 1; }
    }
    @keyframes bp-slide1-bg-to-pink {
      from { background-color: #287F4D; }
      to   { background-color: #EB7396; }
    }

    /* ── Slide 2 sphere fade-in ──
       v1.65j4 — slide-2 circles get their own fade-in tuned to
       match the headline-rise timing (1.0s linear), overriding
       the global .bp-slide.in-view .bp-svg-bg circle rule
       (1.4s ease-out) for this slide only. Higher specificity
       (.bp-slide-2 vs .bp-slide) makes this rule win. Pairs
       with the credits-roll exit on slide 1: as the new
       headline crawls up from below, the blue spheres "appear"
       alongside it. Initial opacity:0 is inherited from the
       global .bp-svg-bg circle { opacity: 0 } rule above. */
    .bp-slide-2.in-view .bp-svg-bg circle {
      animation: bp-fade-in-circles 1.0s linear both;
    }
    @keyframes bp-fade-in-circles {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Slide 2 → 3 credits-roll exit ──
       v1.65j6 — same movie-credits treatment we apply to slide 1
       on its way to slide 2, now on slide 2 on its way to slide 3.
       Triggered by .bp-credits-rolling on the slide-2 section
       (bound to slide2CreditsRolling in the component). During
       the roll:
         · .bp-slide-2-inner + .bp-marquee-wrap translate up off
           the top of the viewport (bp-credits-up, reused from
           the slide-1 exit — same keyframe drives both).
         · The section's background-color transitions from slide-2
           pink (#EB7396) to slide-3 teal (#6391A4), so the bg
           matches slide-3 exactly by the time the jump fires.
         · The blue orbs grow from r=280 to r=1780 (bp-orb-grow
           reused from slide 1) so the page reads solid teal-ish
           at the end of the roll.
       v1.65j7 — duration 1s -> 1.2s. Slide 2 has more elements
       moving at once (inner + marquee + orbs + bg) so the same
       1s as slide 1 read as "quicker" per client feedback. The
       JS scroll-jump delay is bumped to match (see scrollToSlide). */
    .bp-slide-2.bp-credits-rolling .bp-slide-2-inner,
    .bp-slide-2.bp-credits-rolling .bp-marquee-wrap {
      animation: bp-credits-up 1.2s linear forwards;
    }
    .bp-slide-2.bp-credits-rolling {
      animation: bp-slide2-bg-to-teal 1.2s linear forwards;
    }
    /* v1.65jD — bp-orb-grow on slide 2 dropped for the same iOS
       Safari compositor reason as slide 1. See note above. */
    @keyframes bp-slide2-bg-to-teal {
      from { background-color: #EB7396; }
      to   { background-color: #6391A4; }
    }

    /* ── Slide 3 sphere fade-in ──
       v1.65j6 — overrides the global 1.4s ease-out for this
       slide so the orb fade-in matches the credits-roll pacing
       (1s linear). Same pattern as slide-2's fade-in override. */
    .bp-slide-3.in-view .bp-svg-bg circle {
      animation: bp-fade-in-circles 1.0s linear both;
    }

    /* ── Slide 3 exit (three elements, sequential) ──
       v1.65j9 — exit mirrors the entry order and direction:
         T=0:    .bp-producers-headline exits to the left
         T=0.3s: .bp-producers-tagline exits to the left
         T=0.6s: .bp-producers-body exits to the right
       Each animation 0.6s ease-out, same curve as entry. Total
       1.2s — JS timer in scrollToSlide() matches.
       both fill-mode is critical here: without it, each element
       snaps to the bp-to-* "from" pose at the moment its
       animation is declared (delay or no delay), instantly
       hiding it before any motion is visible. That manifested
       as "feels like it pauses and then shows slide 4" in
       v1.65j8 — the columns disappeared the moment .bp-credits-
       rolling was added, then the timer ran out with no visible
       motion, then the jump happened. both fills BACKWARDS too,
       so each element holds its at-rest pose (translateX 0,
       opacity 1) during the stagger delay, then animates out
       cleanly. */
    .bp-slide-3.bp-credits-rolling .bp-producers-headline {
      animation: bp-to-left 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bp-slide-3.bp-credits-rolling .bp-producers-tagline {
      animation: bp-to-left 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
    }
    .bp-slide-3.bp-credits-rolling .bp-producers-body {
      animation: bp-to-right 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both;
    }
    @keyframes bp-to-left {
      from { transform: translateX(0);      opacity: 1; }
      to   { transform: translateX(-100vw); opacity: 0; }
    }
    @keyframes bp-to-right {
      from { transform: translateX(0);     opacity: 1; }
      to   { transform: translateX(100vw); opacity: 0; }
    }

    /* ── Slide 3 entry (three elements, sequential) ──
       v1.65j9 — animation targets the three text elements
       individually rather than the two grid columns. Sequence:
         T=0:    .bp-producers-headline ("A PRODUCERS BEST FRIEND")
                 slides in from translateX(-100vw) -> 0
         T=0.3s: .bp-producers-tagline ("By producers for creators")
                 slides in from translateX(-100vw) -> 0
         T=0.6s: .bp-producers-body ("Costing events can be a
                 grind...") slides in from translateX(100vw) -> 0
       0.6s each, 0.3s stagger -> total 1.2s. Same cubic ease-out
       across all three so each line settles smoothly.
       both fill-mode preserves the from-pose during the stagger
       delay (so a tagline at translateX(-100vw) stays off-screen-
       left while the headline is still arriving — no early flash
       of the tagline at its resting position). */
    .bp-slide-3 .bp-producers-headline,
    .bp-slide-3 .bp-producers-tagline {
      transform: translateX(-100vw); opacity: 0;
    }
    .bp-slide-3 .bp-producers-body {
      transform: translateX(100vw); opacity: 0;
    }
    /* v1.65jC — :not(.bp-credits-rolling) added so the entry
       rule doesn't fight the exit rule. The exit rules above
       were source-ordered BEFORE the entry rules, which (with
       equal specificity 0-3-0) meant the entry rule won the
       cascade and its both-fill held the at-rest pose,
       silently clobbering the exit animation. Now when
       .bp-credits-rolling is on the section, only the exit
       rules apply. */
    .bp-slide-3.in-view:not(.bp-credits-rolling) .bp-producers-headline {
      animation: bp-from-left 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .bp-slide-3.in-view:not(.bp-credits-rolling) .bp-producers-tagline {
      animation: bp-from-left 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
    }
    .bp-slide-3.in-view:not(.bp-credits-rolling) .bp-producers-body {
      animation: bp-from-right 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both;
    }
    @keyframes bp-from-left {
      from { transform: translateX(-100vw); opacity: 0; }
      to   { transform: translateX(0);      opacity: 1; }
    }
    @keyframes bp-from-right {
      from { transform: translateX(100vw);  opacity: 0; }
      to   { transform: translateX(0);      opacity: 1; }
    }

    /* ── Slide 4 from-pose + reveal ──
       v1.65jA — the headline / form / footer block (the whole
       .bp-slide-4-inner glass panel) now rises up from the
       bottom of the viewport as one unit. Replaces the previous
       per-element entry (.bp-eyebrow stamp + .bp-guestlist-
       headline bounce-in + .bp-guestlist-form rise); those
       declarations and their keyframes (bp-stamp, bp-bounce-in,
       bp-form-rise) are retired. Sphere fade-in is intentionally
       NOT overridden here — slide 4 keeps the global 1.4s ease-
       out orb-fade so the dark-green orbs come up on their own
       timing as the container arrives.
       v1.65jB — animation now composes translateX(-50%) WITH the
       translateY rise. .bp-slide-4-inner uses position:absolute +
       left:50% + transform:translateX(-50%) for its horizontal
       centering; the jA animation replaced the entire transform
       with translateY alone, knocking the panel half a viewport-
       width to the left. Always include translateX(-50%) on both
       keyframes (and the from-pose) so the panel stays centred
       throughout the rise. */
    .bp-slide-4 .bp-slide-4-inner {
      transform: translate(-50%, 100vh); opacity: 0;
    }
    .bp-slide-4.in-view .bp-slide-4-inner {
      animation: bp-slide4-rise 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes bp-slide4-rise {
      from { transform: translate(-50%, 100vh); opacity: 0; }
      to   { transform: translate(-50%, 0);     opacity: 1; }
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

    /* Per-slide bases (circle gradients live in template <linearGradient> defs).
       v1.65gZ33  — bleed the previous slide's colour into the top ~14vh of
       each slide so the boundary between scroll-snap stops reads as a
       soft gradient rather than a hard horizontal line.
       v1.65gZ34 — moved the bleed off the background property (which kept
       it visible after the transition settled) onto a ::before pseudo-
       element with opacity tied to .in-view. The bleed shows during
       scroll, fades out once the scroll settles, fades back in when the
       user scrolls away. Slide 1 has no previous slide; slides 3 + 4
       share the same teal so the slide-4 boundary needs no bleed. */
    /* v1.65i2 — all slide backgrounds unified to slide-1 green as
       a debug control to isolate the 1→2 transition artifact.
       v1.65i7 — original per-slide colours restored now that the
       1→2 fade-out + instant jump (v1.65i3..i6) has fixed the
       artifact properly. */
    .bp-slide-1 { background: #287F4D; }

    /* v1.65i3 — exiting state for any slide that's transitioning
       out via the fade-out + instant-jump handoff. When the user
       clicks Next, the leaving slide's orbs / grain / inner are
       removed from the DOM (*ngIf on exitingFromSlide), the page
       jumps to the next slide, and the destination's .in-view
       fade-up reveals it normally.
       v1.65i4 — bp-bg-layer hide via display:none (the *ngIf does
       the same job now, but kept as defensive CSS). The orbs sit
       inside a <filter url(#blur)> group; opacity:0 on the parent
       leaves the iOS Safari compositor to recompute the filter
       region for children separately, which staggers the orbs out.
       display:none / *ngIf removal sidesteps that entirely.
       v1.65i8 — generalized from .bp-slide-1.bp-slide-1-exiting to
       any .bp-slide.bp-slide-exiting. */
    .bp-slide.bp-slide-exiting .bp-bg-layer {
      display: none !important;
    }
    .bp-slide.bp-slide-exiting .bp-grain,
    .bp-slide.bp-slide-exiting .bp-slide-inner {
      opacity: 0 !important;
      transition: none !important;
      animation: none !important;
    }
    .bp-slide-2 {
      background: #EB7396;
      flex-direction: column;
      padding: 80px 0 100px;
    }
    /* v1.65gZ36 / v1.65gZ37 — both inter-slide colour transitions
       now handled by EXPANDING the leaving slide's orbs to fill the
       viewport with their colour, bridging into the next slide's
       background. The static ::before gradient bleed is no longer
       needed for either boundary; the orb expansion supersedes it.
         · slide 1 -> 2: pink orbs grow, page reads pink, into pink slide 2
         · slide 2 -> 3: blue orbs grow, page reads blue, into teal slide 3
           (slide-2's blue gradient #79A8BA->#457187 sits in the same
           teal family as slide-3's #6391A4, so the cross-over is
           perceptually smooth)
       CSS r on SVG circles is supported in modern browsers (Chromium
       99+, Firefox 73+, Safari 16+); JS sets --s1-leaving + --s2-leaving
       on .bp-welcome-root in the scroll handler. We layer it on the
       existing translateX wipe-in animation by setting r rather than
       transform, so the two do not fight. */
    .bp-slide-1 .bp-svg-bg circle {
      r: calc(280px + var(--s1-leaving, 0) * 1500px);
    }
    .bp-slide-2 .bp-svg-bg circle {
      /* v2.30j — reverse 2→1, STEP 1: --s2-shrink scales the blue orbs'
         r 280→0. The base term keeps the forward 2→3 grow (--s2-leaving)
         untouched; on the way up --s2-leaving is 0 so r = 280 * --s2-shrink. */
      r: calc((280px + var(--s2-leaving, 0) * 1500px) * var(--s2-shrink, 1));
    }
    /* v2.30k — reverse 2→1 step 1 (Option A): a scroll-UP off slide 2
       triggers a TIMED shrink (not raw scroll position) so the screen
       can HOLD on pink. .bp-reverse-rolling collapses the blue orbs to
       r=0 over 0.8s and forwards-fill holds them gone, leaving slide 2's
       pink CSS bg. opacity pinned to 1 so the shrink is visible (this
       animation replaces the .in-view fade-in, which would otherwise
       leave opacity at the global 0). */
    .bp-slide-2.bp-reverse-rolling .bp-svg-bg circle {
      animation: bp-orb-shrink 0.8s cubic-bezier(0.4, 0, 0.6, 1) forwards;
    }
    @keyframes bp-orb-shrink {
      from { r: 280px; opacity: 1; }
      to   { r: 0px;   opacity: 1; }
    }
    /* v2.30n — reverse 2→1 STEP 2 (Option A): the pink→green handoff.
       (1) slide-2's text + marquee crawl fully OFF the bottom of the page
       (translateY 110vh) over 1.1s — generous time to clear before the
       cut, per Liam. opacity stays 1 (they leave, they don't fade). */
    .bp-slide-2.bp-reverse-rolling-2 .bp-slide-2-inner,
    .bp-slide-2.bp-reverse-rolling-2 .bp-marquee-wrap {
      animation: bp-credits-down 1.7s ease-in-out forwards;
    }
    @keyframes bp-credits-down {
      from { transform: translateY(0);     opacity: 1; }
      to   { transform: translateY(110vh); opacity: 1; }
    }
    /* (2) After slide-2 has cleared we jump to slide 1 (hidden pink→pink
       cut) and add .bp-reverse-enter, which runs the MASK sequence over
       1.6s — orbs and bg animations share the duration so they stay in
       lockstep:
         · orbs (bp-reverse-enter-orbs): expand r 280→1780 so the two pink
           spheres OVERLAP and cover the whole viewport (background hidden),
           hold covered, then shrink back to the resting r=280.
         · bg (bp-reverse-enter-bg): held at slide-2 pink while the orbs
           are still expanding, flipped to slide-1 green during the covered
           window (so the colour change is never seen), then revealed as the
           orbs shrink away.
       forwards-fill holds the resting state (= normal slide 1); cleared on
       the next forward 1→2. Higher specificity than the global .in-view
       fade-in/orb rules, so this wins during the reverse entry. */
    .bp-slide-1.bp-reverse-enter {
      animation: bp-reverse-enter-bg 1.6s linear forwards;
    }
    @keyframes bp-reverse-enter-bg {
      0%, 42%  { background-color: #EB7396; }   /* pink — orbs still expanding to cover */
      52%,100% { background-color: #287F4D; }   /* green — flipped while fully covered */
    }
    .bp-slide-1.bp-reverse-enter .bp-svg-bg circle {
      animation: bp-reverse-enter-orbs 1.6s cubic-bezier(0.4, 0, 0.4, 1) forwards;
    }
    @keyframes bp-reverse-enter-orbs {
      0%   { r: 280px;  opacity: 1; }   /* at the cut: pink orbs on pink bg = uniform pink */
      35%  { r: 1780px; opacity: 1; }   /* expanded so the orbs overlap, hiding the bg */
      55%  { r: 1780px; opacity: 1; }   /* hold the cover while bg flips pink→green */
      100% { r: 280px;  opacity: 1; }   /* shrink to target → green revealed */
    }
    /* v1.65hX..hZ defensively hid .bp-slide-1/2 .bp-svg-bg on mobile
       to dodge the pink-box compositor artifact. v1.65i9 — restored
       on mobile. The v1.65i3..i8 fade-out + instant-jump handoff
       now removes the leaving slide's SVG from the DOM entirely
       before the scroll, so the iOS Safari filter compositor never
       gets a chance to flash the unblurred orb. Mobile sees the
       spheres again on slides 1 + 2. */
    /* v1.65gZ38  — slide 3 had the same orb-expansion treatment as
       slides 1 + 2, on the grounds of kinetic consistency.
       v1.65gZ48 — REMOVED. Both slide 3 and slide 4 share the same
       #6391A4 teal background, so an expanding green orb on slide 3
       actively CREATED a transient green-vs-teal split during the
       scroll that wouldn't exist if we just left the orbs at their
       normal size. Per client review: "we need the green orbs to
       disappear leaving the page the blue [teal] before showing the
       objects on page 4". Letting slide 3's orbs ride off-screen
       with the slide (no expansion) leaves slide 4's teal bg clean
       when it arrives; the 450ms settle delay then gives a beat of
       just-teal before slide 4's content fades in. --s3-leaving is
       still published from the scroll handler but currently unused. */
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
      /* v1.65iA — gap tightened 14 → 6 so "Welcome to" sits closer
         to the BALLPARK wordmark per client review. */
      gap: 6px;
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
      /* v1.65iA — slide-1 eyebrow wordmark trimmed 28 → 22 per
         client review. */
      height: 22px;
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
      /* v1.65gZ41 — bump word-spacing so the gaps between REAL/COSTS
         and REAL/FAST read clearly. The headline uses -0.04em letter-
         spacing which tightens everything including the inter-word
         spaces; word-spacing pushes JUST the gaps without splaying
         the letters within each word. */
      word-spacing: 0.25em;
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
    /* v1.65gZ46 — body font specs aligned with slide 2's subtitle
       (Inter 500 clamp(15-18)/1.55 at 0.9 opacity) per client review.
       Keeps the max-width 380px column from v1.65gZ7. */
    .bp-producers-body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: clamp(15px, 1.5vw, 18px);
      font-weight: 500;
      line-height: 1.55;
      opacity: 0.9;
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

      /* v1.65hV — panel made more transparent per client review.
         v1.65hZ — bumped a touch further: fill 0.03 → 0.02, border
         0.12 → 0.09, blur 12 → 10. Reads even more as just-a-shape. */
      background: rgba(220, 240, 235, 0.02);
      border: 1px solid rgba(220, 240, 235, 0.09);
      border-bottom: none;
      border-radius: 56px 56px 0 0;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);

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
        /* v1.65hY — on phone, make the panel near-invisible.
           v1.65hZ — border softened 0.06 → 0.03 so the outline is
           barely traceable; bg already at 0.005 (effectively none). */
        background: rgba(220, 240, 235, 0.005);
        border-color: rgba(220, 240, 235, 0.03);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
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
      /* v1.65iB — entered text 14 → 12 per client review so longer
         email addresses fit comfortably without overflowing the pill. */
      font-size: 12px;
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

    /* ── Slide 4 footer (Contact / Instagram / TikTok / Legal | ©) ─
       v1.65gZ2 — 3-column grid with © centred.
       v1.65iB — Legal moved into the links row so the footer is now
       a 2-column grid (links | ©). The .bp-footer-link--right
       isolated slot is gone; .bp-footer-link--button retains its
       button-as-link reset. */
    .bp-welcome-footer {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      z-index: 6;
      padding: 18px 32px 22px;
      display: grid;
      grid-template-columns: 1fr auto;
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
    .bp-footer-link--button {
      /* Reset button defaults so Legal renders identically to the
         anchor links beside it. */
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      cursor: pointer;
    }
    .bp-footer-copy {
      justify-self: end;
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
      .bp-footer-links {
        justify-self: center;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
      }
      .bp-footer-copy { justify-self: center; }
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

    /* v1.65gZ29 — Turnstile widget wrapper. Centred under the form;
       Cloudflare renders an iframe roughly 65px tall in compact mode.
       The widget is theme: dark to match the welcome page. */
    .bp-turnstile-wrap {
      display: flex;
      justify-content: center;
      /* v2: invisible Turnstile (interaction-only) — reserve no space when
         it's not showing a challenge. */
      min-height: 0;
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
  /** v1.65gZ25 — pill ref used by the track click handler so we can
      compare the click Y to the pill's current centre and route
      to prev() vs next(). */
  @ViewChild('scrollPill') scrollPillRef?: ElementRef<HTMLElement>;
  /** v1.65gZ29 — Turnstile widget host. Rendered into via the
      explicit window.turnstile.render() API after the api.js script
      finishes loading. */
  @ViewChild('turnstileEl') turnstileEl?: ElementRef<HTMLElement>;

  step = 0;
  /** v1.65j1 — BALLPARK-click dissolve state. True while the green
      curtain is covering the page during goTo(0). Drives the
      .bp-ballpark-fade overlay's .active class. */
  ballparkFading = false;
  /** v1.65j3 — slide 1 → 2 credits-roll exit state. True while
      slide 1's inner is animating up off the top of the viewport.
      Drives the .bp-credits-exit class on .bp-slide-1-inner.
      Held for 1s before the actual scroll-jump fires, so the
      text has time to lift off above the fold. */
  slide1CreditsRolling = false;
  /** v1.65j6 — slide 2 → 3 credits-roll exit state. Same scheme
      as slide1CreditsRolling: drives .bp-credits-rolling on the
      slide-2 section so the inner + marquee lift off, the bg
      shifts pink -> teal, and the blue orbs grow to fill. */
  slide2CreditsRolling = false;
  /** v1.65j7 — slide 3 → 4 exit state. Slide 3's inner rises
      from below on entry and falls back below on exit (the
      "reverse of how it entered" — purely vertical container
      motion, no orb-grow, no bg shift since slide 3 and slide 4
      share the same #6391A4 teal bg). */
  slide3CreditsRolling = false;
  /** v2.30k — REVERSE 2→1, step 1 (timed, "Option A"). True while
      slide-2's blue orbs are shrinking to nothing on a scroll-UP off
      slide 2. Drives .bp-reverse-rolling on the slide-2 section so the
      blue orbs collapse (bp-orb-shrink) leaving slide 2's uniform pink
      CSS bg. Mirror of the forward credits-roll, opposite operation. */
  slide2ReverseRolling = false;
  /** v2.30k — latches once step 1's blue-orb shrink has completed so
      the pink screen is HELD (orbs stay at r=0) instead of popping back.
      A further scroll-up then triggers step 2. Reset when slide 2 is
      re-entered forward (1→2) so the orbs are full again. */
  reverseStage1Done = false;
  /** v2.30l — reverse 2→1 step 2 (Option A). True while the pink→green
      handoff is playing: slide-2's text crawls out, then we jump to
      slide 1 whose bg washes pink→green as its pink orbs expand in.
      Mirror of the forward credits-roll's green→pink bridge. */
  slide2ReverseRolling2 = false;
  /** Kept for legacy bindings (template still references it). Now
      always 'forward' since per-slide animations are one-shot. */
  direction: 'forward' | 'backward' = 'forward';
  /** v1.65i3 — slide exit transition state.
      v1.65i8 — generalized from slide-1-only to ALL forward
      transitions (1→2, 2→3, 3→4). Holds the index of the slide
      currently being exited; its orbs / grain / inner content are
      removed from the DOM via *ngIf, the page jumps instantly to
      the next slide, then the destination slide's .in-view fade-up
      animations reveal it. null = no exit in progress. */
  exitingFromSlide: number | null = null;
  /** Legacy alias retained because the slide-1 template binding
      still reads slide1Exiting. v1.65i8 keeps it in sync with
      exitingFromSlide for backward compat. */
  get slide1Exiting(): boolean { return this.exitingFromSlide === 0; }
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

  /** v1.65gZ29 — Cloudflare Turnstile token. Captured on widget
      success callback, sent with the signup payload, cleared on
      expiry / error / submit-completion. canSubmit() now also
      requires a non-empty token. */
  turnstileToken: string | null = null;
  private turnstileWidgetId: string | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private rc: RuntimeConfigService) {}

  /** v2 port — the API base comes from runtime config (not a baked
   *  environment.apiUrl). v1's `apiUrl` already included `/api`, so mirror
   *  that here; the shared server's public marketing endpoints are unchanged. */
  private get apiUrl(): string { return `${this.rc.get().apiBaseUrl}/api`; }

  ngOnInit() {
    // Cache-bust: marketing copy is admin-edited and should reflect on the
    // next load, not after a hard refresh (v2 — the GET was being served from
    // browser HTTP cache).
    this.http.get<Content>(`${this.apiUrl}/welcome/content?t=${Date.now()}`).subscribe({
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
    this.http.get<any>(`${this.apiUrl}/org`).subscribe({
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
    let lastRevScrollTop = 0;   // v2.30o — previous scrollTop, for up/down detection
    const setCurrentInView = (idx: number) => {
      if (idx === this.lastSettledIdx) return;
      this.lastSettledIdx = idx;
      // v2.30k — a fresh settle on slide 2 (arrived by any path) clears
      // the reverse-step-1 latch so the blue orbs are full again, not
      // held at r=0 from a previous reverse. Doesn't fire mid-reverse:
      // that path preventDefaults the scroll, so no settle occurs.
      if (idx === 1 && (this.slide2ReverseRolling || this.slide2ReverseRolling2 || this.reverseStage1Done)) {
        this.slide2ReverseRolling = false;
        this.slide2ReverseRolling2 = false;
        this.reverseStage1Done = false;
        this.slideRefs?.toArray()[1]?.nativeElement.classList.remove('bp-reverse-rolling', 'bp-reverse-rolling-2');
      }
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

    // v1.65gZ24  — publish a 0-to-1 --scroll-progress CSS var on the
    // welcome root so the .bp-scroll-pill can slide along the right
    // edge as the user moves through the deck. Setting it on
    // .bp-welcome-root (the host's child) keeps the var inheritable
    // by everything inside without polluting :root.
    // v1.65gZ36 — also publish --s1-leaving (0 = parked on slide 1,
    // 1 = parked on slide 2). Drives slide-1's pink orb expansion so
    // the page bridges to slide 2's pink background as the user
    // scrolls into the transition.
    const root = stage.parentElement; // .bp-welcome-root
    const setProgress = () => {
      if (!root) return;
      const max = stage.scrollHeight - stage.clientHeight;
      const p = max > 0 ? Math.max(0, Math.min(1, stage.scrollTop / max)) : 0;
      root.style.setProperty('--scroll-progress', String(p));

      // Per-slide leaving fractions. stage.scrollTop / clientHeight =
      // float position in slide-units (0 = slide 1, 1 = slide 2, ...).
      // v1.65gZ37 — slide-2 leaving added alongside slide-1 so the
      // blue orbs on slide 2 expand to bridge into slide 3's teal.
      // v1.65gZ38 — slide-3 leaving added for the 3->4 transition.
      // v1.65hT — collapse each leaving fraction BACK to 0 once the
      // user is settled past the transition window. Previously these
      // saturated at 1 forever, so slide-N's orbs stayed at r=1780px
      // while parked on slide N+1. iOS Safari has a known bug where
      // SVG content under a Gaussian-blur filter is composited on a
      // separate layer and can leak past the parent's overflow:hidden,
      // producing a pink "ghost box" on slide 2 from slide 1's
      // expanded orb. Triangle wave: ramps up 0→1 during the
      // transition then ramps back to 0 over a short settle window
      // so the orbs return to r=280 (well inside their own slide)
      // and can't visually escape. Desktop is unaffected.
      const vh = stage.clientHeight || window.innerHeight;
      const slideF = stage.scrollTop / vh;
      const SETTLE = 0.15; // slide-units over which the leaving fraction collapses back
      const leaving = (i: number) => {
        const rel = slideF - i;
        if (rel <= 0) return 0;
        if (rel <= 1) return rel;                        // 0 → 1 during transition
        return Math.max(0, 1 - (rel - 1) / SETTLE);      // 1 → 0 over SETTLE window
      };
      root.style.setProperty('--s1-leaving', String(leaving(0)));
      root.style.setProperty('--s2-leaving', String(leaving(1)));
      root.style.setProperty('--s3-leaving', String(leaving(2)));

      // v2.30i — REVERSE 2→1 (free-scroll back-nav). Mirror of the
      // forward 1→2 bridge, opposite operation: as the user scrolls
      // UP off slide 2, slide-2's blue orbs shrink to nothing so the
      // screen settles to slide-2's uniform pink bg, then slide-1's
      // pink orbs (driven by --s1-leaving, already 1→0 on the way up)
      // shrink to expose slide-1's green. --s2-shrink is a pure
      // position fn: 1 while parked on slide 2 (or beyond, so the
      // 2→3 grow is untouched), ramping to 0 as you arrive on slide 1.
      // The forward 1→2 approach also drives it 0→1, but slide 2 isn't
      // .in-view then (orbs opacity 0), so that grow-from-0 is unseen.
      const s2shrink = Math.min(1, Math.max(0, slideF));
      root.style.setProperty('--s2-shrink', String(s2shrink));
    };

    // v2.30o — the reverse 2→1 sequence, triggerable from EITHER the wheel
    // handler OR an upward scroll detected in onScroll (scrollbar drag /
    // track-click / keyboard / touch). Locks the stage (overflow hidden)
    // for its duration so user scrolling can't fight the timed animation,
    // then restores it on slide 1. Guarded against re-entry.
    const startReverse = () => {
      if (this.slide2ReverseRolling) return;
      const vh = stage.clientHeight || window.innerHeight;
      this.slide2ReverseRolling = true;
      this.slide2ReverseRolling2 = true;
      this.reverseStage1Done = true;
      clearTimeout(settleTimer);
      stage.scrollTop = vh;                 // ensure slide 2 is the canvas
      stage.style.overflowY = 'hidden';     // lock user scroll for the duration
      const refs = this.slideRefs?.toArray() || [];
      const s2el = refs[1]?.nativeElement, s1el = refs[0]?.nativeElement;
      // Phase 1 (0–0.8s): blue orbs shrink → uniform pink screen.
      s2el?.classList.add('bp-reverse-rolling');
      // Phase 2 (0.8s, 1.7s long): slide-2 text + marquee crawl fully off
      // — a slow, steady credits drift, per Liam.
      setTimeout(() => { s2el?.classList.add('bp-reverse-rolling-2'); }, 800);
      // Phase 3 (~2.5s, after slide 2 clears): hidden pink→pink cut to
      // slide 1 + the mask sequence (orbs cover → bg flips green → shrink).
      setTimeout(() => {
        this.step = 0;
        this.cdr.markForCheck();
        s1el?.classList.add('bp-reverse-enter');
        stage.scrollTop = 0;
        this.forceInView(0);
        // We short-circuited onScroll for the whole reverse, so the
        // scroll-progress var (and the position pill it drives) is frozen
        // at slide 2. Now that we've landed on slide 1, recompute it so the
        // indicator snaps back to the TOP, and reset the up/down tracker.
        lastRevScrollTop = 0;
        setProgress();
        setTimeout(() => {
          s2el?.classList.remove('bp-reverse-rolling', 'bp-reverse-rolling-2');
          stage.style.overflowY = 'scroll';  // restore user scroll on slide 1
          this.slide2ReverseRolling = false;
          this.slide2ReverseRolling2 = false;
          this.reverseStage1Done = false;
        }, 1700);
      }, 2500);
    };

    const onScroll = () => {
      const vh = stage.clientHeight || window.innerHeight;
      const prev = lastRevScrollTop;
      lastRevScrollTop = stage.scrollTop;

      // Ignore scroll churn while a reverse is mid-flight (the stage is
      // locked; only our own programmatic scrollTop changes fire here).
      if (this.slide2ReverseRolling) return;

      // Trigger the reverse from ANY upward scroll off slide 2 — scrollbar
      // drag, track click, keyboard, touch — not just the wheel handler.
      // Must be moving UP (scrollTop < prev) AND have been settled on slide 2
      // (prev near vh); this excludes the forward 1→2 down-scroll, which
      // passes through the same zone going the other way.
      if (this.step === 1 && stage.scrollTop < prev && prev >= vh - 8 && stage.scrollTop < vh - 8) {
        startReverse();
        return;
      }

      const idx = Math.max(0, Math.min(TOTAL_STEPS - 1,
        Math.round(stage.scrollTop / vh)));

      if (idx !== this.step) {
        this.step = idx;
        this.cdr.markForCheck();
      }

      setProgress();

      // v1.65gZ47 — settle delay 150ms -> 450ms. The .in-view class
      // triggers every entry animation on a slide (orb fade-in,
      // headline/body slide-up, form rise, etc.). Holding it longer
      // gives the user's eye time to absorb the orb-expansion colour
      // bridge before the next slide's content starts revealing —
      // per client review the previous timing felt too eager,
      // especially on slide 2 -> 3 and 3 -> 4 where the orb colour
      // doesn't perfectly match the next slide's background.
      // Slide 1's initial paint still bypasses this timer (direct
      // setCurrentInView(0) call below), so first-paint isn't delayed.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const settledIdx = Math.max(0, Math.min(TOTAL_STEPS - 1,
          Math.round(stage.scrollTop / vh)));
        setCurrentInView(settledIdx);
      }, 450);
    };

    stage.addEventListener('scroll', onScroll, { passive: true });

    // v2.30k/o — reverse 2→1 (Option A). The deck snap-scrolls too fast to
    // play the cinematic reverse on a raw scroll, so intercept upward intent
    // off slide 2 and run the timed sequence (startReverse). Wheel is handled
    // here (pre-empt the native scroll); scrollbar/keyboard/touch are caught
    // by the upward-scroll check in onScroll.
    const onWheel = (e: WheelEvent) => {
      if (this.step !== 1 || e.deltaY >= 0) return;   // slide 2 + upward only
      e.preventDefault();                              // pre-empt the native scroll
      startReverse();
    };
    stage.addEventListener('wheel', onWheel, { passive: false });

    this.scrollListener = () => {
      clearTimeout(settleTimer);
      stage.removeEventListener('scroll', onScroll);
      stage.removeEventListener('wheel', onWheel);
    };

    // Slide 0 is in view on load — mark immediately so first paint
    // doesn't sit in the from-pose for 150ms.
    setCurrentInView(0);
    // Initialise the scroll-progress var so the pill paints at top.
    setProgress();

    // v1.65gZ29 — load Cloudflare Turnstile and render the widget
    // into #turnstileEl. The script is loaded once; subsequent
    // welcome-page visits within the same SPA session reuse the
    // already-loaded global.
    this.loadAndRenderTurnstile();
  }

  /** v1.65gZ29 — load Turnstile api.js (once) and render the widget. */
  private loadAndRenderTurnstile() {
    const w = window as any;
    const render = () => {
      if (!w.turnstile || !this.turnstileEl) return;
      // Don't double-render.
      if (this.turnstileWidgetId) return;
      this.turnstileWidgetId = w.turnstile.render(this.turnstileEl.nativeElement, {
        sitekey: environment.turnstileSiteKey,
        theme: 'dark',
        size: 'flexible',
        // v2: run invisibly — the widget mints a token in the background and
        // only shows UI if Cloudflare decides a human-check is needed. Token
        // still flows to the server's siteverify; no visible checkbox.
        appearance: 'interaction-only',
        callback: (token: string) => {
          this.turnstileToken = token;
          this.cdr.markForCheck();
        },
        'error-callback': () => {
          this.turnstileToken = null;
          this.cdr.markForCheck();
        },
        'expired-callback': () => {
          this.turnstileToken = null;
          this.cdr.markForCheck();
        }
      });
    };

    if (w.turnstile) {
      render();
      return;
    }
    // Hook onload before injecting the script.
    w.__bpTurnstileOnLoad = render;
    const existing = document.getElementById('cf-turnstile-script');
    if (existing) return; // another tab in the same page already loading
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__bpTurnstileOnLoad&render=explicit';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
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
  goTo(i: number) {
    // v1.65j1 — BALLPARK-click dissolve. When the user clicks the
    // BALLPARK logo from any non-home slide, fade the page to green
    // via a fixed-position overlay BEFORE jumping back to slide 1.
    // Sequence:
    //   T=0:    ballparkFading=true → .bp-ballpark-fade.active →
    //           overlay opacity 0 → 1 over 400ms (covers page green).
    //   T=400:  reset --s*-leaving vars, instant-jump to slide 1.
    //   T=500:  ballparkFading=false → overlay opacity 1 → 0 over
    //           400ms (reveals slide 1, with slide 1's existing
    //           .in-view orb fade-in playing through the curtain).
    // If user is already on slide 1, no dissolve — just no-op.
    if (i === 0) {
      if (this.step === 0) return;  // already home
      this.ballparkFading = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        const root = this.stageRef?.nativeElement?.parentElement as HTMLElement | null;
        if (root) {
          root.style.setProperty('--s1-leaving', '0');
          root.style.setProperty('--s2-leaving', '0');
          root.style.setProperty('--s3-leaving', '0');
        }
        const stage = this.stageRef?.nativeElement;
        if (stage) {
          stage.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
        setTimeout(() => {
          this.ballparkFading = false;
          this.cdr.markForCheck();
        }, 100);
      }, 400);
      return;
    }
    this.scrollToSlide(i);
  }

  private scrollToSlide(i: number) {
    // v1.65hS — scroll the STAGE container directly instead of calling
    // scrollIntoView on the slide element. On iOS Safari, scrollIntoView
    // walks up the scroll-chain and can briefly scroll the document
    // (not the snap container), which exposes the body background for
    // a frame — the "white flash" reported on mobile. Targeting the
    // stage keeps the scroll entirely within the snap container and
    // sidesteps that whole class of bug.
    const stage = this.stageRef?.nativeElement;
    if (!stage) {
      // Defensive fallback for the (impossible) case where the stage
      // ref isn't bound yet — preserve the legacy behaviour.
      const el = this.slideRefs?.toArray()[i]?.nativeElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const vh = stage.clientHeight || window.innerHeight;

    // v1.65i3 — fade-out + instant-jump handoff for forward
    // transitions. Started as a slide-1 → 2 special-case after the
    // smooth scroll-snap was leaving a pink-rolling artifact mid-
    // transit on iOS + Chrome.
    // v1.65i8 — generalized to ALL forward transitions (1→2, 2→3,
    // 3→4). The leaving slide's orbs / grain / inner are stripped
    // from the DOM via *ngIf bindings on exitingFromSlide, then we
    // jump to the destination using behavior:'instant' (which
    // bypasses the .bp-welcome-stage `scroll-behavior: smooth`
    // CSS). The destination slide's .in-view fade-up reveals its
    // content normally.
    // Backward navigation (prev / scrolling up) keeps the smooth
    // scroll — those transitions weren't reported as having the
    // artifact.
    if (i > this.step) {
      // v1.65j3 — slide 1 → 2 gets a credits-roll exit. The
      // inner of slide-1 lifts up off the top of the viewport
      // (CSS animation, see .bp-slide-1-inner.bp-credits-exit),
      // and only after the animation completes do we strip the
      // bg/grain via the *ngIf and jump to slide 2. As soon as
      // the jump lands we force-trigger .in-view on slide 2 so
      // its headline starts rising from below without the usual
      // 450ms settle delay — that delay would otherwise leave a
      // visible bg-only beat between credits ending and rising,
      // breaking the continuous feel. Other forward transitions
      // (2→3, 3→4) stay snappy on the original fast path.
      // v1.65j5 — duration tightened 1500ms -> 1000ms (matches
      // the CSS animation durations) per client review feedback. */
      if (this.step === 0 && i === 1 && !this.slide1CreditsRolling) {
        // v2.30k/l — leaving slide 1 forward: clear all reverse-nav state
        // so slide 2's orbs are full again and slide 1's bg/orbs are back
        // to normal (not held in a reverse-entry pose).
        this.slide2ReverseRolling = false;
        this.slide2ReverseRolling2 = false;
        this.reverseStage1Done = false;
        const revRefs = this.slideRefs?.toArray() || [];
        revRefs[1]?.nativeElement.classList.remove('bp-reverse-rolling', 'bp-reverse-rolling-2');
        revRefs[0]?.nativeElement.classList.remove('bp-reverse-enter');
        this.slide1CreditsRolling = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.exitingFromSlide = 0;
          this.cdr.markForCheck();
          requestAnimationFrame(() => {
            stage.scrollTo({ top: vh, behavior: 'instant' });
            // Force slide-2's .in-view immediately, bypassing the
            // scroll-handler's 450ms settle delay so the headline
            // rise starts the instant the credits clear the top.
            this.forceInView(1);
            setTimeout(() => {
              this.exitingFromSlide = null;
              this.slide1CreditsRolling = false;
              this.cdr.markForCheck();
            }, 200);
          });
        }, 1000);
        return;
      }
      // v1.65j6 — slide 2 → 3 mirrors the slide 1 → 2 credits-roll.
      // .bp-credits-rolling on slide-2 drives the exit: inner +
      // marquee lift off the top, bg shifts pink -> teal, blue orbs
      // grow. Then exitingFromSlide=1 strips the DOM via *ngIf and
      // we jump to slide 3, force-triggering its .in-view so the
      // producers-container rise plays immediately.
      // v1.65j7 — duration 1000ms -> 1200ms to match the CSS,
      // which was bumped because slide 2 has more elements moving
      // at once and read as quicker than slide 1 at parity timing.
      if (this.step === 1 && i === 2 && !this.slide2CreditsRolling) {
        this.slide2CreditsRolling = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.exitingFromSlide = 1;
          this.cdr.markForCheck();
          requestAnimationFrame(() => {
            stage.scrollTo({ top: 2 * vh, behavior: 'instant' });
            this.forceInView(2);
            setTimeout(() => {
              this.exitingFromSlide = null;
              this.slide2CreditsRolling = false;
              this.cdr.markForCheck();
            }, 200);
          });
        }, 1200);
        return;
      }
      // v1.65j9 — slide 3 → 4 exit. Three lines leave sequentially:
      // headline exits left (t=0), tagline exits left (t=0.3s),
      // body exits right (t=0.6s); each 0.6s. Total 1.2s — JS
      // timer matches so the scroll-jump fires the instant the
      // body clears. No bg shift (slide 3 and 4 share #6391A4
      // teal); no orb-grow (orbs stay put as text leaves).
      // Previous v1.65j8 1.6s timing felt like a pause because
      // the CSS used `forwards` fill-mode, which left the
      // delayed-start columns at their from-pose (off-screen)
      // for the duration of the delay rather than at rest. j9
      // switches to `both` so each element holds its resting
      // position during its stagger delay.
      if (this.step === 2 && i === 3 && !this.slide3CreditsRolling) {
        this.slide3CreditsRolling = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.exitingFromSlide = 2;
          this.cdr.markForCheck();
          requestAnimationFrame(() => {
            stage.scrollTo({ top: 3 * vh, behavior: 'instant' });
            this.forceInView(3);
            setTimeout(() => {
              this.exitingFromSlide = null;
              this.slide3CreditsRolling = false;
              this.cdr.markForCheck();
            }, 200);
            // v2 fix: slide 4 is the only slide with no *ngIf remount, so if
            // the 450ms scroll-settle computes a transient index it can steal
            // .in-view off the final slide and the orbs never emerge. Re-assert
            // AFTER the settle window — guarded so it's a no-op (no double-play)
            // when in-view already stuck.
            setTimeout(() => {
              const el = this.slideRefs?.toArray()[3]?.nativeElement as HTMLElement | undefined;
              if (el && !el.classList.contains('in-view')) this.forceInView(3);
            }, 550);
          });
        }, 1200);
        return;
      }
      this.exitingFromSlide = this.step;
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        stage.scrollTo({ top: i * vh, behavior: 'instant' });
        setTimeout(() => {
          this.exitingFromSlide = null;
          this.cdr.markForCheck();
        }, 200);
      });
      return;
    }

    stage.scrollTo({ top: i * vh, behavior: 'smooth' });
  }

  /** v1.65j3 — manually move .in-view to slide index `i`, bypassing
      the scroll-handler's 450ms settle delay. Used by the slide-1
      credits-roll exit so slide-2's entry animation fires the
      instant the scroll-jump lands — keeping the credits-roll
      continuity. Mirrors the remove → reflow → add cycle in
      setCurrentInView (so the animation REPLAYS, not just sticks),
      and updates lastSettledIdx so the settle timer no-ops when it
      fires 450ms later. */
  private forceInView(i: number) {
    const refs = this.slideRefs?.toArray() || [];
    refs.forEach((ref, idx) => {
      const el = ref.nativeElement as HTMLElement;
      if (idx === i) {
        el.classList.remove('in-view');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetWidth;  // force reflow so the animation declaration is fresh
        el.classList.add('in-view');
      } else {
        el.classList.remove('in-view');
      }
    });
    this.lastSettledIdx = i;
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

  // ── Scroll-track click ────────────────────────────────────────
  // v1.65gZ25 — clicking the right-edge track above the pill goes
  // to the previous slide; clicking below the pill advances to the
  // next. Pill itself has pointer-events: none so the track is
  // always the click target.
  onScrollTrackClick(e: MouseEvent) {
    const pill = this.scrollPillRef?.nativeElement;
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    const pillCentreY = rect.top + rect.height / 2;
    if (e.clientY < pillCentreY) {
      this.prev();
    } else {
      this.next();
    }
  }

  /** v1.65gZ29 — reset the Turnstile widget so the user gets a
      fresh token after a submit error (tokens are single-use). */
  private resetTurnstile() {
    const w = window as any;
    this.turnstileToken = null;
    if (w.turnstile && this.turnstileWidgetId) {
      try { w.turnstile.reset(this.turnstileWidgetId); } catch { /* ignore */ }
    }
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
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())
        // v1.65gZ29 — require a Turnstile token before APPLY enables.
        // Managed mode usually completes automatically; on suspicious
        // traffic the user gets a checkbox to click.
        && !!this.turnstileToken;
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
      role:    null,
      // v1.65gZ29 — Cloudflare Turnstile token; server verifies via
      // siteverify. Tokens are single-use, so we let Cloudflare
      // re-issue one if the user re-submits after an error (the
      // widget auto-resets on submit failure).
      turnstileToken: this.turnstileToken
    };
    this.http.post<{ success: boolean; alreadyRegistered?: boolean }>(
      `${this.apiUrl}/guestlist/signup`, body
    ).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        // v1.65gZ28 — surface real failures instead of showing a fake
        // success state. The previous "show success anyway" path masked
        // CORS / 500 / network errors and meant users (and us) had no
        // signal that their signup hadn't landed. Now every non-200
        // shows a user-readable message and is logged with full
        // diagnostic context to the console.
        this.submitting = false;
        console.error('[welcome] Signup request failed', {
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          error: err.error,
          message: err.message
        });
        // v1.65gZ29 — Turnstile tokens are single-use. On any error,
        // reset the widget so the user gets a fresh token before
        // their next submit attempt.
        this.resetTurnstile();
        if (err.status === 429) {
          this.errorMessage = 'Slow down — too many signups from this connection. Try again in a minute.';
        } else if (err.status === 400 && err.error?.error) {
          this.errorMessage = err.error.error;
        } else if (err.status === 0) {
          this.errorMessage = "Couldn't reach the server. Check your connection and try again.";
        } else if (err.status >= 500) {
          this.errorMessage = `Server hiccup (HTTP ${err.status}). Please try again in a moment.`;
        } else {
          this.errorMessage = `Something went wrong (HTTP ${err.status || '?'}). Please try again.`;
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
