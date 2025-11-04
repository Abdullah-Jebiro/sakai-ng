import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface PaginatedList<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  totalPages: number;
}

export interface UserDto {
  id: number;
  identifier: string;
  displayName: string;
  isActive: boolean;
  created: string;
  lastModified: string;
  lastFetchAt?: string;
  lastFetchStatus?: string;
}

export interface DataLogDto {
  id: number;
  timestamp: string;
  success: boolean;
  usageGB?: number;
  expiration?: string;
  online?: boolean;
  packageGB?: number;
  serviceGB?: number;
  lastInvoice?: string;
  errorCategory?: string;
  errorMessage?: string;
  payloadJson: string;
}

export interface FetchAllResponse {
  processed: number;
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private http = inject(HttpClient);
  // TODO: externalize
  private base = (window as any)["API_BASE"] || 'http://localhost:5000';

  getUsers(query = '', page = 1, pageSize = 10) {
    let params = new HttpParams().set('pageNumber', page).set('pageSize', pageSize);
    if (query) params = params.set('query', query);
    return this.http.get<PaginatedList<UserDto>>(`${this.base}/api/Users/`, { params });
  }

  getUser(id: number) {
    return this.http.get<UserDto>(`${this.base}/api/Users/${id}`);
  }

  createUser(payload: { identifier: string; displayName: string; password: string; isActive: boolean }) {
    return this.http.post<{ id: number }>(`${this.base}/api/Users/`, payload);
  }

  updateUser(id: number, payload: { identifier: string; displayName: string; isActive: boolean }) {
    return this.http.put<void>(`${this.base}/api/Users/${id}`, { id, ...payload });
  }

  updatePassword(id: number, password: string) {
    return this.http.put<void>(`${this.base}/api/Users/${id}/password`, { id, password });
  }

  deleteUser(id: number) {
    return this.http.delete<void>(`${this.base}/api/Users/${id}`);
  }

  fetchNow(id: number) {
    return this.http.post<void>(`${this.base}/api/Users/${id}/fetch`, {});
  }

  fetchAllActive(maxConcurrency?: number) {
    let params = new HttpParams();
    if (maxConcurrency) params = params.set('maxConcurrency', maxConcurrency);
    return this.http.post<FetchAllResponse>(`${this.base}/api/Users/fetch-all`, {}, { params });
  }

  getUserLatestStats(id: number) {
    return this.http.get<DataLogDto | null>(`${this.base}/api/Users/${id}/stats/latest`);
  }

  getUserLogs(id: number, options: { from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    let params = new HttpParams();
    if (options.from) params = params.set('from', options.from);
    if (options.to) params = params.set('to', options.to);
    params = params.set('page', options.page ?? 1);
    params = params.set('pageSize', options.pageSize ?? 20);
    return this.http.get<PaginatedList<DataLogDto>>(`${this.base}/api/Users/${id}/stats/logs`, { params });
  }

  exportUserLogs(id: number, format: 'json' | 'csv', options: { from?: string; to?: string } = {}) {
    let params = new HttpParams().set('format', format);
    if (options.from) params = params.set('from', options.from);
    if (options.to) params = params.set('to', options.to);
    return this.http.get(`${this.base}/api/Users/${id}/stats/export`, {
      params,
      responseType: 'blob'
    });
  }
}
