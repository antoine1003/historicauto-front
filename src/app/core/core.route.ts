import { Routes } from '@angular/router';
import { RegisterComponent } from '@app/core/components/register/register.component';
import { LoginComponent } from '@app/core/components/login/login.component';
import { ResetPasswordComponent } from '@app/core/components/reset-password/reset-password.component';
import { guestGuard } from './guards/auth.guard';
import { AuthLayoutComponent } from '@app/core/components/auth-layout/auth-layout.component';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'register',
        component: RegisterComponent,
        title: 'Créer un compte',
        canActivate: [guestGuard],
      },
      {
        path: 'login',
        component: LoginComponent,
        title: 'Connexion',
        canActivate: [guestGuard],
      },
      {
        path: 'forgot-password',
        component: ResetPasswordComponent,
        title: 'Mot de passe oublié',
        canActivate: [guestGuard],
      },
      {
        path: 'reset-password/:token',
        component: ResetPasswordComponent,
        title: 'Réinitialiser le mot de passe',
        canActivate: [guestGuard],
      },
    ]
  }
];
