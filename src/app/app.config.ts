import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { HistoricAutoPreset } from '@app/core/styles/historic-auto.preset';

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
  ]
};
