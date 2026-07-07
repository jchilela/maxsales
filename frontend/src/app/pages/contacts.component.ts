import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ListState } from '../core/list-state';
import { ToastService } from '../core/toast.service';
import { ComposeComponent } from '../shared/compose.component';
import { ModalComponent } from '../shared/modal.component';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, ModalComponent, ComposeComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>{{ 'contacts' | tr }}</h1><div class="sub">{{ ls.count(rows) }} {{ 'total' | tr | lowercase }}</div></div>
        @if (auth.canWrite) { <button class="btn primary" (click)="openForm(null)">+ {{ 'new' | tr }}</button> }
      </div>

      <div class="toolbar">
        <input [placeholder]="'filter' | tr" [(ngModel)]="ls.search" (ngModelChange)="ls.page = 1" />
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th (click)="ls.sortBy('name')">{{ 'name' | tr }}</th>
              <th (click)="ls.sortBy('account_name')">{{ 'account' | tr }}</th>
              <th (click)="ls.sortBy('role_title')">{{ 'role_title' | tr }}</th>
              <th>{{ 'email' | tr }}</th>
              <th>{{ 'phone' | tr }}</th>
              <th>{{ 'language' | tr }}</th>
              <th>{{ 'actions' | tr }}</th>
            </tr>
          </thead>
          <tbody>
            @for (c of ls.pageOf(rows); track c.id) {
              <tr>
                <td><strong>{{ c.name }}</strong> @if (c.is_decision_maker) { ⭐ }</td>
                <td><a [routerLink]="['/accounts', c.account_id]">{{ c.account_name }}</a></td>
                <td>{{ c.role_title }}</td>
                <td>{{ c.email }}</td>
                <td>{{ c.phone }}</td>
                <td><span class="badge gray">{{ c.preferred_language | uppercase }}</span></td>
                <td>
                  @if (auth.canWrite) {
                    <button class="btn sm" [title]="'send_whatsapp' | tr" (click)="openCompose('whatsapp', c)">💬</button>
                    <button class="btn sm" [title]="'send_email' | tr" (click)="openCompose('email', c)">✉️</button>
                    <button class="btn sm" (click)="openForm(c)">{{ 'edit' | tr }}</button>
                    <button class="btn sm danger" (click)="remove(c)">✕</button>
                  }
                </td>
              </tr>
            }
            @if (!ls.count(rows)) { <tr><td colspan="7"><div class="empty">{{ 'no_results' | tr }}</div></td></tr> }
          </tbody>
        </table>
        <div class="pager">
          <span>{{ 'page' | tr }} {{ ls.page }} {{ 'of' | tr }} {{ ls.pages(rows) }}</span>
          <button class="btn sm" [disabled]="ls.page <= 1" (click)="ls.page = ls.page - 1">‹</button>
          <button class="btn sm" [disabled]="ls.page >= ls.pages(rows)" (click)="ls.page = ls.page + 1">›</button>
        </div>
      </div>

      @if (compose && composeContact) {
        <app-compose
          [mode]="compose"
          [accountId]="composeContact.account_id"
          [preselectContactId]="composeContact.id"
          [topic]="composeContact.account_name || ''"
          (closed)="compose = null"
        />
      }

      @if (form) {
        <app-modal [title]="(form.id ? 'edit' : 'new') | tr" (closed)="form = null">
          <form (ngSubmit)="save()">
            <div class="form-row">
              <div><label>{{ 'name' | tr }} *</label><input [(ngModel)]="form.name" name="name" required /></div>
              <div>
                <label>{{ 'account' | tr }} *</label>
                <select [(ngModel)]="form.account_id" name="account" required>
                  @for (a of accounts; track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                </select>
              </div>
              <div><label>{{ 'role_title' | tr }}</label><input [(ngModel)]="form.role_title" name="rt" /></div>
              <div><label>{{ 'email' | tr }}</label><input [(ngModel)]="form.email" name="email" type="email" /></div>
              <div><label>{{ 'phone' | tr }}</label><input [(ngModel)]="form.phone" name="phone" /></div>
              <div><label>{{ 'whatsapp' | tr }}</label><input [(ngModel)]="form.whatsapp" name="wa" /></div>
              <div><label>LinkedIn</label><input [(ngModel)]="form.linkedin" name="li" /></div>
              <div>
                <label>{{ 'language' | tr }}</label>
                <select [(ngModel)]="form.preferred_language" name="lang">
                  <option value="en">English</option><option value="pt">Português</option>
                </select>
              </div>
            </div>
            <label class="inline"><input type="checkbox" [(ngModel)]="form.is_decision_maker" name="dm" /> {{ 'decision_maker' | tr }}</label>
            <div class="modal-actions">
              <button type="button" class="btn" (click)="form = null">{{ 'cancel' | tr }}</button>
              <button class="btn primary" [disabled]="!form.name || !form.account_id">{{ 'save' | tr }}</button>
            </div>
          </form>
        </app-modal>
      }
    </div>
  `,
})
export class ContactsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  rows: any[] = [];
  accounts: any[] = [];
  ls = new ListState<any>();
  form: any = null;
  compose: 'whatsapp' | 'email' | null = null;
  composeContact: any = null;

  openCompose(mode: 'whatsapp' | 'email', contact: any): void {
    this.composeContact = contact;
    this.compose = mode;
  }

  async ngOnInit(): Promise<void> {
    [this.rows, this.accounts] = await Promise.all([this.api.get('contacts'), this.api.get('accounts')]);
  }

  openForm(c: any): void {
    this.form = c
      ? { ...c }
      : { id: null, name: '', account_id: this.accounts[0]?.id ?? null, role_title: '', email: '', phone: '', whatsapp: '', linkedin: '', is_decision_maker: false, preferred_language: 'en' };
  }

  async save(): Promise<void> {
    try {
      if (this.form.id) {
        await this.api.put(`contacts/${this.form.id}`, this.form);
      } else {
        await this.api.post('contacts', this.form);
      }
      this.toast.show('Saved');
      this.form = null;
      this.rows = await this.api.get('contacts');
    } catch (e: any) {
      if (e?.status === 409 && confirm(e.error.detail)) {
        await this.api.post('contacts', this.form, { force: true });
        this.form = null;
        this.rows = await this.api.get('contacts');
      } else {
        this.toast.error(e);
      }
    }
  }

  async remove(c: any): Promise<void> {
    if (!confirm(c.name + ' — delete?')) return;
    await this.api.delete(`contacts/${c.id}`);
    this.toast.show('Deleted');
    this.rows = await this.api.get('contacts');
  }
}
