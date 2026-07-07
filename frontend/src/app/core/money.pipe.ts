import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from './i18n.service';

@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value: number | null | undefined, currency?: string | null): string {
    if (value === null || value === undefined) return '—';
    const locale = this.i18n.lang() === 'pt' ? 'pt-PT' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency || ''} ${value.toLocaleString(locale)}`;
    }
  }
}
