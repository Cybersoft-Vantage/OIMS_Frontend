import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface OimsUserSession {
  username?: string;
  role?: string;
  email?: string;
  full_name?: string;
  profile_image?: string | null;
}

export interface OimsAuthResponse extends OimsUserSession {
  access_token?: string | null;
  token_type?: string | null;
  verification_required?: boolean;
  verification_message?: string | null;
  verification_identifier?: string | null;
  retry_after_seconds?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private base = environment.apiUrl.replace(/\/+$/, '');
  currentUser: OimsUserSession = {};

  private get hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private persistSession(res: OimsAuthResponse, fallbackUsername: string) {
    if (res?.access_token && this.hasLocalStorage) {
      localStorage.setItem('oims_token', res.access_token);
      localStorage.setItem('oims_username', res.username || fallbackUsername);
      if (res.role) {
        localStorage.setItem('oims_role', res.role);
      }
    }
    this.currentUser = {
      username: res.username || fallbackUsername,
      role: res.role || '',
      email: res.email || '',
      full_name: res.full_name || '',
      profile_image: res.profile_image || null,
    };
  }

  login(identifier: string, password: string) {
    return this.http.post<OimsAuthResponse>(`${this.base}/auth/token`, { identifier, password }).pipe(
      map(res => {
        this.persistSession(res, identifier);
        return res;
      })
    );
  }

  verifyEmail(identifier: string, otp: string) {
    return this.http.post<OimsAuthResponse>(`${this.base}/auth/verify-email`, { identifier, otp }).pipe(
      map(res => {
        this.persistSession(res, identifier);
        return res;
      })
    );
  }

  resendOtp(identifier: string) {
    return this.http.post<{ message?: string; retry_after_seconds?: number }>(`${this.base}/auth/resend-otp`, { identifier });
  }

  loadCurrentUser() {
    if (!this.token) {
      return of(null);
    }
    return this.http.get<any>(`${this.base}/auth/me`).pipe(
      map(res => {
        if (res) {
          this.currentUser = {
            username: res.username,
            role: res.role,
            email: res.email,
            full_name: res.full_name,
            profile_image: res.profile_image || res.employee?.ProfileImage || null,
          };
        }
        return res;
      })
    );
  }

  logout() {
    if (this.hasLocalStorage) {
      localStorage.removeItem('oims_token');
      localStorage.removeItem('oims_username');
      localStorage.removeItem('oims_role');
    }
    this.currentUser = {};
    this.router.navigate(['/login']);
  }

  get username() {
    return this.currentUser.username || (this.hasLocalStorage ? localStorage.getItem('oims_username') || '' : '');
  }

  get token() {
    return this.hasLocalStorage ? localStorage.getItem('oims_token') : null;
  }

  get role() {
    return this.currentUser.role || (this.hasLocalStorage ? localStorage.getItem('oims_role') || '' : '');
  }

  get fullName() {
    return this.currentUser.full_name || '';
  }

  get profileImage() {
    return this.currentUser.profile_image || null;
  }

  get isAuthenticated() {
    return !!this.token;
  }
}
