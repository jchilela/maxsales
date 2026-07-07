import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { TrPipe } from '../core/i18n.service';
import { MoneyPipe } from '../core/money.pipe';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, TrPipe, MoneyPipe],
  template: `
    <div class="page">
      <div class="page-head"><div><h1>{{ 'reports' | tr }}</h1></div></div>

      @if (metrics) {
        <div class="grid cols-4">
          <div class="card kpi"><div class="label">{{ 'avg_deal' | tr }}</div><div class="value">{{ metrics.avg_deal_size | money: metrics.base_currency }}</div></div>
          <div class="card kpi"><div class="label">{{ 'avg_cycle' | tr }}</div><div class="value">{{ metrics.avg_sales_cycle_days ?? '—' }}</div></div>
          <div class="card kpi"><div class="label">{{ 'win_rate' | tr }}</div><div class="value">{{ metrics.win_rate ?? '—' }}%</div></div>
          <div class="card kpi"><div class="label">{{ 'won' | tr }} / {{ 'lost' | tr }}</div><div class="value">{{ metrics.won_deals }} / {{ metrics.lost_deals }}</div></div>
        </div>
      }

      <div class="grid cols-2 section">
        <div class="card">
          <div class="head-row">
            <h2>{{ 'sales' | tr }}</h2>
            <div class="inline">
              <select [(ngModel)]="groupBy" (ngModelChange)="loadSales()">
                <option value="owner">{{ 'by_owner' | tr }}</option>
                <option value="product">{{ 'by_product' | tr }}</option>
                <option value="country">{{ 'by_country' | tr }}</option>
                <option value="quarter">{{ 'by_quarter' | tr }}</option>
              </select>
              <button class="btn sm" (click)="exportSales()">⬇ {{ 'export_csv' | tr }}</button>
            </div>
          </div>
          @if (sales) {
            @for (r of sales.rows; track r.group) {
              <div class="rep-row">
                <div class="rep-name">{{ r.group }} <span class="muted">({{ r.deals }} {{ 'deals' | tr }})</span></div>
                <div class="bar-track"><div class="bar" [style.width.%]="width(r.value, sales.rows)"></div></div>
                <div class="rep-val">{{ r.value | money: sales.base_currency }}</div>
              </div>
            }
            @if (!sales.rows.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
          }
        </div>

        <div class="card">
          <div class="head-row"><h2>{{ 'funnel' | tr }}</h2></div>
          @if (funnel) {
            <table>
              <thead>
                <tr><th>{{ 'stage' | tr }}</th><th class="num">{{ 'reached' | tr }}</th><th class="num">{{ 'open' | tr }}</th><th class="num">{{ 'pipeline_value' | tr }}</th><th class="num">{{ 'conversion' | tr }}</th></tr>
              </thead>
              <tbody>
                @for (r of funnel.rows; track r.stage) {
                  <tr>
                    <td><strong>{{ r.stage }}</strong></td>
                    <td class="num">{{ r.reached }}</td>
                    <td class="num">{{ r.currently_open }}</td>
                    <td class="num">{{ r.open_value | money: funnel.base_currency }}</td>
                    <td class="num">
                      @if (r.conversion_to_next !== null) { <span class="badge blue">{{ r.conversion_to_next }}%</span> } @else { — }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="card">
          <div class="head-row">
            <h2>{{ 'loss_reasons' | tr }}</h2>
            <button class="btn sm" (click)="api.downloadCsv('reports/loss-reasons', {}, 'loss_reasons')">⬇ {{ 'export_csv' | tr }}</button>
          </div>
          @if (lossReasons) {
            @for (r of lossReasons.rows; track r.reason) {
              <div class="rep-row">
                <div class="rep-name">{{ r.reason }}</div>
                <div class="bar-track"><div class="bar red" [style.width.%]="widthCount(r.count, lossReasons.rows)"></div></div>
                <div class="rep-val">{{ r.count }}</div>
              </div>
            }
            @if (!lossReasons.rows.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
      .head-row h2 { margin: 0; }
      .rep-row { display: grid; grid-template-columns: minmax(120px, 200px) 1fr 110px; gap: 10px; align-items: center; padding: 7px 0; }
      .rep-name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
      .bar-track { background: #eef2f7; border-radius: 6px; height: 18px; }
      .bar { background: var(--primary); height: 100%; border-radius: 6px; min-width: 2px; }
      .bar.red { background: var(--red); }
      .rep-val { text-align: right; font-size: 13px; font-weight: 600; }
      @media (max-width: 700px) {
        .rep-row { grid-template-columns: minmax(80px, 120px) 1fr 86px; gap: 6px; }
        .rep-name, .rep-val { font-size: 12px; white-space: nowrap; }
      }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  api = inject(ApiService);

  groupBy = 'owner';
  metrics: any = null;
  sales: any = null;
  funnel: any = null;
  lossReasons: any = null;

  async ngOnInit(): Promise<void> {
    [this.metrics, this.funnel, this.lossReasons] = await Promise.all([
      this.api.get('reports/metrics'),
      this.api.get('reports/funnel'),
      this.api.get('reports/loss-reasons'),
    ]);
    await this.loadSales();
  }

  async loadSales(): Promise<void> {
    this.sales = await this.api.get('reports/sales', { group_by: this.groupBy });
  }

  exportSales(): void {
    this.api.downloadCsv('reports/sales', { group_by: this.groupBy }, `sales_by_${this.groupBy}`);
  }

  width(value: number, rows: any[]): number {
    const max = Math.max(...rows.map((r: any) => r.value), 1);
    return Math.max(2, (value / max) * 100);
  }

  widthCount(count: number, rows: any[]): number {
    const max = Math.max(...rows.map((r: any) => r.count), 1);
    return Math.max(2, (count / max) * 100);
  }
}
