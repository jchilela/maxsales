import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ListState } from '../core/list-state';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/modal.component';

const STATUSES = ['planning', 'in_progress', 'blocked', 'delivered', 'closed'];

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, ModalComponent],
  template: `
    <div class="page" [style.max-width]="view === 'board' ? 'none' : null">
      <div class="page-head">
        <div><h1>{{ 'projects' | tr }}</h1><div class="sub">{{ rows.length }} {{ 'total' | tr | lowercase }}</div></div>
        <div class="inline">
          <button class="btn" [class.primary]="view === 'list'" (click)="view = 'list'">{{ 'list' | tr }}</button>
          <button class="btn" [class.primary]="view === 'board'" (click)="view = 'board'">{{ 'board' | tr }}</button>
          @if (auth.canWrite) { <button class="btn primary" (click)="openForm(null)">+ {{ 'new' | tr }}</button> }
        </div>
      </div>

      @if (view === 'list') {
        <div class="toolbar"><input [placeholder]="'filter' | tr" [(ngModel)]="ls.search" (ngModelChange)="ls.page = 1" /></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th (click)="ls.sortBy('name')">{{ 'name' | tr }}</th>
                <th (click)="ls.sortBy('account_name')">{{ 'account' | tr }}</th>
                <th (click)="ls.sortBy('manager_name')">{{ 'manager' | tr }}</th>
                <th (click)="ls.sortBy('status')">{{ 'status' | tr }}</th>
                <th (click)="ls.sortBy('health')">{{ 'health' | tr }}</th>
                <th class="num" (click)="ls.sortBy('percent_complete')">{{ 'progress' | tr }}</th>
                <th>{{ 'milestones' | tr }}</th>
                <th (click)="ls.sortBy('end_date')">{{ 'end_date' | tr }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of ls.pageOf(rows); track p.id) {
                <tr>
                  <td><a [routerLink]="['/projects', p.id]"><strong>{{ p.name }}</strong></a></td>
                  <td><a [routerLink]="['/accounts', p.account_id]">{{ p.account_name }}</a></td>
                  <td>{{ p.manager_name }}</td>
                  <td><span class="badge gray">{{ p.status | tr }}</span></td>
                  <td><span class="dot {{ p.health }}"></span></td>
                  <td class="num" style="min-width: 130px">
                    <div class="progress"><div [style.width.%]="p.percent_complete"></div></div>
                    <span class="muted">{{ p.percent_complete }}%</span>
                  </td>
                  <td>{{ p.milestones_done }}/{{ p.milestone_count }}</td>
                  <td>{{ p.end_date | date: 'MMM d, y' }}</td>
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
      } @else {
        <div class="kanban">
          @for (st of statuses; track st) {
            <div class="kanban-col">
              <div class="kanban-col-head"><span>{{ st | tr }}</span><span class="muted">{{ byStatus(st).length }}</span></div>
              <div class="kanban-cards">
                @for (p of byStatus(st); track p.id) {
                  <div class="kanban-card">
                    <div class="title"><span class="dot {{ p.health }}"></span> <a [routerLink]="['/projects', p.id]">{{ p.name }}</a></div>
                    <div class="meta"><span>{{ p.account_name }}</span><span>{{ p.percent_complete }}%</span></div>
                    <div class="progress" style="margin-top: 6px"><div [style.width.%]="p.percent_complete"></div></div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (form) {
        <app-modal [title]="'new' | tr" (closed)="form = null">
          <form (ngSubmit)="save()">
            <label>{{ 'name' | tr }} *</label>
            <input [(ngModel)]="form.name" name="name" required />
            <div class="form-row">
              <div>
                <label>{{ 'account' | tr }} *</label>
                <select [(ngModel)]="form.account_id" name="account" required>
                  @for (a of accounts; track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                </select>
              </div>
              <div>
                <label>{{ 'manager' | tr }}</label>
                <select [(ngModel)]="form.manager_id" name="manager">
                  <option [ngValue]="null">—</option>
                  @for (u of users; track u.id) { <option [ngValue]="u.id">{{ u.full_name }}</option> }
                </select>
              </div>
              <div><label>{{ 'start_date' | tr }}</label><input type="date" [(ngModel)]="form.start_date" name="sd" /></div>
              <div><label>{{ 'end_date' | tr }}</label><input type="date" [(ngModel)]="form.end_date" name="ed" /></div>
            </div>
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
export class ProjectsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  rows: any[] = [];
  accounts: any[] = [];
  users: any[] = [];
  ls = new ListState<any>();
  view: 'list' | 'board' = 'list';
  statuses = STATUSES;
  form: any = null;

  async ngOnInit(): Promise<void> {
    this.rows = await this.api.get('projects');
  }

  byStatus(st: string): any[] {
    return this.rows.filter((p) => p.status === st);
  }

  async openForm(p: any): Promise<void> {
    [this.accounts, this.users] = await Promise.all([this.api.get('accounts'), this.api.get('users')]);
    this.form = { name: '', account_id: this.accounts[0]?.id ?? null, manager_id: null, start_date: null, end_date: null, status: 'planning', percent_complete: 0, health: 'green' };
  }

  async save(): Promise<void> {
    try {
      await this.api.post('projects', this.form);
      this.toast.show('Saved');
      this.form = null;
      this.rows = await this.api.get('projects');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
