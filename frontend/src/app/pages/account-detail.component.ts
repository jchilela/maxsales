import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { MoneyPipe } from '../core/money.pipe';
import { ToastService } from '../core/toast.service';
import { ComposeComponent } from '../shared/compose.component';
import { ModalComponent } from '../shared/modal.component';
import { OpportunityFormComponent } from '../shared/opportunity-form.component';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, MoneyPipe, ModalComponent, OpportunityFormComponent, TimelineComponent, ComposeComponent],
  template: `
    @if (a) {
      <div class="page">
        <div class="page-head">
          <div>
            <div class="sub"><a routerLink="/accounts">{{ 'accounts' | tr }}</a> /</div>
            <h1>{{ a.name }}</h1>
            <div class="sub">
              <span class="badge blue">{{ a.segment | tr }}</span>
              <span class="badge" [class.green]="a.status === 'active'" [class.gray]="a.status !== 'active'">{{ a.status | tr }}</span>
              {{ a.industry }} · {{ a.country }}
              @if (a.website) { · <a [href]="a.website" target="_blank">{{ a.website }}</a> }
            </div>
          </div>
          <div class="card kpi" style="min-width: 220px">
            <div class="label">{{ 'lifetime_revenue' | tr }}</div>
            <div class="value">{{ a.lifetime_revenue | money: a.base_currency }}</div>
            <div class="hint">{{ 'owner' | tr }}: {{ a.owner_name || '—' }}</div>
          </div>
        </div>

        <div class="grid cols-2">
          <!-- contacts -->
          <div class="card">
            <div class="head-row">
              <h2>{{ 'contacts' | tr }} ({{ a.contacts.length }})</h2>
              @if (auth.canWrite) { <button class="btn sm" (click)="newContact()">+ {{ 'add_contact' | tr }}</button> }
            </div>
            @if (!a.contacts.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (c of a.contacts; track c.id) {
                <tr>
                  <td>
                    <strong>{{ c.name }}</strong> @if (c.is_decision_maker) { <span title="Decision maker">⭐</span> }
                    <div class="muted">{{ c.role_title }}</div>
                  </td>
                  <td><div>{{ c.email }}</div><div class="muted">{{ c.phone }}</div></td>
                  <td class="num">
                    @if (auth.canWrite) {
                      <button class="btn sm" [title]="'send_whatsapp' | tr" (click)="openCompose('whatsapp', c)">💬</button>
                      <button class="btn sm" [title]="'send_email' | tr" (click)="openCompose('email', c)">✉️</button>
                      <button class="btn sm" (click)="editContact(c)">{{ 'edit' | tr }}</button>
                    }
                  </td>
                </tr>
              }
            </table>
          </div>

          <!-- opportunities -->
          <div class="card">
            <div class="head-row">
              <h2>{{ 'opportunities' | tr }} ({{ a.opportunities.length }})</h2>
              @if (auth.canWrite) { <button class="btn sm" (click)="newOpp = true">+ {{ 'new' | tr }}</button> }
            </div>
            @if (!a.opportunities.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (o of a.opportunities; track o.id) {
                <tr>
                  <td><a [routerLink]="['/opportunities', o.id]">{{ o.name }}</a></td>
                  <td>
                    <span class="badge" [class.green]="o.status === 'won'" [class.red]="o.status === 'lost'" [class.blue]="o.status === 'open'">
                      {{ o.status === 'open' ? o.stage_name : ((o.status === 'won' ? 'won' : 'lost') | tr) }}
                    </span>
                  </td>
                  <td class="num">{{ o.amount | money: o.currency }}</td>
                </tr>
              }
            </table>
          </div>

          <!-- projects -->
          <div class="card">
            <h2>{{ 'projects' | tr }} ({{ a.projects.length }})</h2>
            @if (!a.projects.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (p of a.projects; track p.id) {
                <tr>
                  <td><span class="dot {{ p.health }}"></span> <a [routerLink]="['/projects', p.id]">{{ p.name }}</a></td>
                  <td><span class="badge gray">{{ p.status | tr }}</span></td>
                  <td class="num">{{ p.percent_complete }}%</td>
                </tr>
              }
            </table>
          </div>

          <!-- sales -->
          <div class="card">
            <h2>{{ 'sales' | tr }} ({{ a.sales.length }})</h2>
            @if (!a.sales.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (s of a.sales; track s.id) {
                <tr>
                  <td>{{ s.opportunity_name || '—' }}<div class="muted">{{ s.start_date | date: 'MMM y' }}</div></td>
                  <td><span class="badge" [class.blue]="s.billing_type === 'recurring'" [class.gray]="s.billing_type !== 'recurring'">{{ s.billing_type | tr }}</span></td>
                  <td class="num">{{ s.contract_value | money: s.currency }}</td>
                </tr>
              }
            </table>
          </div>
        </div>

        <div class="section">
          <app-timeline [activities]="a.activities" [related]="{ account_id: a.id }" (changed)="load()" />
        </div>

        @if (contactForm) {
          <app-modal [title]="(contactForm.id ? 'edit' : 'add_contact') | tr" (closed)="contactForm = null">
            <form (ngSubmit)="saveContact()">
              <label>{{ 'name' | tr }} *</label>
              <input [(ngModel)]="contactForm.name" name="name" required />
              <div class="form-row">
                <div><label>{{ 'role_title' | tr }}</label><input [(ngModel)]="contactForm.role_title" name="rt" /></div>
                <div><label>{{ 'email' | tr }}</label><input [(ngModel)]="contactForm.email" name="email" type="email" /></div>
                <div><label>{{ 'phone' | tr }}</label><input [(ngModel)]="contactForm.phone" name="phone" /></div>
                <div><label>{{ 'whatsapp' | tr }}</label><input [(ngModel)]="contactForm.whatsapp" name="wa" /></div>
                <div><label>LinkedIn</label><input [(ngModel)]="contactForm.linkedin" name="li" /></div>
                <div>
                  <label>{{ 'language' | tr }}</label>
                  <select [(ngModel)]="contactForm.preferred_language" name="lang">
                    <option value="en">English</option><option value="pt">Português</option>
                  </select>
                </div>
              </div>
              <label class="inline"><input type="checkbox" [(ngModel)]="contactForm.is_decision_maker" name="dm" /> {{ 'decision_maker' | tr }}</label>
              <div class="modal-actions">
                <button type="button" class="btn" (click)="contactForm = null">{{ 'cancel' | tr }}</button>
                <button class="btn primary" [disabled]="!contactForm.name">{{ 'save' | tr }}</button>
              </div>
            </form>
          </app-modal>
        }

        @if (newOpp) {
          <app-modal [title]="'opportunity' | tr" (closed)="newOpp = false">
            <app-opportunity-form [lockAccountId]="a.id" (saved)="newOpp = false; load()" (cancelled)="newOpp = false" />
          </app-modal>
        }
        @if (compose) {
          <app-compose
            [mode]="compose"
            [accountId]="a.id"
            [preselectContactId]="composeContactId"
            [topic]="a.name"
            (sent)="load()"
            (closed)="compose = null"
          />
        }
      </div>
    } @else {
      <div class="page"><div class="empty">{{ 'loading' | tr }}</div></div>
    }
  `,
  styles: [`.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; } .head-row h2 { margin: 0; }`],
})
export class AccountDetailComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  a: any = null;
  contactForm: any = null;
  newOpp = false;
  compose: 'whatsapp' | 'email' | null = null;
  composeContactId: number | null = null;

  openCompose(mode: 'whatsapp' | 'email', contact: any): void {
    this.composeContactId = contact.id;
    this.compose = mode;
  }

  ngOnInit(): void {
    this.route.params.subscribe(() => this.load());
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    this.a = await this.api.get(`accounts/${id}`);
  }

  newContact(): void {
    this.contactForm = { id: null, name: '', role_title: '', email: '', phone: '', whatsapp: '', linkedin: '', is_decision_maker: false, preferred_language: 'en' };
  }

  editContact(c: any): void {
    this.contactForm = { ...c };
  }

  async saveContact(): Promise<void> {
    const body = { ...this.contactForm, account_id: this.a.id };
    try {
      if (this.contactForm.id) {
        await this.api.put(`contacts/${this.contactForm.id}`, body);
      } else {
        await this.api.post('contacts', body);
      }
      this.toast.show('Saved');
      this.contactForm = null;
      await this.load();
    } catch (e: any) {
      if (e?.status === 409 && confirm(e.error.detail)) {
        await this.api.post('contacts', body, { force: true });
        this.contactForm = null;
        await this.load();
      } else {
        this.toast.error(e);
      }
    }
  }
}
