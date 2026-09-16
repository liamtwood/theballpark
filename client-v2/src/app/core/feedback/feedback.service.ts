import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';

/** An area category (Projects, Marketplace, Inbox, …) for the Report dialog. */
export interface FeedbackCategory {
  id: string;
  name: string;
}

/** The safe, user-supplied fields for reporting an issue. submitted_by +
 *  environment are set server-side from the JWT/config — never sent here. */
export interface ReportIssueInput {
  type: 'bug' | 'enhancement' | 'question';
  area_category_id?: string | null;
  title: string;
  description?: string | null;
  page_url?: string | null;
  pages?: string[];
}

/** A row in the signed-in user's "My issues" table. */
export interface MyIssue {
  id: string;
  ref: string | null;
  type: string;
  title: string;
  status: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  area_name: string | null;
}

/** The v2 feedback surface — report an issue + read your own. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly api = inject(ApiService);

  report(input: ReportIssueInput): Observable<MyIssue> {
    return this.api.post<MyIssue>('/api/feedback', input);
  }

  /** The signed-in user's own issues (JWT-scoped server-side). */
  myIssues(): Observable<MyIssue[]> {
    return this.api.get<MyIssue[]>('/api/feedback/mine');
  }

  /** Area categories for the "Page / area" picker. */
  areaCategories(): Observable<FeedbackCategory[]> {
    return this.api.get<FeedbackCategory[]>('/api/feedback/categories?namespace=area');
  }
}
