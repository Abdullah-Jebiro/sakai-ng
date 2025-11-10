import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface UserInfo {
  email: string;
  isEmailConfirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private readonly API_URL = 'https://localhost:5013/api';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_EMAIL_KEY = 'user_email';
  
  isAuthenticated = signal<boolean>(this.hasToken());
  currentUserEmail = signal<string | null>(this.getUserEmail());

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  private getUserEmail(): string | null {
    return localStorage.getItem(this.USER_EMAIL_KEY);
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => this.handleAuthResponse(response, credentials.email)),
      catchError(err => {
        console.error('Login failed', err);
        throw err;
      })
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/register`, data).pipe(
      tap(() => {
        // After registration, auto-login
        this.login({ email: data.email, password: data.password }).subscribe();
      }),
      catchError(err => {
        console.error('Registration failed', err);
        throw err;
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_EMAIL_KEY);
    this.isAuthenticated.set(false);
    this.currentUserEmail.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  refreshToken(): Observable<AuthResponse> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      return of({} as AuthResponse);
    }

    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, { refreshToken: refresh }).pipe(
      tap(response => {
        const email = this.getUserEmail();
        if (email) {
          this.handleAuthResponse(response, email);
        }
      }),
      catchError(() => {
        this.logout();
        return of({} as AuthResponse);
      })
    );
  }

  private handleAuthResponse(response: AuthResponse, email: string): void {
    localStorage.setItem(this.TOKEN_KEY, response.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(this.USER_EMAIL_KEY, email);
    this.isAuthenticated.set(true);
    this.currentUserEmail.set(email);
  }

  getUserInfo(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.API_URL}/manage/info`);
  }
}
