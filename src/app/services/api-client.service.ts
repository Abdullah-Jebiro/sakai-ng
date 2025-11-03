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
}
