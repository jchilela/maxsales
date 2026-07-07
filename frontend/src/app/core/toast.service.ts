import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, type: Toast['type'] = 'success'): void {
    const t = { id: ++this.seq, type, text };
    this.toasts.update((list) => [...list, t]);
    setTimeout(() => this.dismiss(t.id), 4500);
  }

  error(err: any, fallback = 'Something went wrong'): void {
    const detail = err?.error?.detail;
    this.show(typeof detail === 'string' ? detail : fallback, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
