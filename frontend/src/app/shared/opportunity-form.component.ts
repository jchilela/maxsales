import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';

/** Create/edit form for opportunities, reused by the pipeline board,
 * account 360 and opportunity detail pages. */
@Component({
  selector: 'app-opportunity-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TrPipe],
  template: `
    <form (ngSubmit)="save()">
      <label>{{ 'name' | tr }} *</label>
      <input [(ngModel)]="model.name" name="name" required />
      <div class="form-row">
        <div>
          <label>{{ 'account' | tr }} *</label>
          <select [(ngModel)]="model.account_id" name="account_id" (ngModelChange)="loadContacts()" required [disabled]="!!lockAccountId">
            @for (a of accounts; track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
          </select>
        </div>
        <div>
          <label>{{ 'contact' | tr }}</label>
          <select [(ngModel)]="model.primary_contact_id" name="contact_id">
            <option [ngValue]="null">—</option>
            @for (c of contacts; track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
        </div>
        <div>
          <label>{{ 'amount' | tr }}</label>
          <input type="number" [(ngModel)]="model.amount" name="amount" min="0" />
        </div>
        <div>
          <label>{{ 'currency' | tr }}</label>
          <select [(ngModel)]="model.currency" name="currency">
            @for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div>
          <label>{{ 'close_date' | tr }}</label>
          <input type="date" [(ngModel)]="model.expected_close_date" name="close" />
        </div>
        <div>
          <label>{{ 'probability' | tr }} %</label>
          <input type="number" [(ngModel)]="model.probability" name="prob" min="0" max="100" />
        </div>
        <div>
          <label>{{ 'owner' | tr }}</label>
          <select [(ngModel)]="model.owner_id" name="owner">
            <option [ngValue]="null">—</option>
            @for (u of users; track u.id) { <option [ngValue]="u.id">{{ u.full_name }}</option> }
          </select>
        </div>
        <div>
          <label>{{ 'source' | tr }}</label>
          <select [(ngModel)]="model.source" name="source">
            <option [ngValue]="null">—</option>
            <option value="referral">{{ 'referral' | tr }}</option>
            <option value="event">{{ 'event' | tr }}</option>
            <option value="inbound">{{ 'inbound' | tr }}</option>
            <option value="outbound">{{ 'outbound' | tr }}</option>
            <option value="partner">{{ 'partner' | tr }}</option>
          </select>
        </div>
        <div>
          <label>{{ 'product_line' | tr }}</label>
          <input [(ngModel)]="model.product_line" name="line" list="lines" />
          <datalist id="lines">
            <option value="Cloud"></option><option value="Connectivity"></option>
            <option value="Hosting"></option><option value="Consulting"></option>
          </datalist>
        </div>
        <div>
          <label>{{ 'competitors' | tr }}</label>
          <input [(ngModel)]="model.competitors" name="competitors" />
        </div>
      </div>
      <label>{{ 'next_step' | tr }}</label>
      <input [(ngModel)]="model.next_step" name="next_step" />
      <div class="modal-actions">
        <button type="button" class="btn" (click)="cancelled.emit()">{{ 'cancel' | tr }}</button>
        <button class="btn primary" [disabled]="!model.name || !model.account_id">{{ 'save' | tr }}</button>
      </div>
    </form>
  `,
})
export class OpportunityFormComponent implements OnInit {
  @Input() opportunity: any = null; // null = create
  @Input() lockAccountId: number | null = null;
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);

  model: any = { name: '', account_id: null, primary_contact_id: null, owner_id: null, amount: null, currency: 'USD', probability: null, expected_close_date: null, source: null, product_line: null, competitors: null, next_step: null };
  accounts: any[] = [];
  contacts: any[] = [];
  users: any[] = [];
  currencies = ['USD', 'EUR', 'AOA'];

  async ngOnInit(): Promise<void> {
    [this.accounts, this.users] = await Promise.all([this.api.get('accounts'), this.api.get('users')]);
    if (this.opportunity) {
      this.model = {
        ...this.model,
        ...this.opportunity,
        expected_close_date: this.opportunity.expected_close_date?.slice(0, 10) || null,
      };
    }
    if (this.lockAccountId) this.model.account_id = this.lockAccountId;
    if (this.model.account_id) await this.loadContacts();
  }

  async loadContacts(): Promise<void> {
    if (!this.model.account_id) return;
    this.contacts = await this.api.get('contacts', { account_id: this.model.account_id });
  }

  async save(): Promise<void> {
    const body = {
      name: this.model.name,
      account_id: this.model.account_id,
      primary_contact_id: this.model.primary_contact_id,
      owner_id: this.model.owner_id,
      amount: this.model.amount,
      currency: this.model.currency,
      probability: this.model.probability,
      expected_close_date: this.model.expected_close_date || null,
      source: this.model.source,
      product_line: this.model.product_line,
      competitors: this.model.competitors,
      next_step: this.model.next_step,
    };
    try {
      const res = this.opportunity
        ? await this.api.put(`opportunities/${this.opportunity.id}`, body)
        : await this.api.post('opportunities', body);
      this.toast.show('Saved');
      this.saved.emit(res);
    } catch (e) {
      this.toast.error(e);
    }
  }
}
