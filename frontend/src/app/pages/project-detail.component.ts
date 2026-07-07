import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TrPipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { TimelineComponent } from '../shared/timeline.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TrPipe, TimelineComponent],
  template: `
    @if (p) {
      <div class="page">
        <div class="page-head">
          <div>
            <div class="sub"><a routerLink="/projects">{{ 'projects' | tr }}</a> /</div>
            <h1><span class="dot {{ p.health }}"></span> {{ p.name }}</h1>
            <div class="sub">
              <a [routerLink]="['/accounts', p.account_id]">{{ p.account_name }}</a>
              · {{ 'manager' | tr }}: {{ p.manager_name || '—' }}
              @if (p.opportunity_id) { · <a [routerLink]="['/opportunities', p.opportunity_id]">{{ 'opportunity' | tr }} #{{ p.opportunity_id }}</a> }
            </div>
          </div>
        </div>

        <div class="grid cols-2">
          <div class="card">
            <h2>{{ 'status' | tr }}</h2>
            <div class="form-row">
              <div>
                <label>{{ 'status' | tr }}</label>
                <select [(ngModel)]="p.status" [disabled]="!auth.canWrite">
                  <option value="planning">{{ 'planning' | tr }}</option>
                  <option value="in_progress">{{ 'in_progress' | tr }}</option>
                  <option value="blocked">{{ 'blocked' | tr }}</option>
                  <option value="delivered">{{ 'delivered' | tr }}</option>
                  <option value="closed">{{ 'closed' | tr }}</option>
                </select>
              </div>
              <div>
                <label>{{ 'health' | tr }}</label>
                <select [(ngModel)]="p.health" [disabled]="!auth.canWrite">
                  <option value="green">🟢 Green</option>
                  <option value="yellow">🟡 Yellow</option>
                  <option value="red">🔴 Red</option>
                </select>
              </div>
              <div><label>{{ 'start_date' | tr }}</label><input type="date" [(ngModel)]="p.start_date" [disabled]="!auth.canWrite" /></div>
              <div><label>{{ 'end_date' | tr }}</label><input type="date" [(ngModel)]="p.end_date" [disabled]="!auth.canWrite" /></div>
            </div>
            <label>{{ 'progress' | tr }}: {{ p.percent_complete }}%</label>
            <input type="range" min="0" max="100" step="5" [(ngModel)]="p.percent_complete" [disabled]="!auth.canWrite" />
            <div class="progress green"><div [style.width.%]="p.percent_complete"></div></div>
            @if (auth.canWrite) {
              <div class="modal-actions"><button class="btn primary" (click)="save()">{{ 'save' | tr }}</button></div>
            }
          </div>

          <div class="card">
            <h2>{{ 'milestones' | tr }}</h2>
            @for (m of p.milestones; track $index) {
              <div class="ms-row">
                <input type="checkbox" [(ngModel)]="m.is_done" [disabled]="!auth.canWrite" />
                <input [(ngModel)]="m.name" [disabled]="!auth.canWrite" />
                <input type="date" [(ngModel)]="m.due_date" [disabled]="!auth.canWrite" style="width: 150px" />
                @if (auth.canWrite) { <button class="btn sm danger" (click)="p.milestones.splice($index, 1)">✕</button> }
              </div>
            }
            @if (!p.milestones.length) { <div class="empty">{{ 'no_results' | tr }}</div> }
            @if (auth.canWrite) {
              <div class="inline" style="margin-top: 10px">
                <button class="btn sm" (click)="addMilestone()">+ {{ 'add_milestone' | tr }}</button>
                <button class="btn primary sm" (click)="saveMilestones()">{{ 'save' | tr }}</button>
              </div>
            }
          </div>
        </div>

        <div class="section">
          <app-timeline [activities]="p.activities" [related]="{ project_id: p.id, account_id: p.account_id }" (changed)="load()" />
        </div>
      </div>
    } @else {
      <div class="page"><div class="empty">{{ 'loading' | tr }}</div></div>
    }
  `,
  styles: [`.ms-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; } .ms-row input[type='checkbox'] { flex-shrink: 0; }`],
})
export class ProjectDetailComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  p: any = null;

  ngOnInit(): void {
    this.route.params.subscribe(() => this.load());
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    this.p = await this.api.get(`projects/${id}`);
  }

  async save(): Promise<void> {
    try {
      await this.api.put(`projects/${this.p.id}`, {
        name: this.p.name, account_id: this.p.account_id, sale_id: this.p.sale_id,
        opportunity_id: this.p.opportunity_id, manager_id: this.p.manager_id,
        status: this.p.status, start_date: this.p.start_date || null,
        end_date: this.p.end_date || null, percent_complete: this.p.percent_complete,
        health: this.p.health,
      });
      this.toast.show('Saved');
      await this.load();
    } catch (e) {
      this.toast.error(e);
    }
  }

  addMilestone(): void {
    this.p.milestones.push({ name: '', due_date: null, is_done: false });
  }

  async saveMilestones(): Promise<void> {
    try {
      await this.api.put(
        `projects/${this.p.id}/milestones`,
        this.p.milestones
          .filter((m: any) => m.name)
          .map((m: any) => ({ name: m.name, due_date: m.due_date || null, is_done: m.is_done }))
      );
      this.toast.show('Saved');
      await this.load();
    } catch (e) {
      this.toast.error(e);
    }
  }
}
