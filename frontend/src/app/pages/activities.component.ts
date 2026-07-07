import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ListState } from '../core/list-state';
import { ToastService } from '../core/toast.service';
import { ACTIVITY_ICONS } from '../shared/timeline.component';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>{{ 'activities' | tr }}</h1><div class="sub">{{ ls.count(filtered) }} {{ 'total' | tr | lowercase }}</div></div>
      </div>

      <div class="toolbar">
        <input [placeholder]="'filter' | tr" [(ngModel)]="ls.search" (ngModelChange)="ls.page = 1" />
        <select [(ngModel)]="fType">
          <option value="">{{ 'type' | tr }}: —</option>
          <option value="call">{{ 'call' | tr }}</option>
          <option value="meeting">{{ 'meeting' | tr }}</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="task">{{ 'task' | tr }}</option>
          <option value="note">{{ 'note' | tr }}</option>
        </select>
        <label class="inline" style="margin: 0"><input type="checkbox" [(ngModel)]="openOnly" /> {{ 'open' | tr }}</label>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ 'type' | tr }}</th>
              <th (click)="ls.sortBy('subject')">{{ 'subject' | tr }}</th>
              <th (click)="ls.sortBy('related_name')">{{ 'related_to' | tr }}</th>
              <th (click)="ls.sortBy('owner_name')">{{ 'owner' | tr }}</th>
              <th (click)="ls.sortBy('due_date')">{{ 'due_date' | tr }}</th>
              <th>{{ 'status' | tr }}</th>
            </tr>
          </thead>
          <tbody>
            @for (a of ls.pageOf(filtered); track a.id) {
              <tr>
                <td>{{ icon(a.type) }} {{ a.type | tr }}</td>
                <td><strong>{{ a.subject }}</strong></td>
                <td>
                  @if (a.related_type === 'opportunity') { <a [routerLink]="['/opportunities', a.related_id]">{{ a.related_name }}</a> }
                  @else if (a.related_type === 'project') { <a [routerLink]="['/projects', a.related_id]">{{ a.related_name }}</a> }
                  @else if (a.related_type === 'account') { <a [routerLink]="['/accounts', a.related_id]">{{ a.related_name }}</a> }
                  @else { {{ a.related_name || '—' }} }
                </td>
                <td>{{ a.owner_name }}</td>
                <td>
                  @if (a.due_date) {
                    <span class="badge" [class.red]="isOverdue(a)" [class.gray]="!isOverdue(a)">{{ a.due_date | date: 'MMM d, HH:mm' }}</span>
                  } @else { — }
                </td>
                <td>
                  @if (a.is_done) { <span class="badge green">✓ {{ 'done' | tr }}</span> }
                  @else if (auth.canWrite) { <button class="btn sm" (click)="markDone(a)">{{ 'done' | tr }}</button> }
                  @else { <span class="badge gray">{{ 'open' | tr }}</span> }
                </td>
              </tr>
            }
            @if (!ls.count(filtered)) { <tr><td colspan="6"><div class="empty">{{ 'no_results' | tr }}</div></td></tr> }
          </tbody>
        </table>
        <div class="pager">
          <span>{{ 'page' | tr }} {{ ls.page }} {{ 'of' | tr }} {{ ls.pages(filtered) }}</span>
          <button class="btn sm" [disabled]="ls.page <= 1" (click)="ls.page = ls.page - 1">‹</button>
          <button class="btn sm" [disabled]="ls.page >= ls.pages(filtered)" (click)="ls.page = ls.page + 1">›</button>
        </div>
      </div>
    </div>
  `,
})
export class ActivitiesComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  rows: any[] = [];
  ls = new ListState<any>();
  fType = '';
  openOnly = false;

  get filtered(): any[] {
    return this.rows.filter(
      (a) => (!this.fType || a.type === this.fType) && (!this.openOnly || !a.is_done)
    );
  }

  async ngOnInit(): Promise<void> {
    this.rows = await this.api.get('activities');
  }

  icon(type: string): string {
    return ACTIVITY_ICONS[type] || '📌';
  }

  isOverdue(a: any): boolean {
    return !!a.due_date && !a.is_done && new Date(a.due_date) < new Date();
  }

  async markDone(a: any): Promise<void> {
    try {
      await this.api.put(`activities/${a.id}`, { ...a, is_done: true });
      a.is_done = true;
      this.toast.show('Done ✓');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
