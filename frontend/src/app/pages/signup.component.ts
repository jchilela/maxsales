import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { I18nService, TrPipe } from '../core/i18n.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, TrPipe],
  template: `
    <div class="wrap">
      <div class="card box">
        <div class="logo">Max<span>Sales</span></div>
        <p class="muted">{{ 'signup_tag' | tr }}</p>
        <form (ngSubmit)="submit()">
          <label>{{ 'org_name' | tr }} *</label>
          <input [(ngModel)]="company" name="company" required />
          <div class="two">
            <div>
              <label>{{ 'base_currency' | tr }}</label>
              <select [(ngModel)]="currency" name="currency">
                <option value="USD">USD</option><option value="EUR">EUR</option><option value="AOA">AOA</option>
              </select>
            </div>
            <div>
              <label>{{ 'language' | tr }}</label>
              <select [(ngModel)]="language" name="language">
                <option value="en">English</option><option value="pt">Português</option>
              </select>
            </div>
          </div>
          <label>{{ 'your_name' | tr }} *</label>
          <input [(ngModel)]="fullName" name="fullName" required />
          <label>{{ 'email' | tr }} *</label>
          <input [(ngModel)]="email" name="email" type="email" required autocomplete="username" />
          <label>{{ 'password' | tr }} *</label>
          <input [(ngModel)]="password" name="password" type="password" required minlength="8" autocomplete="new-password" />
          @if (error) { <div class="err">{{ error }}</div> }
          <button class="btn primary full" [disabled]="busy || !company || !fullName || !email || password.length < 8">
            {{ 'create_company' | tr }}
          </button>
        </form>
        <div class="hint">
          {{ 'have_account' | tr }} <a routerLink="/login">{{ 'login' | tr }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a, #1e3a8a); padding: 16px; }
      .box { width: 420px; max-width: 100%; padding: 30px 24px; }
      .logo { font-size: 28px; font-weight: 800; }
      .logo span { color: var(--primary); }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .full { width: 100%; justify-content: center; margin-top: 18px; }
      .err { color: var(--red); margin-top: 10px; font-weight: 600; font-size: 13px; }
      .hint { margin-top: 16px; font-size: 13px; color: var(--muted); }
    `,
  ],
})
export class SignupComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  company = '';
  currency = 'USD';
  language: 'en' | 'pt' = 'en';
  fullName = '';
  email = '';
  password = '';
  error = '';
  busy = false;

  async submit(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.auth.register({
        company_name: this.company,
        base_currency: this.currency,
        full_name: this.fullName,
        email: this.email,
        password: this.password,
        language: this.language,
      });
      this.i18n.setLang(this.language);
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error = e?.error?.detail || 'Signup failed';
    } finally {
      this.busy = false;
    }
  }
}
