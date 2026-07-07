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

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, MoneyPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>{{ 'sales' | tr }}</h1><div class="sub">{{ 'recurring' | tr }} + {{ 'one_off' | tr }}</div></div>
      </div>

      @if (summary) {
        <div class="grid cols-3">
          <div class="card kpi"><div class="label">MRR</div><div class="value">{{ summary.mrr | money: summary.base_currency }}</div></div>
          <div class="card kpi"><div class="label">ARR</div><div class="value">{{ summary.arr | money: summary.base_currency }}</div></div>
          <div class="card kpi"><div class="label">{{ 'contract_value' | tr }} ({{ 'total' | tr }})</div><div class="value">{{ summary.total_contract_value | money: summary.base_currency }}</div></div>
        </div>
      }

      <div class="toolbar section">
        <input [placeholder]="'filter' | tr" [(ngModel)]="ls.search" (ngModelChange)="ls.page = 1" />
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th (click)="ls.sortBy('account_name')">{{ 'account' | tr }}</th>
              <th>{{ 'opportunity' | tr }}</th>
              <th class="num" (click)="ls.sortBy('contract_value')">{{ 'contract_value' | tr }}</th>
              <th (click)="ls.sortBy('billing_type')">{{ 'billing_type' | tr }}</th>
              <th class="num">MRR</th>
              <th (click)="ls.sortBy('start_date')">{{ 'start_date' | tr }}</th>
              <th class="num">{{ 'term_months' | tr }}</th>
              <th>{{ 'invoicing_status' | tr }}</th>
            </tr>
          </thead>
          <tbody>
            @for (s of ls.pageOf(rows); track s.id) {
              <tr>
                <td><a [routerLink]="['/accounts', s.account_id]">{{ s.account_name }}</a></td>
                <td>
                  @if (s.opportunity_id) { <a [routerLink]="['/opportunities', s.opportunity_id]">{{ s.opportunity_name }}</a> }
                  @else { — }
                </td>
                <td class="num"><strong>{{ s.contract_value | money: s.currency }}</strong></td>
                <td><span class="badge" [class.blue]="s.billing_type === 'recurring'" [class.gray]="s.billing_type !== 'recurring'">{{ s.billing_type | tr }}</span></td>
                <td class="num">{{ s.mrr !== null ? (s.mrr | money: s.currency) : '—' }}</td>
                <td>{{ s.start_date | date: 'MMM d, y' }}</td>
                <td class="num">{{ s.term_months || '—' }}</td>
                <td>
                  @if (auth.canWrite) {
                    <select [ngModel]="s.invoicing_status" (ngModelChange)="setInvoicing(s, $event)">
                      <option value="not_invoiced">{{ 'not_invoiced' | tr }}</option>
                      <option value="partially_invoiced">{{ 'partially_invoiced' | tr }}</option>
                      <option value="invoiced">{{ 'invoiced' | tr }}</option>
                      <option value="paid">{{ 'paid' | tr }}</option>
                    </select>
                  } @else { <span class="badge gray">{{ s.invoicing_status | tr }}</span> }
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
    </div>
  `,
})
export class SalesComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  rows: any[] = [];
  summary: any = null;
  ls = new ListState<any>();

  async ngOnInit(): Promise<void> {
    [this.rows, this.summary] = await Promise.all([this.api.get('sales'), this.api.get('sales/summary')]);
  }

  async setInvoicing(s: any, status: string): Promise<void> {
    try {
      await this.api.put(`sales/${s.id}`, { ...s, invoicing_status: status });
      s.invoicing_status = status;
      this.toast.show('Updated');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
