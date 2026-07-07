import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ListState } from '../core/list-state';
import { MoneyPipe } from '../core/money.pipe';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, MoneyPipe, ModalComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>{{ 'accounts' | tr }}</h1><div class="sub">{{ ls.count(rows) }} {{ 'total' | tr | lowercase }}</div></div>
        @if (auth.canWrite) { <button class="btn primary" (click)="openForm(null)">+ {{ 'new' | tr }}</button> }
      </div>

      <div class="toolbar">
        <input [placeholder]="'filter' | tr" [(ngModel)]="ls.search" (ngModelChange)="ls.page = 1" />
        <select [(ngModel)]="ls.pageSize"><option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option></select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th (click)="ls.sortBy('name')">{{ 'name' | tr }}</th>
              <th (click)="ls.sortBy('industry')">{{ 'industry' | tr }}</th>
              <th (click)="ls.sortBy('segment')">{{ 'segment' | tr }}</th>
              <th (click)="ls.sortBy('country')">{{ 'country' | tr }}</th>
              <th (click)="ls.sortBy('status')">{{ 'status' | tr }}</th>
              <th (click)="ls.sortBy('owner_name')">{{ 'owner' | tr }}</th>
              <th class="num" (click)="ls.sortBy('open_opportunities')">{{ 'open_opps' | tr }}</th>
              <th>{{ 'actions' | tr }}</th>
            </tr>
          </thead>
          <tbody>
            @for (a of ls.pageOf(rows); track a.id) {
              <tr>
                <td><a [routerLink]="['/accounts', a.id]"><strong>{{ a.name }}</strong></a></td>
                <td>{{ a.industry }}</td>
                <td><span class="badge blue">{{ a.segment | tr }}</span></td>
                <td>{{ a.country }}</td>
                <td>
                  <span class="badge" [class.green]="a.status === 'active'" [class.gray]="a.status === 'prospect'" [class.red]="a.status === 'churned'">
                    {{ a.status | tr }}
                  </span>
                </td>
                <td>{{ a.owner_name }}</td>
                <td class="num">{{ a.open_opportunities }}</td>
                <td>
                  @if (auth.canWrite) {
                    <button class="btn sm" (click)="openForm(a)">{{ 'edit' | tr }}</button>
                    <button class="btn sm danger" (click)="remove(a)">✕</button>
                  }
                </td>
              </tr>
            }
            @if (!ls.count(rows)) { <tr><td colspan="8"><div class="empty">{{ 'no_results' | tr }}</div></td></tr> }
          </tbody>
        </table>
        <div class="pager">
          <span>{{ 'page' | tr }} {{ ls.page }} {{ 'of' | tr }} {{ ls.pages(rows) }}</span>
          <button class="btn sm" [disabled]="ls.page <= 1" (click)="ls.page = ls.page - 1">‹</button>
          <button class="btn sm" [disabled]="ls.page >= ls.pages(rows)" (click)="ls.page = ls.page + 1">›</button>
        </div>
      </div>

      @if (form) {
        <app-modal [title]="(form.id ? 'edit' : 'new') | tr" (closed)="form = null">
          <form (ngSubmit)="save()">
            <label>{{ 'name' | tr }} *</label>
            <input [(ngModel)]="form.name" name="name" required />
            <div class="form-row">
              <div><label>{{ 'industry' | tr }}</label><input [(ngModel)]="form.industry" name="industry" /></div>
              <div>
                <label>{{ 'segment' | tr }}</label>
                <select [(ngModel)]="form.segment" name="segment">
                  <option value="enterprise">{{ 'enterprise' | tr }}</option>
                  <option value="smb">{{ 'smb' | tr }}</option>
                  <option value="government">{{ 'government' | tr }}</option>
                </select>
              </div>
              <div><label>{{ 'country' | tr }}</label><input [(ngModel)]="form.country" name="country" /></div>
              <div><label>{{ 'website' | tr }}</label><input [(ngModel)]="form.website" name="website" /></div>
              <div><label>{{ 'tax_id' | tr }}</label><input [(ngModel)]="form.tax_id" name="tax_id" /></div>
              <div>
                <label>{{ 'status' | tr }}</label>
                <select [(ngModel)]="form.status" name="status">
                  <option value="prospect">{{ 'prospect' | tr }}</option>
                  <option value="active">{{ 'active' | tr }}</option>
                  <option value="churned">{{ 'churned' | tr }}</option>
                </select>
              </div>
              <div><label>{{ 'annual_revenue' | tr }}</label><input type="number" [(ngModel)]="form.annual_revenue" name="rev" /></div>
              <div>
                <label>{{ 'owner' | tr }}</label>
                <select [(ngModel)]="form.owner_id" name="owner">
                  <option [ngValue]="null">—</option>
                  @for (u of users; track u.id) { <option [ngValue]="u.id">{{ u.full_name }}</option> }
                </select>
              </div>
            </div>
            <label>{{ 'notes' | tr }}</label>
            <textarea [(ngModel)]="form.notes" name="notes" rows="3"></textarea>
            @if (dupWarning) {
              <div class="dup">{{ dupWarning }}
                <button type="button" class="btn sm" (click)="save(true)">{{ 'duplicate_create_anyway' | tr }}</button>
              </div>
            }
            <div class="modal-actions">
              <button type="button" class="btn" (click)="form = null">{{ 'cancel' | tr }}</button>
              <button class="btn primary" [disabled]="!form.name">{{ 'save' | tr }}</button>
            </div>
          </form>
        </app-modal>
      }
    </div>
  `,
  styles: [`.dup { background: #fef3c7; color: #92400e; padding: 10px 12px; border-radius: 8px; margin-top: 12px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 10px; }`],
})
export class AccountsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  rows: any[] = [];
  users: any[] = [];
  ls = new ListState<any>();
  form: any = null;
  dupWarning = '';

  async ngOnInit(): Promise<void> {
    [this.rows, this.users] = await Promise.all([this.api.get('accounts'), this.api.get('users')]);
  }

  openForm(a: any): void {
    this.dupWarning = '';
    this.form = a
      ? { ...a }
      : { id: null, name: '', industry: '', segment: 'smb', country: '', website: '', tax_id: '', status: 'prospect', annual_revenue: null, owner_id: null, notes: '' };
  }

  async save(force = false): Promise<void> {
    const body = {
      name: this.form.name, industry: this.form.industry, segment: this.form.segment,
      country: this.form.country, website: this.form.website, tax_id: this.form.tax_id,
      owner_id: this.form.owner_id, status: this.form.status,
      annual_revenue: this.form.annual_revenue, notes: this.form.notes,
    };
    try {
      if (this.form.id) {
        await this.api.put(`accounts/${this.form.id}`, body);
      } else {
        await this.api.post('accounts', body, force ? { force: true } : {});
      }
      this.toast.show('Saved');
      this.form = null;
      this.dupWarning = '';
      this.rows = await this.api.get('accounts');
    } catch (e: any) {
      if (e?.status === 409) {
        this.dupWarning = e.error.detail;
      } else {
        this.toast.error(e);
      }
    }
  }

  async remove(a: any): Promise<void> {
    if (!confirm(a.name + ' — ' + 'delete?')) return;
    try {
      await this.api.delete(`accounts/${a.id}`);
      this.toast.show('Deleted');
      this.rows = await this.api.get('accounts');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
