import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Deployed builds set window.CRM_API_URL (see index.html / the Pages workflow);
// local dev falls back to the local FastAPI server.
export const API_URL: string =
  (window as any).CRM_API_URL || 'http://localhost:8000/api';

export interface SessionUser {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'rep' | 'viewer';
  language: string;
  is_owner?: boolean;
}
export interface SessionOrg {
  id: number;
  name: string;
  base_currency: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  user = signal<SessionUser | null>(this.readJson('crm_user'));
  org = signal<SessionOrg | null>(this.readJson('crm_org'));
  orgs = signal<SessionOrg[]>(this.readJson('crm_orgs') || []);

  private readJson(key: string) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return localStorage.getItem('crm_token');
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  get canWrite(): boolean {
    return this.user()?.role !== 'viewer';
  }

  get isAdmin(): boolean {
    return this.user()?.role === 'admin';
  }

  private applySession(res: any): void {
    localStorage.setItem('crm_token', res.access_token);
    localStorage.setItem('crm_user', JSON.stringify(res.user));
    localStorage.setItem('crm_org', JSON.stringify(res.org));
    localStorage.setItem('crm_orgs', JSON.stringify(res.orgs || []));
    this.user.set(res.user);
    this.org.set(res.org);
    this.orgs.set(res.orgs || []);
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<any>(`${API_URL}/auth/login`, { email, password })
    );
    this.applySession(res);
  }

  /** Public SaaS signup: creates a company + its first admin. */
  async register(payload: {
    company_name: string;
    base_currency: string;
    full_name: string;
    email: string;
    password: string;
    language: string;
  }): Promise<void> {
    const res = await firstValueFrom(this.http.post<any>(`${API_URL}/auth/register`, payload));
    this.applySession(res);
  }

  /** Switch the active company; pages reload their data from the new scope. */
  async switchOrg(orgId: number): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<any>(`${API_URL}/auth/switch-org`, { org_id: orgId })
    );
    this.applySession(res);
  }

  /** Create an additional company owned by the current user and switch to it. */
  async createCompany(name: string, baseCurrency: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<any>(`${API_URL}/orgs`, { name, base_currency: baseCurrency })
    );
    this.applySession(res);
  }

  logout(): void {
    ['crm_token', 'crm_user', 'crm_org', 'crm_orgs'].forEach((k) => localStorage.removeItem(k));
    this.user.set(null);
    this.org.set(null);
    this.orgs.set([]);
    this.router.navigate(['/login']);
  }
}
