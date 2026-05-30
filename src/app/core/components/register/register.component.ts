import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

interface RegisterPayload {
  email: string;
  password: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private http   = inject(HttpClient);
  private router = inject(Router);

  // ── Form state (Signals) ──────────────────────────
  email           = signal('');
  password        = signal('');
  passwordConfirm = signal('');

  // ── UI state ──────────────────────────────────────
  loading  = signal(false);
  success  = signal(false);
  apiErrors = signal<string[]>([]);

  // ── Inline validation ─────────────────────────────
  emailTouched    = signal(false);
  passTouched     = signal(false);
  confirmTouched  = signal(false);

  emailError = computed(() => {
    if (!this.emailTouched()) return null;
    const v = this.email().trim();
    if (!v) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email invalide';
    return null;
  });

  passError = computed(() => {
    if (!this.passTouched()) return null;
    if (this.password().length < 8) return 'Minimum 8 caractères';
    return null;
  });

  confirmError = computed(() => {
    if (!this.confirmTouched()) return null;
    if (this.passwordConfirm() !== this.password()) return 'Les mots de passe ne correspondent pas';
    return null;
  });

  isFormValid = computed(() =>
    !this.emailError() &&
    !this.passError() &&
    !this.confirmError() &&
    !!this.email() &&
    !!this.password() &&
    !!this.passwordConfirm()
  );

  // ── Submit ────────────────────────────────────────
  onSubmit(): void {
    // Touch all fields to trigger validation
    this.emailTouched.set(true);
    this.passTouched.set(true);
    this.confirmTouched.set(true);

    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.apiErrors.set([]);

    const payload: RegisterPayload = {
      email: this.email().trim(),
      password: this.password(),
    };

    this.http.post<{ message: string; errors?: string[] }>('/api/register', payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        const body = err.error;
        if (body?.errors) {
          this.apiErrors.set(body.errors);
        } else if (body?.message) {
          this.apiErrors.set([body.message]);
        } else {
          this.apiErrors.set(['Une erreur est survenue. Veuillez réessayer.']);
        }
      },
    });
  }
}
