import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Coachmark {
  id: string;
  page: string;
  name: string;
  description: string | null;
  tail: 'up' | 'down';
  isActive: boolean;
  sortOrder: number;
}

interface CoachmarkRow {
  id: string; page: string; name: string;
  description: string | null; tail: 'up' | 'down';
  is_active: boolean; sort_order: number;
}

function toCoachmark(r: CoachmarkRow): Coachmark {
  return {
    id: r.id, page: r.page, name: r.name,
    description: r.description, tail: r.tail ?? 'up',
    isActive: r.is_active, sortOrder: r.sort_order ?? 0,
  };
}

/** Coachmarks = admin-editable help bubbles. The app RESOLVES one on render
 *  (register-if-missing with a code default); ballpark admins list + tweak. */
@Injectable({ providedIn: 'root' })
export class CoachmarkService {
  private readonly api = inject(ApiService);

  resolve(page: string, name: string, description: string | null, tail?: 'up' | 'down'): Observable<Coachmark> {
    return this.api
      .post<CoachmarkRow>('/api/coachmarks/resolve', { page, name, description, tail })
      .pipe(map(toCoachmark));
  }

  list(): Observable<Coachmark[]> {
    return this.api.get<CoachmarkRow[]>('/api/coachmarks').pipe(map((rs) => rs.map(toCoachmark)));
  }

  update(id: string, patch: { description?: string | null; isActive?: boolean; tail?: 'up' | 'down' }): Observable<Coachmark> {
    return this.api.patch<CoachmarkRow>(`/api/coachmarks/${id}`, patch).pipe(map(toCoachmark));
  }
}
