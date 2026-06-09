import { Routes } from '@angular/router';
import { AUTH_ROUTES } from '@app/core/core.route';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  ...AUTH_ROUTES,
  {
    path: 'dashboard',
    loadComponent: () => import('./app').then(m => m.App), // Placeholder
    canActivate: [authGuard],
  }
];
