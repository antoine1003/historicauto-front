import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { HistoricAutoPreset } from '@app/core/styles/historic-auto.preset';

// Format français pour les pipes number / date : « 1 117,00 € » et non « 1,117 € ».
registerLocaleData(localeFr, 'fr-FR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(
      withXhr(),
      withInterceptors([authInterceptor])
    ),
    providePrimeNG({
      theme: {
        preset: HistoricAutoPreset,
        options: {
          darkModeSelector: false, // ← classe sur <html> au lieu de @media
        },
      },
      license: 'eyJpZCI6IjAwNGU4YWZiLThmY2EtNGZjOC04ODcyLTZlZDdmNTg1MGU1OCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTQ0OTU4MjQsImV4cCI6MTgyNjAzMTgyNH0.paNaSkQ_ZaX5AaYLzuHxHVTKYY7YYEh-xgAXQpQWIbSIlk7jSTjsEEnCNYD5wqtRgQe--WyTvB3haSMPqvVlAg'
    }),
    MessageService,
    { provide: LOCALE_ID, useValue: 'fr-FR' },
  ]
};
