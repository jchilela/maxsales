import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { MoneyPipe } from '../core/money.pipe';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/modal.component';
import { OpportunityFormComponent } from '../shared/opportunity-form.component';

@Component({
  selector: 'app-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CdkDrag, CdkDropList, TrPipe, MoneyPipe, ModalComponent, OpportunityFormComponent],
  template: `
    <div class="page" style="max-width: none">
      <div class="page-head">
        <div>
          <h1>{{ 'pipeline' | tr }}</h1>
          <div class="sub">{{ filtered().length }} {{ 'opportunities' | tr | lowercase }}</div>
        </div>
        @if (auth.canWrite) {
          <button class="btn primary" (click)="creating = true">+ {{ 'new' | tr }} {{ 'opportunity' | tr }}</button>
        }
      </div>

      <div class="toolbar">
        <select [(ngModel)]="fOwner">
          <option value="">{{ 'all_owners' | tr }}</option>
          @for (u of users; track u.id) { <option [value]="u.id">{{ u.full_name }}</option> }
        </select>
        <select [(ngModel)]="fLine">
          <option value="">{{ 'all_lines' | tr }}</option>
          @for (l of lines; track l) { <option [value]="l">{{ l }}</option> }
        </select>
        <select [(ngModel)]="fQuarter">
          <option value="">{{ 'all_quarters' | tr }}</option>
          @for (q of quarters; track q) { <option [value]="q">{{ q }}</option> }
        </select>
      </div>

      <div class="kanban">
        @for (s of boardStages; track s.id) {
          <div class="kanban-col">
            <div class="kanban-col-head">
              <span>{{ s.name }} <span class="muted">{{ colOpps(s.id).length }}</span></span>
              <span>{{ colTotal(s.id) | money: baseCurrency }}</span>
            </div>
            <div
              class="kanban-cards"
              cdkDropList
              [id]="'stage-' + s.id"
              [cdkDropListData]="s.id"
              [cdkDropListConnectedTo]="dropIds"
              (cdkDropListDropped)="onDrop($event)"
            >
              @for (o of colOpps(s.id); track o.id) {
                <div class="kanban-card" cdkDrag [cdkDragData]="o" [cdkDragDisabled]="!auth.canWrite">
                  <div class="title"><a [routerLink]="['/opportunities', o.id]">{{ o.name }}</a></div>
                  <div class="meta"><span>{{ o.account_name }}</span></div>
                  <div class="meta">
                    <strong>{{ o.amount | money: o.currency }}</strong>
                    <span>{{ o.expected_close_date | date: 'MMM d' }}</span>
                  </div>
                  <div class="meta">
                    <span>{{ o.owner_name }}</span>
                    <span [class.stale-tag]="o.is_stale">
                      {{ o.days_in_stage }}d @if (o.is_stale) { · {{ 'stale' | tr }} }
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- close-as-lost modal -->
      @if (losing) {
        <app-modal [title]="'mark_lost' | tr" (closed)="losing = null">
          <p>{{ losing.opp.name }}</p>
          <label>{{ 'loss_reason' | tr }} *</label>
          <input [(ngModel)]="lossReason" [placeholder]="'loss_reason_required' | tr" />
          <div class="modal-actions">
            <button class="btn" (click)="losing = null">{{ 'cancel' | tr }}</button>
            <button class="btn danger" [disabled]="!lossReason" (click)="confirmLost()">{{ 'mark_lost' | tr }}</button>
          </div>
        </app-modal>
      }

      <!-- close-as-won modal -->
      @if (winning) {
        <app-modal [title]="'mark_won' | tr" (closed)="winning = null">
          <p>{{ winning.opp.name }} — {{ winning.opp.amount | money: winning.opp.currency }}</p>
          <label class="inline"><input type="checkbox" [(ngModel)]="createProject" /> {{ 'create_project_q' | tr }}</label>
          <div class="modal-actions">
            <button class="btn" (click)="winning = null">{{ 'cancel' | tr }}</button>
            <button class="btn primary" (click)="confirmWon()">{{ 'mark_won' | tr }}</button>
          </div>
        </app-modal>
      }

      @if (creating) {
        <app-modal [title]="'opportunity' | tr" (closed)="creating = false">
          <app-opportunity-form (saved)="creating = false; load()" (cancelled)="creating = false" />
        </app-modal>
      }
    </div>
  `,
  styles: [`.stale-tag { color: var(--yellow); font-weight: 700; }`],
})
export class PipelineComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  stages: any[] = [];
  opps: any[] = [];
  users: any[] = [];
  fOwner = '';
  fLine = '';
  fQuarter = '';
  creating = false;
  losing: { opp: any; stageId: number } | null = null;
  winning: { opp: any; stageId: number } | null = null;
  lossReason = '';
  createProject = true;

  get baseCurrency(): string {
    return this.auth.org()?.base_currency || 'USD';
  }

  get boardStages(): any[] {
    return this.stages;
  }

  get dropIds(): string[] {
    return this.stages.map((s) => 'stage-' + s.id);
  }

  get lines(): string[] {
    return [...new Set(this.opps.map((o) => o.product_line).filter(Boolean))] as string[];
  }

  get quarters(): string[] {
    const qs = this.opps
      .filter((o) => o.expected_close_date)
      .map((o) => {
        const d = new Date(o.expected_close_date);
        return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
      });
    return [...new Set(qs)].sort();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
    this.users = await this.api.get('users');
  }

  async load(): Promise<void> {
    [this.stages, this.opps] = await Promise.all([
      this.api.get('stages'),
      this.api.get('opportunities'),
    ]);
  }

  filtered(): any[] {
    return this.opps.filter((o) => {
      if (this.fOwner && String(o.owner_id) !== this.fOwner) return false;
      if (this.fLine && o.product_line !== this.fLine) return false;
      if (this.fQuarter && o.expected_close_date) {
        const d = new Date(o.expected_close_date);
        if (`${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` !== this.fQuarter) return false;
      } else if (this.fQuarter && !o.expected_close_date) {
        return false;
      }
      return true;
    });
  }

  colOpps(stageId: number): any[] {
    return this.filtered().filter((o) => o.stage_id === stageId);
  }

  colTotal(stageId: number): number {
    // column totals are indicative: sums face values across currencies
    return this.colOpps(stageId).reduce((sum, o) => sum + (o.amount || 0), 0);
  }

  onDrop(event: CdkDragDrop<number>): void {
    const opp = event.item.data;
    const targetStageId = event.container.data;
    if (opp.stage_id === targetStageId) return;
    const stage = this.stages.find((s) => s.id === targetStageId);
    if (stage.is_lost) {
      this.lossReason = '';
      this.losing = { opp, stageId: targetStageId };
    } else if (stage.is_won) {
      this.createProject = true;
      this.winning = { opp, stageId: targetStageId };
    } else {
      this.move(opp, targetStageId, {});
    }
  }

  async move(opp: any, stageId: number, extra: any): Promise<void> {
    try {
      await this.api.post(`opportunities/${opp.id}/stage`, { stage_id: stageId, ...extra });
      this.toast.show(`${opp.name} → ${this.stages.find((s) => s.id === stageId)?.name}`);
    } catch (e) {
      this.toast.error(e);
    }
    await this.load();
  }

  confirmLost(): void {
    if (!this.losing) return;
    this.move(this.losing.opp, this.losing.stageId, { loss_reason: this.lossReason });
    this.losing = null;
  }

  confirmWon(): void {
    if (!this.winning) return;
    this.move(this.winning.opp, this.winning.stageId, { create_project: this.createProject });
    this.winning = null;
  }
}
