import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Runtime config is loaded during bootstrap via provideAppInitializer
// (app.config.ts) — the app never renders before the API URL is known.
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
