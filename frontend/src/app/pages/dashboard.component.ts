import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { TrPipe } from '../core/i18n.service';
import { MoneyPipe } from '../core/money.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TrPipe, MoneyPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'dashboard' | tr }}</h1>
          <div class="sub" *ngIf="d">
            {{ d.open_count }} {{ 'open_opps' | tr | lowercase }} ·
            <span [class.warn]="d.stale_count > 0">{{ d.stale_count }} {{ 'stale_deals' | tr }}</span>
          </div>
        </div>
      </div>

      @if (!d) { <div class="empty">{{ 'loading' | tr }}</div> }
      @if (d) {
        <div class="grid cols-4">
          <div class="card kpi">
            <div class="label">{{ 'pipeline_value' | tr }}</div>
            <div class="value">{{ d.pipeline_total | money: d.base_currency }}</div>
            <div class="hint">{{ 'forecast' | tr }}: {{ d.weighted_forecast | money: d.base_currency }}</div>
          </div>
          <div class="card kpi">
            <div class="label">{{ 'sales_quarter' | tr }}</div>
            <div class="value">{{ d.sales_this_quarter | money: d.base_currency }}</div>
            <div class="hint">
              {{ 'sales_month' | tr }}: {{ d.sales_this_month | money: d.base_currency }}
            </div>
          </div>
          <div class="card kpi">
            <div class="label">{{ 'target' | tr }} / {{ 'attainment' | tr }}</div>
            <div class="value">{{ d.quarter_attainment ?? '—' }}<span *ngIf="d.quarter_attainment !== null">%</span></div>
            <div class="progress green" style="margin-top:8px">
              <div [style.width.%]="min100(d.quarter_attainment || 0)"></div>
            </div>
            <div class="hint">{{ 'target' | tr }}: {{ d.quarter_target | money: d.base_currency }}</div>
          </div>
          <div class="card kpi">
            <div class="label">MRR / ARR</div>
            <div class="value">{{ d.mrr | money: d.base_currency }}</div>
            <div class="hint">ARR: {{ d.arr | money: d.base_currency }} · {{ 'win_rate' | tr }}: {{ d.win_rate ?? '—' }}%</div>
          </div>
        </div>

        <div class="grid cols-2 section">
          <div class="card">
            <h2>{{ 'pipeline_value' | tr }}</h2>
            @for (row of d.pipeline_by_stage; track row.stage) {
              <div class="stage-row">
                <div class="stage-name">{{ row.stage }} <span class="muted">({{ row.count }})</span></div>
                <div class="bar-track">
                  <div class="bar" [style.width.%]="barWidth(row.value)"></div>
                </div>
                <div class="stage-val">{{ row.value | money: d.base_currency }}</div>
              </div>
            }
          </div>

          <div class="card">
            <h2>{{ 'top_open' | tr }}</h2>
            @if (!d.top_open_opportunities.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (o of d.top_open_opportunities; track o.id) {
                <tr>
                  <td><a [routerLink]="['/opportunities', o.id]">{{ o.name }}</a><div class="muted">{{ o.account_name }}</div></td>
                  <td>{{ o.stage_name }}</td>
                  <td class="num">{{ o.amount | money: o.currency }}</td>
                </tr>
              }
            </table>
          </div>

          <div class="card">
            <h2>{{ 'overdue' | tr }}</h2>
            @if (!d.overdue_activities.length) { <div class="empty">✅ {{ 'no_results' | tr }}</div> }
            <table>
              @for (a of d.overdue_activities; track a.id) {
                <tr>
                  <td>{{ a.subject }}<div class="muted">{{ a.related_name }}</div></td>
                  <td class="num"><span class="badge red">{{ a.due_date | date: 'MMM d' }}</span></td>
                </tr>
              }
            </table>
          </div>

          <div class="card">
            <h2>{{ 'recently_closed' | tr }}</h2>
            @if (!d.recently_closed.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            <table>
              @for (o of d.recently_closed; track o.id) {
                <tr>
                  <td><a [routerLink]="['/opportunities', o.id]">{{ o.name }}</a><div class="muted">{{ o.account_name }}</div></td>
                  <td>
                    <span class="badge" [class.green]="o.status === 'won'" [class.red]="o.status === 'lost'">
                      {{ (o.status === 'won' ? 'won' : 'lost') | tr }}
                    </span>
                  </td>
                  <td class="num">{{ o.amount | money: o.currency }}</td>
                </tr>
              }
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .warn { color: var(--yellow); font-weight: 700; }
      .stage-row { display: grid; grid-template-columns: 170px 1fr 110px; gap: 10px; align-items: center; padding: 7px 0; }
      .stage-name { font-weight: 600; font-size: 13px; }
      .bar-track { background: #eef2f7; border-radius: 6px; height: 18px; }
      .bar { background: var(--primary); height: 100%; border-radius: 6px; min-width: 2px; }
      .stage-val { text-align: right; font-size: 13px; font-weight: 600; }
      table td { border-bottom: 1px solid var(--border); }
      @media (max-width: 700px) {
        .stage-row { grid-template-columns: 96px 1fr 86px; gap: 6px; }
        .stage-name, .stage-val { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  d: any = null;

  async ngOnInit(): Promise<void> {
    this.d = await this.api.get('dashboard');
  }

  min100(v: number): number {
    return Math.min(100, v);
  }

  barWidth(value: number): number {
    const max = Math.max(...this.d.pipeline_by_stage.map((r: any) => r.value), 1);
    return Math.max(2, (value / max) * 100);
  }
}
