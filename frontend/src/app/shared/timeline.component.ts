import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';

export const ACTIVITY_ICONS: Record<string, string> = {
  call: '📞', meeting: '🗓️', email: '✉️', whatsapp: '💬', task: '☑️', note: '📝',
};

/** Activity timeline with an inline quick-log form. Reused on account,
 * contact, opportunity and project detail pages. */
@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, TrPipe],
  template: `
    <div class="card">
      <h2>{{ 'timeline' | tr }}</h2>
      @if (auth.canWrite) {
        <form class="quick" (ngSubmit)="log()">
          <select [(ngModel)]="draft.type" name="type">
            <option value="call">{{ 'call' | tr }}</option>
            <option value="meeting">{{ 'meeting' | tr }}</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="task">{{ 'task' | tr }}</option>
            <option value="note">{{ 'note' | tr }}</option>
          </select>
          <input [(ngModel)]="draft.subject" name="subject" [placeholder]="'subject' | tr" required />
          <input type="datetime-local" [(ngModel)]="draft.due_date" name="due" />
          <button class="btn primary" [disabled]="!draft.subject">{{ 'log_activity' | tr }}</button>
        </form>
      }
      @if (!activities.length) {
        <div class="empty">{{ 'no_activities' | tr }}</div>
      } @else {
        <ul class="tl">
          @for (a of activities; track a.id) {
            <li>
              <div class="ico">{{ icon(a.type) }}</div>
              <div style="flex:1">
                <div>
                  <strong [class.done-line]="a.is_done && a.type === 'task'">{{ a.subject }}</strong>
                  @if (a.due_date && !a.is_done) {
                    <span class="badge" [class.red]="isOverdue(a)" [class.gray]="!isOverdue(a)">
                      {{ a.due_date | date: 'MMM d, HH:mm' }}
                    </span>
                  }
                </div>
                @if (a.description) { <div class="muted">{{ a.description }}</div> }
                <div class="when">{{ a.owner_name }} · {{ a.created_at | date: 'MMM d, y HH:mm' }}</div>
              </div>
              @if (auth.canWrite && (a.type === 'task' || a.due_date) && !a.is_done) {
                <button class="btn sm" (click)="markDone(a)">✓ {{ 'done' | tr }}</button>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .quick { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
      .quick select { width: 130px; }
      .quick input[name='subject'] { flex: 1; min-width: 160px; }
      .quick input[type='datetime-local'] { width: 190px; }
      @media (max-width: 700px) {
        .quick select, .quick input[type='datetime-local'] { flex: 1 1 45%; width: auto; min-width: 0; }
        .quick input[name='subject'] { flex: 1 1 100%; }
        .quick .btn { flex: 1 1 100%; justify-content: center; }
      }
      .badge { margin-left: 8px; }
      .done-line { text-decoration: line-through; color: var(--muted); }
    `,
  ],
})
export class TimelineComponent {
  @Input() activities: any[] = [];
  /** Related-record foreign keys applied to newly logged activities. */
  @Input() related: Record<string, number | null> = {};
  @Output() changed = new EventEmitter<void>();

  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);

  draft: any = { type: 'call', subject: '', due_date: null };

  icon(type: string): string {
    return ACTIVITY_ICONS[type] || '📌';
  }

  isOverdue(a: any): boolean {
    return !!a.due_date && !a.is_done && new Date(a.due_date) < new Date();
  }

  async log(): Promise<void> {
    try {
      await this.api.post('activities', {
        ...this.draft,
        due_date: this.draft.due_date ? new Date(this.draft.due_date).toISOString() : null,
        ...this.related,
      });
      this.draft = { type: 'call', subject: '', due_date: null };
      this.toast.show('Activity logged');
      this.changed.emit();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async markDone(a: any): Promise<void> {
    try {
      await this.api.put(`activities/${a.id}`, { ...a, is_done: true });
      this.changed.emit();
    } catch (e) {
      this.toast.error(e);
    }
  }
}
