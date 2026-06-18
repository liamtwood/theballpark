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
  templateUrl: "./welcome.component.html",
  styleUrl: "./welcome.component.css",
})
export class WelcomeComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly TOTAL_STEPS = TOTAL_STEPS;

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
  /** v2.30q — handle to the reverse 2→1 sequence (a closure defined in
      ngAfterViewInit, where the stage/scroll state lives). Lets the back
      chevron's goBack() trigger the same animation the wheel/scroll do. */
  private reverseFn?: (fromStep: number) => void;
  /** v1.65i3 — slide exit transition state.
      v1.65i8 — generalized from slide-1-only to ALL forward
      transitions (1→2, 2→3, 3→4). Holds the index of the slide
      currently being exited; its orbs / grain / inner content are
      removed from the DOM via *ngIf, the page jumps instantly to
      the next slide, then the destination slide's .in-view fade-up
      animations reveal it. null = no exit in progress. */
  exitingFromSlide: number | null = null;
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

  /** v1.65gZ29 — Cloudflare Turnstile token. Captured on widget
      success callback, sent with the signup payload, cleared on
      expiry / error / submit-completion. canSubmit() now also
      requires a non-empty token. */
  turnstileToken: string | null = null;
  private turnstileWidgetId: string | null = null;
  /** v2.31b — set when submit() is waiting on a fresh Turnstile token
      (execute-on-submit). The render callback fires the POST when the token
      lands, and a timeout fails gracefully if it never does. */
  pendingSubmit = false;

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
      if (idx === 1 && this.slide2ReverseRolling) {
        this.slide2ReverseRolling = false;
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
    // v2.30s — generalized to any one-step-back transition (2→1 or 3→2).
    // fromStep = the slide we're leaving (1 = slide 2, 2 = slide 3). The
    // leaving slide's orbs shrink + text crawls off; we cut to fromStep-1
    // whose per-slide .bp-reverse-enter CSS runs the cover→flip→reveal mask.
    const startReverse = (fromStep: number) => {
      if (this.slide2ReverseRolling) return;          // a reverse is already running
      if (fromStep < 1 || fromStep > 3) return;       // 2→1, 3→2 (masked) and 4→3 (no mask)
      const vh = stage.clientHeight || window.innerHeight;
      const destStep = fromStep - 1;
      // v2.31b — reduced motion: skip the timed mask sequence entirely; just
      // jump to the destination and mark it in-view (the .in-view animations
      // are themselves collapsed to ~instant by the reduced-motion CSS).
      if (this.reducedMotion()) {
        this.step = destStep;
        stage.scrollTo({ top: destStep * vh, behavior: 'instant' });
        this.forceInView(destStep);
        setProgress();
        lastRevScrollTop = destStep * vh;
        this.cdr.markForCheck();
        return;
      }
      this.slide2ReverseRolling = true;
      clearTimeout(settleTimer);
      // behavior:'instant' is REQUIRED — the stage has scroll-behavior:smooth
      // in CSS, so a plain scrollTop assignment would animate a smooth scroll
      // and sweep the inter-slide seam across as a coloured "line". Forward
      // nav uses the same instant trick. (Liam's pink-line bug.)
      stage.scrollTo({ top: fromStep * vh, behavior: 'instant' });  // pin the leaving slide
      stage.style.overflowY = 'hidden';               // lock user scroll for the duration
      const refs = this.slideRefs?.toArray() || [];
      const leavingEl = refs[fromStep]?.nativeElement, destEl = refs[destStep]?.nativeElement;
      // v2.30u — clear any stale .bp-reverse-enter left on a slide from a
      // PRIOR reverse so (a) the destination's mask replays fresh and (b) it
      // can't block the leaving slide's orb-shrink / bg. Safe: the leaving
      // slide gets bp-reverse-rolling in the same synchronous tick (no paint
      // in between, so no fade-restart flash); other slides are off-screen.
      refs.forEach(r => r?.nativeElement.classList.remove('bp-reverse-enter'));
      // Phase 1 (0–0.8s): leaving slide's orbs shrink → uniform bg.
      leavingEl?.classList.add('bp-reverse-rolling');
      // Phase 2 (0.8s, 1.7s long): leaving slide's text crawls fully off.
      setTimeout(() => { leavingEl?.classList.add('bp-reverse-rolling-2'); }, 800);
      // Phase 3 (~2.5s, after the leaving slide clears): instant cut to the
      // destination + its mask sequence (orbs cover → bg flips → orbs shrink).
      setTimeout(() => {
        this.step = destStep;
        this.cdr.markForCheck();
        // 4→3 (fromStep 3) shares the teal bg, so NO mask — slide 3 just
        // enters normally. Only the colour-changing boundaries (2→1, 3→2)
        // get the cover→flip→reveal mask via .bp-reverse-enter.
        if (fromStep !== 3) destEl?.classList.add('bp-reverse-enter');
        stage.scrollTo({ top: destStep * vh, behavior: 'instant' });  // instant cut — no seam sweep
        this.forceInView(destStep);
        // onScroll was short-circuited for the whole reverse, so the
        // scroll-progress var (and the position pill it drives) is frozen.
        // Recompute it now that we've landed, and reset the up/down tracker.
        lastRevScrollTop = destStep * vh;
        setProgress();
        setTimeout(() => {
          leavingEl?.classList.remove('bp-reverse-rolling', 'bp-reverse-rolling-2');
          // v2.30u — do NOT remove destEl's .bp-reverse-enter here. Its
          // forwards-fill holds the rested state (r=280, opacity 1). Removing
          // it hands the orb's `animation` back to the slide's .in-view fade-in,
          // which then RESTARTS from opacity 0 → the flash. It's cleared at the
          // start of the next reverse and on forward nav off the slide instead.
          stage.style.overflowY = 'scroll';               // restore user scroll
          this.slide2ReverseRolling = false;
        }, 1700);
      }, 2500);
    };
    this.reverseFn = startReverse;   // v2.30q/s — let the back chevron trigger it

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
      if (this.step >= 1 && this.step <= 3 && stage.scrollTop < prev
          && prev >= this.step * vh - 8 && stage.scrollTop < this.step * vh - 8) {
        startReverse(this.step);
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
      // v2.30v — the deck owns ALL wheel nav: native free-snapping doesn't
      // play our crafted transitions, so every wheel gesture is converted to
      // the same next()/goBack() the chevrons use (which run the crafted
      // forward credits-roll / reverse mask). next()/goBack() self-guard via
      // navBusy(), so extra events during a transition are no-ops.
      e.preventDefault();
      if (e.deltaY < 0) this.goBack();
      else this.next();
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
          // v2.31b — if a submit is waiting on a fresh token (execute-on-submit
          // for a long-idle form), fire the POST now that we have one.
          if (this.pendingSubmit) {
            this.pendingSubmit = false;
            this.doPost();
          }
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
    // v2.31b — tear down the Turnstile widget + the global onload hook so an
    // SPA re-entry doesn't orphan the iframe or leave a stale closure pointing
    // at this destroyed component's ViewChild.
    const w = window as any;
    if (w.turnstile && this.turnstileWidgetId) {
      try { w.turnstile.remove(this.turnstileWidgetId); } catch { /* ignore */ }
    }
    try { delete w.__bpTurnstileOnLoad; } catch { /* ignore */ }
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
  /** v2.31b — normalize a content key's literal "\n" (longtext seed) into real
      newlines, for `white-space: pre-line` rendering via interpolation. Replaces
      the old multiline()+[innerHTML] sink: interpolation auto-escapes, so
      admin-edited marketing copy can never inject HTML. */
  nlText(key: string): string {
    return (this.text(key) || '').replace(/\\n/g, '\n');
  }

  get marqueeCategories(): string[] {
    const cats = this.list('suppliers.categories');
    if (!cats.length) return [];
    // 3× repeat for seamless scroll
    return [...cats, ...cats, ...cats];
  }


  // ── Navigation ────────────────────────────────────────────────
  // v1.65gL — buttons + keyboard arrows now scroll the target slide
  // into view; the IntersectionObserver picks it up and updates step
  // + adds .in-view (which triggers the per-slide animations).
  /** v2.30v — true while ANY crafted transition is mid-flight, so every
      nav entry point (wheel / chevron / keyboard / track-click) no-ops
      instead of stacking a second transition on top. */
  private navBusy(): boolean {
    return this.slide1CreditsRolling || this.slide2CreditsRolling || this.slide3CreditsRolling
        || this.slide2ReverseRolling || this.ballparkFading || this.exitingFromSlide !== null;
  }
  /** v2.31b — honour prefers-reduced-motion (WCAG 2.3.3). Checked live so a
      mid-session OS setting change is respected. When true, the forward
      credits-roll and reverse mask short-circuit to an instant slide jump. */
  private reducedMotion(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  next()       { if (this.navBusy()) return; this.scrollToSlide(Math.min(this.step + 1, TOTAL_STEPS - 1)); }
  prev()       { this.scrollToSlide(Math.max(this.step - 1, 0));               }
  /** v2.30v — back nav. Every populated boundary has a crafted reverse now
      (2→1 + 3→2 masked, 4→3 same-bg), so route steps 1–3 through it. */
  goBack()     { if (this.navBusy()) return; if (this.step >= 1 && this.step <= 3 && this.reverseFn) this.reverseFn(this.step); else this.prev(); }
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

    // v2.31b — reduced motion: collapse every forward credits-roll (and any
    // plain nav) to an instant jump + in-view, skipping the timed sequences.
    if (this.reducedMotion()) {
      this.step = i;
      stage.scrollTo({ top: i * vh, behavior: 'instant' });
      this.forceInView(i);
      this.cdr.markForCheck();
      return;
    }

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
        // v2.30k — leaving slide 1 forward: clear reverse-nav state so
        // slide 2's orbs are full again and slide 1's bg/orbs are back to
        // normal (not held in a reverse-entry pose).
        this.slide2ReverseRolling = false;
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
        // v2.30u — leaving slide 2 forward: clear a leftover .bp-reverse-enter
        // (from a prior 3→2) so it doesn't block the bg pink→teal bridge.
        this.slideRefs?.toArray()[1]?.nativeElement.classList.remove('bp-reverse-enter');
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
    if (this.submitted) return;
    const tag = (e.target as HTMLElement)?.tagName;
    const isFormField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft' && !isFormField) this.goBack();
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
      this.goBack();
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


  // ── Submit ────────────────────────────────────────────────────
  canSubmit(): boolean {
    // v2.31b — the invisible Turnstile token is NO LONGER a gate on the
    // button. It mints in the background; if it's missing/expired at submit
    // time, submit() fetches a fresh one first (execute-on-submit). Gating
    // the button on an invisible token left long-idle forms un-submittable.
    return this.form.firstName.trim().length > 0
        && this.form.surname.trim().length > 0
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim());
  }

  submit() {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    // Fast path — a fresh background token is already in hand → post now.
    if (this.turnstileToken) { this.doPost(); return; }

    // v2.31b — execute-on-submit. No token (never minted, or expired on a
    // long-idle form): re-run the (invisible) widget to mint a fresh one,
    // then post from its success callback. reset() reliably re-fires the
    // callback for an interaction-only widget; a "Verifying…" button state
    // covers the short wait, and a timeout fails gracefully if it never lands.
    const w = window as any;
    if (w.turnstile && this.turnstileWidgetId) {
      this.pendingSubmit = true;
      this.cdr.markForCheck();
      try {
        w.turnstile.reset(this.turnstileWidgetId);
      } catch {
        this.pendingSubmit = false;
        this.doPost();            // couldn't re-run — let the server decide
        return;
      }
      setTimeout(() => {
        if (this.pendingSubmit) {
          this.pendingSubmit = false;
          this.submitting = false;
          this.errorMessage = 'Verification timed out — please try again.';
          this.cdr.markForCheck();
        }
      }, 12000);
    } else {
      // Turnstile unavailable (script blocked / dev) — attempt the post; the
      // server verifies and rejects if its secret is set + token missing.
      this.doPost();
    }
  }

  /** v2.31b — the actual signup POST, called once a Turnstile token is in
      hand (immediately on the fast path, or from the render callback after
      an execute-on-submit re-mint). */
  private doPost() {
    const fullName = `${this.form.firstName.trim()} ${this.form.surname.trim()}`.trim();
    const body = {
      name:    fullName,
      email:   this.form.email.trim(),
      company: null,
      role:    null,
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
        // v1.65gZ28 — surface real failures instead of a fake success state,
        // with full diagnostic context to the console.
        this.submitting = false;
        this.pendingSubmit = false;
        console.error('[welcome] Signup request failed', {
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          error: err.error,
          message: err.message
        });
        // Turnstile tokens are single-use — reset for a fresh one next try.
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
