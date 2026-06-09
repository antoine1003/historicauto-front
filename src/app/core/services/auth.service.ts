import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { AuthUser, JwtResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly TOKEN_KEY = 'jwt_token';

  // -- State --
  private readonly _currentUser = signal<AuthUser | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly isLoading = signal(false);

  constructor() {
    this.checkInitialAuth();
  }

  login(credentials: LoginRequest, rememberMe: boolean = false): Observable<JwtResponse> {
    this.isLoading.set(true);
    return this.http.post<JwtResponse>(`${environment.apiUrl}/login_check`, {
      username: credentials.email,
      password: credentials.password
    }).pipe(
      tap(response => {
        this.setToken(response.token, rememberMe);
        this.fetchCurrentUser().subscribe();
      }),
      tap(() => this.isLoading.set(false)),
      catchError(error => {
        this.isLoading.set(false);
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
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private checkInitialAuth(): void {
    const token = this.getToken();
    if (token) {
      this.fetchCurrentUser().subscribe();
    }
  }

  private fetchCurrentUser(): Observable<AuthUser | null> {
    // Assuming there's an endpoint to get the current user profile
    return this.http.get<AuthUser>(`${environment.apiUrl}/me`).pipe(
      tap(user => this._currentUser.set(user)),
      catchError(() => {
        this.logout();
        return of(null);
      })
    );
  }

  private setToken(token: string, rememberMe: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
  }
}
