import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

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
  private authService = inject(AuthService);

  // ── Form state (Signals) ──────────────────────────
  email           = signal('');
  password        = signal('');
  passwordConfirm = signal('');

  // ── UI state ──────────────────────────────────────
  loading  = this.authService.isLoading;
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

    this.apiErrors.set([]);

    this.authService.register({
      email: this.email().trim(),
      password: this.password(),
      firstName: '', // Added to match RegisterRequest interface
    }).subscribe({
      next: () => {
        this.success.set(true);
      },
      error: (err) => {
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
