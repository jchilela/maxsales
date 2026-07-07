import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_URL } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private params(query?: Record<string, any>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  get<T = any>(path: string, query?: Record<string, any>): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${API_URL}/${path}`, { params: this.params(query) }));
  }

  getText(path: string, query?: Record<string, any>): Promise<string> {
    return firstValueFrom(
      this.http.get(`${API_URL}/${path}`, { params: this.params(query), responseType: 'text' })
    );
  }

  post<T = any>(path: string, body: any, query?: Record<string, any>): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${API_URL}/${path}`, body, { params: this.params(query) })
    );
  }

  put<T = any>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${API_URL}/${path}`, body));
  }

  delete(path: string): Promise<any> {
    return firstValueFrom(this.http.delete(`${API_URL}/${path}`));
  }

  /** Download a CSV report through the authenticated client. */
  async downloadCsv(path: string, query: Record<string, any>, filename: string): Promise<void> {
    const text = await this.getText(path, { ...query, format: 'csv' });
    const blob = new Blob([text], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
