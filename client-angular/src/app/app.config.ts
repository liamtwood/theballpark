import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICON_REGISTRY } from './core/icons';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider(ICON_REGISTRY)
    }
  ]
};
