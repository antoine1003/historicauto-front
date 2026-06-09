import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);


  title = signal<string>('Bonjour');

  // ── Form state ────────────────────────────────────
  email      = signal('');
  password   = signal('');
  rememberMe = signal(false);

  // ── UI state ──────────────────────────────────────
  loading       = this.authService.isLoading;
  apiError      = signal<string | null>(null);
  statusSuccess = signal<string | null>(null);
  statusError   = signal<string | null>(null);

  // ── Inline validation ─────────────────────────────
  emailTouched = signal(false);
  passTouched  = signal(false);

  emailError = computed(() => {
    if (!this.emailTouched()) return null;
    if (!this.email().trim()) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email())) return 'Email invalide';
    return null;
  });

  passError = computed(() => {
    if (!this.passTouched()) return null;
    if (!this.password()) return 'Le mot de passe est requis';
    return null;
  });

  isFormValid = computed(() =>
    !this.emailError() &&
    !this.passError() &&
    !!this.email() &&
    !!this.password()
  );

  // ── Query params ──────────────────────────────────
  private readonly STATUS_MESSAGES: Record<string, string> = {
    email_confirmed: 'Votre adresse email a bien été confirmée. Vous pouvez vous connecter.',
    token_invalid:   'Ce lien de confirmation est invalide ou a expiré. Veuillez vous réinscrire.',
  };

  ngOnInit(): void {
    const status  = this.route.snapshot.queryParamMap.get('status');
    const message = this.route.snapshot.queryParamMap.get('message');

    if (status && message) {
      const text = this.STATUS_MESSAGES[message] ?? null;
      if (status === 'success') this.statusSuccess.set(text);
      if (status === 'error')   this.statusError.set(text);

      // Nettoie l'URL sans recharger la page
      void this.router.navigate([], {
        replaceUrl: true,
        queryParams: {},
      });
    }

    const now   = new Date();
    const hours = now.getHours();
    const mins  = now.getMinutes();

    const isEvening = hours > 18 || (hours === 18 && mins >= 30);

    this.title.set(isEvening ? 'Bonsoir' : 'Bonjour');
  }

  // ── Submit ────────────────────────────────────────
  onSubmit(): void {
    this.emailTouched.set(true);
    this.passTouched.set(true);

    if (!this.isFormValid()) return;

    this.apiError.set(null);

    this.authService
      .login({
        email:    this.email().trim(),
        password: this.password(),
      }, this.rememberMe())
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) {
            const message = err.error?.message || 'Email ou mot de passe incorrect.';
            this.apiError.set(message);
          } else {
            this.apiError.set('Une erreur est survenue. Veuillez réessayer.');
          }
        },
      });
  }
}
