import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService, TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from './modal.component';

interface Template {
  key: string;
  en: string;
  pt: string;
}

const TEMPLATES: Template[] = [
  {
    key: 'tpl_follow_up',
    en: 'Hello {name}, just following up on our conversation about {topic}. Is there anything I can clarify to help you move forward? — {user}',
    pt: 'Olá {name}, venho fazer o seguimento da nossa conversa sobre {topic}. Há algo que possa esclarecer para avançarmos? — {user}',
  },
  {
    key: 'tpl_proposal',
    en: 'Hello {name}, I sent over our proposal for {topic}. Happy to walk you through it whenever suits you. — {user}',
    pt: 'Olá {name}, enviei a nossa proposta para {topic}. Com todo o gosto apresento os detalhes quando lhe for conveniente. — {user}',
  },
  {
    key: 'tpl_meeting',
    en: 'Hello {name}, could we schedule a short call this week to discuss {topic}? Let me know what time works for you. — {user}',
    pt: 'Olá {name}, podemos agendar uma breve chamada esta semana para falar sobre {topic}? Diga-me que horário lhe convém. — {user}',
  },
];

/** Compose-and-send modal for WhatsApp and email follow-ups.
 * Logs the message as an activity; when no API credentials are configured on
 * the server it opens a wa.me / mailto: link so the user sends from their own
 * WhatsApp number / mail client with one click. */
@Component({
  selector: 'app-compose',
  standalone: true,
  imports: [CommonModule, FormsModule, TrPipe, ModalComponent],
  template: `
    <app-modal [title]="(mode === 'whatsapp' ? 'send_whatsapp' : 'send_email') | tr" (closed)="closed.emit()">
      <label>{{ 'recipient' | tr }}</label>
      <select [(ngModel)]="contactId" (ngModelChange)="onContact()">
        @for (c of contacts; track c.id) {
          <option [ngValue]="c.id">{{ c.name }} — {{ mode === 'whatsapp' ? (c.whatsapp || c.phone || '✕') : (c.email || '✕') }}</option>
        }
        <option [ngValue]="null">{{ 'custom_recipient' | tr }}</option>
      </select>

      <label>{{ mode === 'whatsapp' ? ('whatsapp' | tr) : ('email' | tr) }} *</label>
      <input [(ngModel)]="to" [placeholder]="mode === 'whatsapp' ? '+2449…' : 'name@company.com'" />

      @if (mode === 'email') {
        <label>{{ 'subject' | tr }} *</label>
        <input [(ngModel)]="subject" />
      }

      <label>{{ 'template' | tr }}</label>
      <select [ngModel]="''" (ngModelChange)="applyTemplate($event)">
        <option value="">—</option>
        @for (t of templates; track t.key) { <option [value]="t.key">{{ t.key | tr }}</option> }
      </select>

      <label>{{ 'message' | tr }} *</label>
      <textarea [(ngModel)]="message" rows="6"></textarea>

      @if (mode === 'whatsapp') { <p class="muted hint-line">{{ 'wa_hint' | tr }}</p> }

      <div class="modal-actions">
        <button class="btn" (click)="closed.emit()">{{ 'cancel' | tr }}</button>
        <button class="btn primary" [disabled]="busy || !to || !message.trim() || (mode === 'email' && !subject.trim())" (click)="send()">
          {{ (mode === 'whatsapp' ? 'send_whatsapp' : 'send_email') | tr }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`.hint-line { font-size: 12px; margin: 8px 0 0; }`],
})
export class ComposeComponent implements OnInit {
  @Input({ required: true }) mode: 'whatsapp' | 'email' = 'whatsapp';
  @Input() accountId: number | null = null;
  @Input() opportunityId: number | null = null;
  @Input() projectId: number | null = null;
  @Input() preselectContactId: number | null = null;
  /** Used to fill template placeholders, e.g. the opportunity or account name. */
  @Input() topic = '';
  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<void>();

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private toast = inject(ToastService);

  contacts: any[] = [];
  contactId: number | null = null;
  to = '';
  subject = '';
  message = '';
  busy = false;
  templates = TEMPLATES;

  async ngOnInit(): Promise<void> {
    this.contacts = await this.api.get('contacts', this.accountId ? { account_id: this.accountId } : {});
    this.contactId =
      this.preselectContactId ?? (this.contacts.find((c) => this.channelOf(c)) || this.contacts[0])?.id ?? null;
    this.onContact();
    if (this.mode === 'email' && this.topic) this.subject = this.topic;
  }

  private channelOf(c: any): string | null {
    return this.mode === 'whatsapp' ? c.whatsapp || c.phone : c.email;
  }

  onContact(): void {
    const c = this.contacts.find((x) => x.id === this.contactId);
    this.to = (c && this.channelOf(c)) || '';
  }

  applyTemplate(key: string): void {
    const t = this.templates.find((x) => x.key === key);
    if (!t) return;
    const c = this.contacts.find((x) => x.id === this.contactId);
    const firstName = (c?.name || '').split(' ')[0] || '';
    this.message = (this.i18n.lang() === 'pt' ? t.pt : t.en)
      .replace('{name}', firstName)
      .replace('{topic}', this.topic || (this.i18n.lang() === 'pt' ? 'a nossa colaboração' : 'our collaboration'))
      .replace('{user}', this.auth.user()?.full_name || '');
  }

  async send(): Promise<void> {
    this.busy = true;
    try {
      const res = await this.api.post(`messages/${this.mode}`, {
        contact_id: this.contactId,
        to: this.to,
        subject: this.mode === 'email' ? this.subject : null,
        message: this.message,
        account_id: this.accountId,
        opportunity_id: this.opportunityId,
        project_id: this.projectId,
      });
      if (res.link) {
        window.open(res.link, '_blank');
        this.toast.show(this.i18n.t('sent_link_logged'), 'info');
      } else {
        this.toast.show(this.i18n.t('sent_logged'));
      }
      this.sent.emit();
      this.closed.emit();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy = false;
    }
  }
}
