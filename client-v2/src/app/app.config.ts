import {
  ApplicationConfig,
  inject,
  importProvidersFrom,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import {
  LucideAngularModule,
  ArrowLeft,
  Check,
  ChevronLeft,
  CircleUser,
  FolderOpen,
  FolderPlus,
  Inbox,
  Rocket,
  Settings,
  SquarePen,
  Tags,
  FileText,
  Zap,
  CircleCheck,
  Package,
  Building2,
  Store,
  Trash2,
  X,
} from 'lucide-angular';

import { routes } from './app.routes';
import { RuntimeConfigService } from './core/runtime-config.service';
import { BrandConfigService } from './core/brand-config.service';
import { AuthService } from './core/auth/auth.service';
import { PageConfigService } from './core/config/page-config.service';

// Bridge the Ballpark brand into PrimeNG's Aura preset. PrimeNG styled mode
// injects its design tokens at runtime, so a CSS `--p-*` override in styles.css
// gets clobbered — the supported bridge is the preset itself. primary.500
// matches `--theme-accent` (#d63384) in styles.css; keep the two in sync.
const BallparkPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdeef5',
      100: '#fbd9e9',
      200: '#f5add0',
      300: '#ee82b7',
      400: '#e2589d',
      500: '#d63384',
      600: '#b82a70',
      700: '#97215c',
      800: '#771a49',
      900: '#5b1438',
      950: '#3a0c24',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // PrimeNG styled-mode + Aura design-token preset. The Ballpark brand is
    // bridged into Aura's tokens once, in styles.css — never per component.
    providePrimeNG({
      theme: {
        preset: BallparkPreset,
        options: { darkModeSelector: false },
      },
    }),
    // Lucide: register only the icons used (WORKING_STANDARDS). Registered at
    // the app level because `.pick()` returns a ModuleWithProviders, which is
    // valid via importProvidersFrom but not inside a standalone component's
    // `imports`. Components import the bare module for the <lucide-icon> directive.
    importProvidersFrom(
      LucideAngularModule.pick({
        // Shell + sandbox
        ChevronLeft, Rocket, Trash2,
        // pV2-04b home: cog, drawer close, launcher tiles, Back link
        Settings, X, FolderPlus, FolderOpen, Inbox, Store, CircleUser, ArrowLeft,
        // Profile: section edit lifecycle
        SquarePen, Check,
        // v2.13a supplier sub-hubs: projects-hub stages + storefront trio
        FileText, Zap, CircleCheck, Package, Building2,
        // pV2-MARKET-00 — admin Categories tile
        Tags,
      })
    ),
    // Load /runtime-config.json BEFORE the app renders, so no feature ever sees
    // an undefined API URL (self-host: API endpoint is editable post-build).
    // Then load brand config (pV2-01e) — the --bp-* tokens land on :root
    // before the first paint, so there is no FOUC / font flash. Brand load
    // never throws (cosmetic — API down just keeps the styles.css fallbacks).
    // Then hydrate the auth session from the bp_session cookie (pV2-02), so
    // the auth guard sees a settled signal on the very first navigation.
    // Then the page-settings config (pV2-04b) — needs activeOrgType from the
    // session; skips itself for signed-out/orgless users.
    provideAppInitializer(async () => {
      const rc = inject(RuntimeConfigService);
      const brand = inject(BrandConfigService);
      const auth = inject(AuthService);
      const pageConfig = inject(PageConfigService);
      await rc.load();
      // Brand and session are independent — run them CONCURRENTLY (each leg
      // is a remote-DB roundtrip; serial chaining was ~40% of boot time,
      // Liam's "performance on initial login is bad", 2026-06-12). Only
      // page-config truly depends on the session (activeOrgType).
      await Promise.all([brand.load(), auth.loadSession()]);
      await pageConfig.load();
    }),
  ],
};
