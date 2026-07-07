import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService, TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TrPipe],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Max<span>Sales</span></div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">📊 {{ 'dashboard' | tr }}</a>
          <a routerLink="/pipeline" routerLinkActive="active">🎯 {{ 'pipeline' | tr }}</a>
          <a routerLink="/accounts" routerLinkActive="active">🏢 {{ 'accounts' | tr }}</a>
          <a routerLink="/contacts" routerLinkActive="active">👤 {{ 'contacts' | tr }}</a>
          <a routerLink="/sales" routerLinkActive="active">💰 {{ 'sales' | tr }}</a>
          <a routerLink="/projects" routerLinkActive="active">🧩 {{ 'projects' | tr }}</a>
          <a routerLink="/activities" routerLinkActive="active">✅ {{ 'activities' | tr }}</a>
          <a routerLink="/reports" routerLinkActive="active">📈 {{ 'reports' | tr }}</a>
          <a routerLink="/settings" routerLinkActive="active">⚙️ {{ 'settings' | tr }}</a>
        </nav>
        <div class="side-foot">
          <div class="who">
            <strong>{{ auth.user()?.full_name }}</strong>
            <span class="muted">{{ auth.org()?.name }}</span>
          </div>
          <button class="btn sm" (click)="auth.logout()">{{ 'logout' | tr }}</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="searchbox">
            <input
              [placeholder]="'search' | tr"
              [(ngModel)]="query"
              (ngModelChange)="query$.next($event)"
              (blur)="hideSoon()"
              (focus)="query && query$.next(query)"
            />
            @if (results) {
              <div class="search-results">
                @if (results.accounts.length) {
                  <div class="group">{{ 'accounts' | tr }}</div>
                  @for (r of results.accounts; track r.id) {
                    <div class="hit" (mousedown)="go('/accounts/' + r.id)">🏢 {{ r.name }} <span class="muted">{{ r.country }}</span></div>
                  }
                }
                @if (results.contacts.length) {
                  <div class="group">{{ 'contacts' | tr }}</div>
                  @for (r of results.contacts; track r.id) {
                    <div class="hit" (mousedown)="go('/accounts/' + r.account_id)">👤 {{ r.name }} <span class="muted">{{ r.email }}</span></div>
                  }
                }
                @if (results.opportunities.length) {
                  <div class="group">{{ 'opportunities' | tr }}</div>
                  @for (r of results.opportunities; track r.id) {
                    <div class="hit" (mousedown)="go('/opportunities/' + r.id)">🎯 {{ r.name }}</div>
                  }
                }
                @if (results.projects.length) {
                  <div class="group">{{ 'projects' | tr }}</div>
                  @for (r of results.projects; track r.id) {
                    <div class="hit" (mousedown)="go('/projects/' + r.id)">🧩 {{ r.name }}</div>
                  }
                }
                @if (!results.accounts.length && !results.contacts.length && !results.opportunities.length && !results.projects.length) {
                  <div class="hit muted">{{ 'no_results' | tr }}</div>
                }
              </div>
            }
          </div>
          <div class="spacer"></div>
          <select class="org-switch" [ngModel]="auth.org()?.id" (ngModelChange)="onOrgChange($event)" title="{{ 'switch_company' | tr }}">
            @for (o of auth.orgs(); track o.id) { <option [ngValue]="o.id">🏢 {{ o.name }}</option> }
            <option [ngValue]="'__new'">＋ {{ 'new_company' | tr }}</option>
          </select>
          <select class="lang" [ngModel]="i18n.lang()" (ngModelChange)="i18n.setLang($event)">
            <option value="en">EN</option>
            <option value="pt">PT</option>
          </select>
        </header>
        <router-outlet />
      </div>

      <div class="toasts">
        @for (t of toast.toasts(); track t.id) {
          <div class="toast {{ t.type }}" (click)="toast.dismiss(t.id)">{{ t.text }}</div>
        }
      </div>

      @if (newCompanyOpen) {
        <div class="modal-backdrop">
          <div class="modal" style="max-width: 420px">
            <h2>{{ 'new_company' | tr }}</h2>
            <label>{{ 'org_name' | tr }} *</label>
            <input [(ngModel)]="newCompanyName" />
            <label>{{ 'base_currency' | tr }}</label>
            <select [(ngModel)]="newCompanyCurrency">
              <option value="USD">USD</option><option value="EUR">EUR</option><option value="AOA">AOA</option>
            </select>
            <div class="modal-actions">
              <button class="btn" (click)="newCompanyOpen = false">{{ 'cancel' | tr }}</button>
              <button class="btn primary" [disabled]="!newCompanyName.trim()" (click)="createCompany()">{{ 'create_company' | tr }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .shell { display: flex; min-height: 100vh; }
      .sidebar {
        width: 218px; background: var(--sidebar); color: var(--sidebar-text);
        display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; flex-shrink: 0;
      }
      .brand { font-size: 20px; font-weight: 800; color: #fff; padding: 20px 18px 14px; }
      .brand span { color: #60a5fa; }
      nav { display: flex; flex-direction: column; padding: 6px 10px; gap: 2px; flex: 1; }
      nav a { color: var(--sidebar-text); padding: 9px 12px; border-radius: 8px; font-weight: 600; font-size: 13.5px; }
      nav a:hover { background: rgba(255, 255, 255, 0.06); text-decoration: none; }
      nav a.active { background: var(--primary); color: #fff; }
      .side-foot { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px; }
      .who { display: flex; flex-direction: column; font-size: 12.5px; color: #e2e8f0; }
      .who .muted { color: #94a3b8; }
      .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .topbar {
        display: flex; align-items: center; gap: 12px; background: var(--panel);
        border-bottom: 1px solid var(--border); padding: 10px 24px; position: sticky; top: 0; z-index: 100;
      }
      .searchbox { position: relative; width: min(440px, 60vw); }
      .search-results {
        position: absolute; top: 40px; left: 0; right: 0; background: #fff; border: 1px solid var(--border);
        border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,0.15); overflow: hidden; max-height: 60vh; overflow-y: auto;
      }
      .group { padding: 8px 12px 2px; font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700; }
      .hit { padding: 8px 12px; cursor: pointer; font-size: 13.5px; display: flex; gap: 8px; align-items: baseline; }
      .hit:hover { background: #f1f5f9; }
      .lang { width: auto; }
      .org-switch { width: auto; max-width: 260px; font-weight: 600; }
      @media (max-width: 860px) {
        .sidebar { width: 64px; }
        .brand { font-size: 13px; padding: 16px 8px; text-align: center; }
        nav a { text-align: center; padding: 9px 4px; overflow: hidden; white-space: nowrap; }
        .side-foot { display: none; }
      }
    `,
  ],
})
export class ShellComponent {
  auth = inject(AuthService);
  i18n = inject(I18nService);
  toast = inject(ToastService);
  private api = inject(ApiService);
  private router = inject(Router);

  query = '';
  query$ = new Subject<string>();
  results: any = null;
  newCompanyOpen = false;
  newCompanyName = '';
  newCompanyCurrency = 'USD';

  constructor() {
    this.query$.pipe(debounceTime(250)).subscribe(async (q) => {
      if (!q || q.trim().length < 2) {
        this.results = null;
        return;
      }
      try {
        this.results = await this.api.get('search', { q });
      } catch {
        this.results = null;
      }
    });
  }

  go(path: string): void {
    this.results = null;
    this.query = '';
    this.router.navigateByUrl(path);
  }

  hideSoon(): void {
    setTimeout(() => (this.results = null), 200);
  }

  async onOrgChange(value: number | '__new'): Promise<void> {
    if (value === '__new') {
      this.newCompanyName = '';
      this.newCompanyOpen = true;
      return;
    }
    if (value === this.auth.org()?.id) return;
    try {
      await this.auth.switchOrg(value);
      // full reload so every page refetches under the new company scope
      window.location.assign('/dashboard');
    } catch (e) {
      this.toast.error(e);
    }
  }

  async createCompany(): Promise<void> {
    try {
      await this.auth.createCompany(this.newCompanyName.trim(), this.newCompanyCurrency);
      window.location.assign('/dashboard');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
