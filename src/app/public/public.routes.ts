import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
        title: 'Historic Auto — Espace exposant',
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./pages/contact/contact.component').then((m) => m.ContactComponent),
        title: 'Nous contacter',
      },
    ],
  },
];
