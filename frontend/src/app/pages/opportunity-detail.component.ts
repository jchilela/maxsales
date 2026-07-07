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
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, MoneyPipe, ModalComponent, OpportunityFormComponent, TimelineComponent, ComposeComponent],
  template: `
    @if (o) {
      <div class="page">
        <div class="page-head">
          <div>
            <div class="sub"><a routerLink="/pipeline">{{ 'pipeline' | tr }}</a> /</div>
            <h1>{{ o.name }}</h1>
            <div class="sub">
              <a [routerLink]="['/accounts', o.account_id]">{{ o.account_name }}</a>
              · {{ o.owner_name }} · {{ o.primary_contact_name || '—' }}
              @if (o.is_stale) { <span class="badge yellow">{{ 'stale' | tr }} — {{ o.days_in_stage }} {{ 'days_in_stage' | tr }}</span> }
            </div>
          </div>
          <div class="inline">
            @if (auth.canWrite && o.status === 'open') { <button class="btn" (click)="editing = true">{{ 'edit' | tr }}</button> }
            <div class="card kpi" style="min-width: 190px">
              <div class="label">{{ 'amount' | tr }}</div>
              <div class="value">{{ o.amount | money: o.currency }}</div>
              <div class="hint">{{ 'weighted' | tr }}: {{ o.weighted_amount | money: o.currency }} ({{ o.probability }}%)</div>
            </div>
          </div>
        </div>

        <!-- stage progress -->
        <div class="card stagebar-card">
          <div class="stagebar">
            @for (s of openStages; track s.id) {
              <div
                class="chev"
                [class.done]="stageOrder(o.stage_id) > s.sort_order && o.status === 'open'"
                [class.current]="o.stage_id === s.id"
                [class.won-all]="o.status === 'won'"
                [class.clickable]="auth.canWrite && o.status === 'open'"
                (click)="auth.canWrite && o.status === 'open' && setStage(s)"
              >
                {{ s.name }}
              </div>
            }
            @if (o.status === 'won') { <div class="chev current won">✓ {{ 'won' | tr }}</div> }
            @if (o.status === 'lost') { <div class="chev current lostc">✕ {{ 'lost' | tr }} — {{ o.loss_reason }}</div> }
          </div>
          @if (auth.canWrite && o.status === 'open') {
            <div class="inline" style="margin-top: 12px">
              <button class="btn primary sm" (click)="winModal = true">{{ 'mark_won' | tr }}</button>
              <button class="btn danger sm" (click)="loseModal = true">{{ 'mark_lost' | tr }}</button>
              <button class="btn sm" (click)="compose = 'whatsapp'">💬 {{ 'send_whatsapp' | tr }}</button>
              <button class="btn sm" (click)="compose = 'email'">✉️ {{ 'send_email' | tr }}</button>
              <span class="muted">{{ 'next_step' | tr }}: {{ o.next_step || '—' }} · {{ 'close_date' | tr }}: {{ o.expected_close_date | date: 'MMM d, y' }}</span>
            </div>
          }
        </div>

        <div class="grid cols-2 section">
          <!-- line items -->
          <div class="card">
            <h2>{{ 'line_items' | tr }}</h2>
            <table>
              <thead>
                <tr><th>{{ 'product' | tr }}</th><th class="num">{{ 'quantity' | tr }}</th><th class="num">{{ 'unit_price' | tr }}</th><th class="num">{{ 'discount' | tr }}</th><th class="num">{{ 'total' | tr }}</th><th></th></tr>
              </thead>
              <tbody>
                @for (li of items; track $index) {
                  <tr>
                    <td>
                      <select [(ngModel)]="li.product_id" (ngModelChange)="productChosen(li)" [disabled]="!canEditItems">
                        @for (p of products; track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
                      </select>
                    </td>
                    <td class="num"><input class="mini" type="number" min="0" [(ngModel)]="li.quantity" [disabled]="!canEditItems" /></td>
                    <td class="num"><input class="mini" type="number" min="0" [(ngModel)]="li.unit_price" [disabled]="!canEditItems" /></td>
                    <td class="num"><input class="mini" type="number" min="0" max="100" [(ngModel)]="li.discount_pct" [disabled]="!canEditItems" /></td>
                    <td class="num"><strong>{{ liTotal(li) | money: o.currency }}</strong></td>
                    <td>@if (canEditItems) { <button class="btn sm danger" (click)="items.splice($index, 1)">✕</button> }</td>
                  </tr>
                }
                @if (!items.length) { <tr><td colspan="6"><div class="empty">{{ 'no_results' | tr }}</div></td></tr> }
              </tbody>
            </table>
            @if (canEditItems) {
              <div class="inline" style="margin-top: 10px">
                <button class="btn sm" (click)="addItem()">+ {{ 'add_item' | tr }}</button>
                <button class="btn primary sm" (click)="saveItems()">{{ 'save' | tr }}</button>
                <span class="spacer"></span>
                <strong>{{ 'total' | tr }}: {{ itemsTotal() | money: o.currency }}</strong>
              </div>
            }
          </div>

          <!-- details + history -->
          <div class="card">
            <h2>{{ 'opportunity' | tr }}</h2>
            <div class="detail-grid">
              <div><span class="muted">{{ 'source' | tr }}</span><div>{{ o.source ? (o.source | tr) : '—' }}</div></div>
              <div><span class="muted">{{ 'product_line' | tr }}</span><div>{{ o.product_line || '—' }}</div></div>
              <div><span class="muted">{{ 'competitors' | tr }}</span><div>{{ o.competitors || '—' }}</div></div>
              <div><span class="muted">{{ 'created' | tr }}</span><div>{{ o.created_at | date: 'MMM d, y' }}</div></div>
              <div><span class="muted">{{ 'last_activity' | tr }}</span><div>{{ o.last_activity_at ? (o.last_activity_at | date: 'MMM d, y') : '—' }}</div></div>
              <div><span class="muted">{{ 'days_in_stage' | tr }}</span><div>{{ o.days_in_stage }}</div></div>
            </div>

            <h3 class="section">{{ 'stage_history' | tr }}</h3>
            <table>
              @for (h of o.stage_history; track $index) {
                <tr>
                  <td>{{ h.from_stage || '·' }} → <strong>{{ h.to_stage }}</strong></td>
                  <td class="muted">{{ h.changed_by }}</td>
                  <td class="num muted">{{ h.changed_at | date: 'MMM d, HH:mm' }}</td>
                </tr>
              }
            </table>

            <h3 class="section">{{ 'audit_log' | tr }}</h3>
            <table>
              @for (r of audit; track r.id) {
                <tr>
                  <td><span class="badge gray">{{ r.action }}</span></td>
                  <td class="muted small">{{ describeChanges(r.changes) }}</td>
                  <td class="num muted">{{ r.user }}<br />{{ r.at | date: 'MMM d, HH:mm' }}</td>
                </tr>
              }
            </table>
          </div>
        </div>

        <div class="section">
          <app-timeline
            [activities]="o.activities"
            [related]="{ opportunity_id: o.id, account_id: o.account_id, contact_id: o.primary_contact_id }"
            (changed)="load()"
          />
        </div>

        @if (editing) {
          <app-modal [title]="'edit' | tr" (closed)="editing = false">
            <app-opportunity-form [opportunity]="o" (saved)="editing = false; load()" (cancelled)="editing = false" />
          </app-modal>
        }
        @if (loseModal) {
          <app-modal [title]="'mark_lost' | tr" (closed)="loseModal = false">
            <label>{{ 'loss_reason' | tr }} *</label>
            <input [(ngModel)]="lossReason" />
            <div class="modal-actions">
              <button class="btn" (click)="loseModal = false">{{ 'cancel' | tr }}</button>
              <button class="btn danger" [disabled]="!lossReason" (click)="closeAs(false)">{{ 'mark_lost' | tr }}</button>
            </div>
          </app-modal>
        }
        @if (winModal) {
          <app-modal [title]="'mark_won' | tr" (closed)="winModal = false">
            <label class="inline"><input type="checkbox" [(ngModel)]="createProject" /> {{ 'create_project_q' | tr }}</label>
            <div class="modal-actions">
              <button class="btn" (click)="winModal = false">{{ 'cancel' | tr }}</button>
              <button class="btn primary" (click)="closeAs(true)">{{ 'mark_won' | tr }}</button>
            </div>
          </app-modal>
        }
        @if (compose) {
          <app-compose
            [mode]="compose"
            [accountId]="o.account_id"
            [opportunityId]="o.id"
            [preselectContactId]="o.primary_contact_id"
            [topic]="o.name"
            (sent)="load()"
            (closed)="compose = null"
          />
        }
      </div>
    } @else {
      <div class="page"><div class="empty">{{ 'loading' | tr }}</div></div>
    }
  `,
  styles: [
    `
      .stagebar { display: flex; gap: 4px; flex-wrap: wrap; }
      .chev { padding: 8px 18px; background: #eef2f7; color: var(--muted); font-weight: 600; font-size: 12.5px;
              clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%); }
      .chev.done, .chev.won-all { background: #bfdbfe; color: #1e40af; }
      .chev.current { background: var(--primary); color: #fff; }
      .chev.won { background: var(--green); }
      .chev.lostc { background: var(--red); }
      .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; font-size: 13px; }
      .detail-grid .muted { font-size: 11.5px; text-transform: uppercase; }
      .mini { width: 76px; text-align: right; }
      .small { font-size: 12px; white-space: normal; max-width: 260px; }
    `,
  ],
})
export class OpportunityDetailComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  o: any = null;
  stages: any[] = [];
  products: any[] = [];
  items: any[] = [];
  audit: any[] = [];
  editing = false;
  loseModal = false;
  winModal = false;
  compose: 'whatsapp' | 'email' | null = null;
  lossReason = '';
  createProject = true;

  get openStages(): any[] {
    return this.stages.filter((s) => !s.is_won && !s.is_lost);
  }

  get canEditItems(): boolean {
    return this.auth.canWrite && this.o?.status === 'open';
  }

  ngOnInit(): void {
    this.route.params.subscribe(() => this.load());
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    [this.o, this.stages, this.products] = await Promise.all([
      this.api.get(`opportunities/${id}`),
      this.api.get('stages'),
      this.api.get('products'),
    ]);
    this.items = this.o.line_items.map((li: any) => ({ ...li }));
    this.audit = await this.api.get('audit', { entity_type: 'opportunity', entity_id: id });
  }

  stageOrder(stageId: number): number {
    return this.stages.find((s) => s.id === stageId)?.sort_order ?? 0;
  }

  async setStage(s: any): Promise<void> {
    if (s.id === this.o.stage_id) return;
    try {
      await this.api.post(`opportunities/${this.o.id}/stage`, { stage_id: s.id });
      this.toast.show(`→ ${s.name}`);
    } catch (e) {
      this.toast.error(e);
    }
    await this.load();
  }

  async closeAs(won: boolean): Promise<void> {
    const stage = this.stages.find((s) => (won ? s.is_won : s.is_lost));
    if (!stage) return;
    try {
      const res = await this.api.post(`opportunities/${this.o.id}/stage`, {
        stage_id: stage.id,
        loss_reason: won ? null : this.lossReason,
        create_project: won ? this.createProject : false,
      });
      this.toast.show(won ? '🎉 Closed Won' : 'Closed Lost');
      if (res.created?.project_id) this.toast.show('Delivery project created', 'info');
    } catch (e) {
      this.toast.error(e);
    }
    this.loseModal = this.winModal = false;
    await this.load();
  }

  addItem(): void {
    const p = this.products[0];
    if (!p) return;
    this.items.push({ product_id: p.id, quantity: 1, unit_price: p.unit_price, discount_pct: 0 });
  }

  productChosen(li: any): void {
    const p = this.products.find((x) => x.id === li.product_id);
    if (p) li.unit_price = p.unit_price;
  }

  liTotal(li: any): number {
    return li.quantity * li.unit_price * (1 - li.discount_pct / 100);
  }

  itemsTotal(): number {
    return this.items.reduce((s, li) => s + this.liTotal(li), 0);
  }

  async saveItems(): Promise<void> {
    try {
      await this.api.put(
        `opportunities/${this.o.id}/line-items`,
        this.items.map((li) => ({
          product_id: li.product_id, quantity: li.quantity,
          unit_price: li.unit_price, discount_pct: li.discount_pct,
        }))
      );
      this.toast.show('Saved');
      await this.load();
    } catch (e) {
      this.toast.error(e);
    }
  }

  describeChanges(changes: any): string {
    if (!changes) return '';
    return Object.entries(changes)
      .map(([k, v]: [string, any]) => `${k}: ${v.old ?? '—'} → ${v.new ?? '—'}`)
      .join(' · ');
  }
}
