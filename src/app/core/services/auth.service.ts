import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, tap } from 'rxjs';
import { AuthUser, JwtResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from '@app/core/services/token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);

  // -- State --
  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _isInitialized = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly isLoading = signal(false);

  constructor() {
    this.checkInitialAuth();
  }

  login(credentials: LoginRequest, rememberMe: boolean = false): Observable<AuthUser | null> {
    this.isLoading.set(true);
    return this.http.post<JwtResponse>(`${environment.apiUrl}/login_check`, {
      username: credentials.email,
      password: credentials.password
    }).pipe(
      tap(response => {
        this.setToken(response.token, rememberMe);
        this._isInitialized.set(false); // Reset initialization so guards wait for profile
      }),
      switchMap(() => this.fetchCurrentUser()),
      tap(user => {
        this.isLoading.set(false);
        this._isInitialized.set(true);
        if (!user) {
          throw new Error('Impossible de récupérer les informations utilisateur');
        }
      }),
      catchError(error => {
        this.isLoading.set(false);
        this._isInitialized.set(true);
        throw error;
      })
    );
  }

  register(data: RegisterRequest): Observable<any> {
    this.isLoading.set(true);
    return this.http.post<any>(`${environment.apiUrl}/register`, data).pipe(
      tap(() => this.isLoading.set(false)),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  logout(): void {
    this.tokenStorage.clearToken();
    this._currentUser.set(null);
    this._isInitialized.set(true);
    void this.router.navigate(['/login']);
  }

  private checkInitialAuth(): void {
    const token = this.getToken();
    console.log('Token in checkInitialAuth: ', token)
    if (token) {
      this.isLoading.set(true);
      this.fetchCurrentUser().subscribe({
        next: () => {
          this.isLoading.set(false);
          this._isInitialized.set(true);
        },
        error: () => {
          this.isLoading.set(false);
          this._isInitialized.set(true);
          this.logout();
        }
      });
    } else {
      this._isInitialized.set(true);
    }
  }

  private fetchCurrentUser(): Observable<AuthUser | null> {
    // Assuming there's an endpoint to get the current user profile
    return this.http.get<AuthUser>(`${environment.apiUrl}/me`).pipe(
      tap(user => {
        if (user) {
          this._currentUser.set(user);
        }
      }),
      catchError((err, caught) => {
        console.error('Error fetching current user:', err);
        return of(null);
      })
    );
  }

  private setToken(token: string, rememberMe: boolean): void {
    this.tokenStorage.setToken(token, rememberMe);
  }

  getToken(): string | null {
    return this.tokenStorage.getToken();
  }
}
