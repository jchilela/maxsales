import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TrPipe],
  template: `
    <div class="wrap">
      <div class="card box">
        <div class="logo">Max<span>Sales</span></div>
        <p class="muted">{{ 'welcome' | tr }}</p>
        <form (ngSubmit)="submit()">
          <label>{{ 'email' | tr }}</label>
          <input [(ngModel)]="email" name="email" type="email" required autocomplete="username" />
          <label>{{ 'password' | tr }}</label>
          <input [(ngModel)]="password" name="password" type="password" required autocomplete="current-password" />
          @if (error) { <div class="err">{{ error }}</div> }
          <button class="btn primary full" [disabled]="busy">{{ 'login' | tr }}</button>
        </form>
        <div class="hint">
          {{ 'no_account' | tr }} <a routerLink="/signup">{{ 'create_company' | tr }}</a>
        </div>
        <div class="hint">
          <strong>{{ 'demo_hint' | tr }}</strong>
          <code>admin&#64;umoya.demo</code> · <code>manager&#64;umoya.demo</code> ·
          <code>carla&#64;umoya.demo</code> · <code>ceo&#64;umoya.demo</code> ·
          <code>admin&#64;lisboa.demo</code>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a, #1e3a8a); padding: 16px; }
      .box { width: 380px; max-width: 100%; padding: 30px 24px; }
      .logo { font-size: 28px; font-weight: 800; }
      .logo span { color: var(--primary); }
      .full { width: 100%; justify-content: center; margin-top: 18px; }
      .err { color: var(--red); margin-top: 10px; font-weight: 600; font-size: 13px; }
      .hint { margin-top: 18px; font-size: 12px; color: var(--muted); line-height: 1.7; }
      code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
    `,
  ],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = 'admin@umoya.demo';
  password = 'Demo123!';
  error = '';
  busy = false;

  async submit(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error = e?.error?.detail || 'Login failed';
    } finally {
      this.busy = false;
    }
  }
}
