import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/modal.component';

type Tab = 'general' | 'stages' | 'products' | 'users' | 'currencies' | 'targets';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TrPipe, ModalComponent],
  template: `
    <div class="page">
      <div class="page-head"><div><h1>{{ 'settings' | tr }}</h1></div></div>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button class="tab" [class.on]="tab === t" (click)="tab = t">{{ t | tr }}</button>
        }
      </div>

      <!-- GENERAL -->
      @if (tab === 'general' && org) {
        <div class="card" style="max-width: 480px">
          <label>{{ 'org_name' | tr }}</label>
          <input [(ngModel)]="org.name" [disabled]="!auth.isAdmin" />
          <label>{{ 'base_currency' | tr }}</label>
          <input [(ngModel)]="org.base_currency" maxlength="3" [disabled]="!auth.isAdmin" />
          <label>{{ 'stale_days' | tr }}</label>
          <input type="number" [(ngModel)]="org.stale_days" min="1" [disabled]="!auth.isAdmin" />
          @if (auth.isAdmin) {
            <div class="modal-actions"><button class="btn primary" (click)="saveOrg()">{{ 'save' | tr }}</button></div>
          }
        </div>
      }

      <!-- STAGES -->
      @if (tab === 'stages') {
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ 'order' | tr }}</th><th>{{ 'name' | tr }}</th><th class="num">{{ 'probability' | tr }} %</th><th>{{ 'requires_amount' | tr }}</th><th>{{ 'is_won_flag' | tr }}</th><th>{{ 'is_lost_flag' | tr }}</th><th></th></tr></thead>
            <tbody>
              @for (s of stages; track s.id) {
                <tr>
                  <td><input class="mini" type="number" [(ngModel)]="s.sort_order" [disabled]="!auth.canWrite" /></td>
                  <td><input [(ngModel)]="s.name" [disabled]="!auth.canWrite" /></td>
                  <td class="num"><input class="mini" type="number" min="0" max="100" [(ngModel)]="s.probability" [disabled]="!auth.canWrite" /></td>
                  <td><input type="checkbox" [(ngModel)]="s.requires_amount" [disabled]="!auth.canWrite" /></td>
                  <td><input type="checkbox" [(ngModel)]="s.is_won" [disabled]="!auth.canWrite" /></td>
                  <td><input type="checkbox" [(ngModel)]="s.is_lost" [disabled]="!auth.canWrite" /></td>
                  <td>
                    @if (auth.canWrite) {
                      <button class="btn sm" (click)="saveStage(s)">{{ 'save' | tr }}</button>
                      <button class="btn sm danger" (click)="deleteStage(s)">✕</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (auth.canWrite) {
          <button class="btn section" (click)="addStage()">+ {{ 'new' | tr }}</button>
        }
      }

      <!-- PRODUCTS -->
      @if (tab === 'products') {
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ 'name' | tr }}</th><th>{{ 'category' | tr }}</th><th class="num">{{ 'unit_price' | tr }}</th><th>{{ 'currency' | tr }}</th><th>{{ 'is_recurring' | tr }}</th><th>{{ 'active' | tr }}</th><th></th></tr></thead>
            <tbody>
              @for (p of products; track p.id) {
                <tr>
                  <td><input [(ngModel)]="p.name" [disabled]="!auth.canWrite" /></td>
                  <td><input [(ngModel)]="p.category" [disabled]="!auth.canWrite" /></td>
                  <td class="num"><input class="mini" type="number" [(ngModel)]="p.unit_price" [disabled]="!auth.canWrite" /></td>
                  <td><input class="mini" [(ngModel)]="p.currency" maxlength="3" [disabled]="!auth.canWrite" /></td>
                  <td><input type="checkbox" [(ngModel)]="p.is_recurring" [disabled]="!auth.canWrite" /></td>
                  <td><input type="checkbox" [(ngModel)]="p.is_active" [disabled]="!auth.canWrite" /></td>
                  <td>@if (auth.canWrite) { <button class="btn sm" (click)="saveProduct(p)">{{ 'save' | tr }}</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (auth.canWrite) { <button class="btn section" (click)="addProduct()">+ {{ 'new' | tr }}</button> }
      }

      <!-- USERS -->
      @if (tab === 'users') {
        <div class="table-wrap">
          <table>
            <thead><tr><th>{{ 'name' | tr }}</th><th>{{ 'email' | tr }}</th><th>{{ 'role' | tr }}</th><th>{{ 'manager' | tr }}</th><th>{{ 'active' | tr }}</th><th></th></tr></thead>
            <tbody>
              @for (u of users; track u.id) {
                <tr>
                  <td><strong>{{ u.full_name }}</strong></td>
                  <td>{{ u.email }}</td>
                  <td><span class="badge blue">{{ roleLabel(u.role) | tr }}</span></td>
                  <td>{{ managerName(u.manager_id) }}</td>
                  <td>{{ u.is_active ? '✓' : '—' }}</td>
                  <td>@if (auth.isAdmin) { <button class="btn sm" (click)="editUser(u)">{{ 'edit' | tr }}</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (auth.isAdmin) { <button class="btn section" (click)="newUser()">+ {{ 'new' | tr }}</button> }

        @if (userForm) {
          <app-modal [title]="(userForm.id ? 'edit' : 'new') | tr" (closed)="userForm = null">
            <form (ngSubmit)="saveUser()">
              <div class="form-row">
                <div><label>{{ 'name' | tr }} *</label><input [(ngModel)]="userForm.full_name" name="fn" required /></div>
                <div><label>{{ 'email' | tr }} *</label><input [(ngModel)]="userForm.email" name="em" type="email" required /></div>
                <div>
                  <label>{{ 'role' | tr }}</label>
                  <select [(ngModel)]="userForm.role" name="role">
                    <option value="admin">{{ 'admin' | tr }}</option>
                    <option value="manager">{{ 'sales_manager' | tr }}</option>
                    <option value="rep">{{ 'sales_rep' | tr }}</option>
                    <option value="viewer">{{ 'viewer' | tr }}</option>
                  </select>
                </div>
                <div>
                  <label>{{ 'manager' | tr }}</label>
                  <select [(ngModel)]="userForm.manager_id" name="mgr">
                    <option [ngValue]="null">—</option>
                    @for (u of users; track u.id) { <option [ngValue]="u.id">{{ u.full_name }}</option> }
                  </select>
                </div>
                <div><label>{{ 'password' | tr }} {{ userForm.id ? '(optional)' : '*' }}</label><input [(ngModel)]="userForm.password" name="pw" type="password" /></div>
                <div>
                  <label>{{ 'language' | tr }}</label>
                  <select [(ngModel)]="userForm.language" name="lang"><option value="en">EN</option><option value="pt">PT</option></select>
                </div>
              </div>
              <label class="inline"><input type="checkbox" [(ngModel)]="userForm.is_active" name="act" /> {{ 'active' | tr }}</label>
              <div class="modal-actions">
                <button type="button" class="btn" (click)="userForm = null">{{ 'cancel' | tr }}</button>
                <button class="btn primary">{{ 'save' | tr }}</button>
              </div>
            </form>
          </app-modal>
        }
      }

      <!-- CURRENCIES -->
      @if (tab === 'currencies') {
        <div class="card" style="max-width: 440px">
          <p class="muted">1 unit = X {{ org?.base_currency }}</p>
          @for (c of currencies; track $index) {
            <div class="inline" style="margin-bottom: 8px">
              <input [(ngModel)]="c.code" maxlength="3" style="width: 90px" [disabled]="!auth.isAdmin" />
              <input type="number" step="0.0001" [(ngModel)]="c.rate_to_base" [disabled]="!auth.isAdmin" />
              @if (auth.isAdmin) { <button class="btn sm danger" (click)="currencies.splice($index, 1)">✕</button> }
            </div>
          }
          @if (auth.isAdmin) {
            <div class="inline">
              <button class="btn sm" (click)="currencies.push({ code: '', rate_to_base: 1 })">+ {{ 'new' | tr }}</button>
              <button class="btn primary sm" (click)="saveCurrencies()">{{ 'save' | tr }}</button>
            </div>
          }
        </div>
      }

      <!-- TARGETS -->
      @if (tab === 'targets') {
        <div class="table-wrap" style="max-width: 720px">
          <table>
            <thead><tr><th>{{ 'owner' | tr }}</th><th>{{ 'year' | tr }}</th><th>{{ 'quarter' | tr }}</th><th class="num">{{ 'target' | tr }} ({{ org?.base_currency }})</th><th></th></tr></thead>
            <tbody>
              @for (t of targets; track t.id) {
                <tr>
                  <td>{{ t.user_name }}</td>
                  <td>{{ t.year }}</td>
                  <td>Q{{ t.quarter }}</td>
                  <td class="num">{{ t.target_amount | number }}</td>
                  <td>@if (auth.isAdmin) { <button class="btn sm danger" (click)="deleteTarget(t)">✕</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (auth.isAdmin) {
          <div class="card section" style="max-width: 720px">
            <h3>+ {{ 'new' | tr }}</h3>
            <div class="inline">
              <select [(ngModel)]="targetForm.user_id">
                @for (u of users; track u.id) { <option [ngValue]="u.id">{{ u.full_name }}</option> }
              </select>
              <input type="number" [(ngModel)]="targetForm.year" style="width: 100px" />
              <select [(ngModel)]="targetForm.quarter" style="width: 80px">
                <option [ngValue]="1">Q1</option><option [ngValue]="2">Q2</option>
                <option [ngValue]="3">Q3</option><option [ngValue]="4">Q4</option>
              </select>
              <input type="number" [(ngModel)]="targetForm.target_amount" [placeholder]="'target' | tr" />
              <button class="btn primary sm" (click)="saveTarget()">{{ 'save' | tr }}</button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .tabs { display: flex; gap: 4px; margin-bottom: 18px; flex-wrap: wrap; }
      .tab { padding: 8px 16px; border: none; background: transparent; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; border-radius: 8px; }
      .tab.on { background: var(--primary); color: #fff; }
      .mini { width: 80px; }
      table input { min-width: 70px; }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  tabs: Tab[] = ['general', 'stages', 'products', 'users', 'currencies', 'targets'];
  tab: Tab = 'general';

  org: any = null;
  stages: any[] = [];
  products: any[] = [];
  users: any[] = [];
  currencies: any[] = [];
  targets: any[] = [];
  userForm: any = null;
  targetForm: any = { user_id: null, year: new Date().getFullYear(), quarter: Math.floor(new Date().getMonth() / 3) + 1, target_amount: 0 };

  async ngOnInit(): Promise<void> {
    [this.org, this.stages, this.products, this.users, this.currencies, this.targets] =
      await Promise.all([
        this.api.get('org'), this.api.get('stages'), this.api.get('products'),
        this.api.get('users'), this.api.get('currencies'), this.api.get('targets'),
      ]);
    this.targetForm.user_id = this.users[0]?.id ?? null;
  }

  roleLabel(role: string): string {
    return { admin: 'admin', manager: 'sales_manager', rep: 'sales_rep', viewer: 'viewer' }[role] || role;
  }

  managerName(id: number | null): string {
    return this.users.find((u) => u.id === id)?.full_name || '—';
  }

  async saveOrg(): Promise<void> {
    try {
      this.org = await this.api.put('org', this.org);
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  async saveStage(s: any): Promise<void> {
    try {
      if (s.id) { await this.api.put(`stages/${s.id}`, s); } else { await this.api.post('stages', s); }
      this.stages = await this.api.get('stages');
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  addStage(): void {
    this.stages.push({ id: null, name: '', sort_order: this.stages.length + 1, probability: 10, is_won: false, is_lost: false, requires_amount: false });
  }

  async deleteStage(s: any): Promise<void> {
    if (!s.id) { this.stages = this.stages.filter((x) => x !== s); return; }
    try {
      await this.api.delete(`stages/${s.id}`);
      this.stages = await this.api.get('stages');
      this.toast.show('Deleted');
    } catch (e) { this.toast.error(e); }
  }

  async saveProduct(p: any): Promise<void> {
    try {
      if (p.id) { await this.api.put(`products/${p.id}`, p); } else { await this.api.post('products', p); }
      this.products = await this.api.get('products');
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  addProduct(): void {
    this.products.push({ id: null, name: '', category: '', unit_price: 0, currency: this.org?.base_currency || 'USD', is_recurring: false, is_active: true });
  }

  newUser(): void {
    this.userForm = { id: null, full_name: '', email: '', role: 'rep', manager_id: null, password: '', language: 'en', is_active: true };
  }

  editUser(u: any): void {
    this.userForm = { ...u, password: '' };
  }

  async saveUser(): Promise<void> {
    try {
      const body = { ...this.userForm, password: this.userForm.password || null };
      if (this.userForm.id) { await this.api.put(`users/${this.userForm.id}`, body); }
      else { await this.api.post('users', body); }
      this.users = await this.api.get('users');
      this.userForm = null;
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  async saveCurrencies(): Promise<void> {
    try {
      this.currencies = await this.api.put('currencies', this.currencies.filter((c) => c.code));
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  async saveTarget(): Promise<void> {
    try {
      await this.api.post('targets', this.targetForm);
      this.targets = await this.api.get('targets');
      this.toast.show('Saved');
    } catch (e) { this.toast.error(e); }
  }

  async deleteTarget(t: any): Promise<void> {
    try {
      await this.api.delete(`targets/${t.id}`);
      this.targets = await this.api.get('targets');
    } catch (e) { this.toast.error(e); }
  }
}
