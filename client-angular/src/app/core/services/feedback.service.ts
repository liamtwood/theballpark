import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface FeedbackEntry {
  id: string;
  category_id?: string;
  subcategory_id?: string;
  title: string;
  notes?: string;
  page_url?: string;
  submitted_by?: string;
  environment?: string;
  owner?: string;
  due_date?: string;
  event_date?: string;
  parent_id?: string;
  agenda?: string[];
  completed?: boolean;
  type?: string;
  meeting_time?: string;
  description?: string;
  status?: string;
  object_type?: 'issue' | 'folder' | 'note';
  created_at: string;
  category_name?: string;
  subcategory_name?: string;
  children?: FeedbackEntry[];
}

export interface TeamMember {
  name: string;
  initials: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Liam', initials: 'LW' },
  { name: 'Beth', initials: 'BP' },
  { name: 'Megan', initials: 'MG' },
  { name: 'James', initials: 'JC' }
];

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  constructor(private api: ApiService) {}
  getAll(objectType?: string) {
    const qs = objectType ? `?object_type=${objectType}` : '';
    return this.api.get<FeedbackEntry[]>(`/feedback${qs}`);
  }
  getById(id: string) { return this.api.get<FeedbackEntry>(`/feedback/${id}`); }
  getToday() { return this.api.get<FeedbackEntry>('/feedback/today'); }
  getFolders() { return this.api.get<FeedbackEntry[]>('/feedback/folders'); }
  getIssues(folderId?: string) {
    const qs = folderId ? `?folder_id=${folderId}` : '';
    return this.api.get<FeedbackEntry[]>(`/feedback/issues${qs}`);
  }
  getChildren(parentId: string) { return this.api.get<FeedbackEntry[]>(`/feedback/${parentId}/children`); }
  create(data: Partial<FeedbackEntry>) { return this.api.post<FeedbackEntry>('/feedback', data); }
  patch(id: string, data: any) { return this.api.patch<FeedbackEntry>(`/feedback/${id}`, data); }
  remove(id: string) { return this.api.delete<any>(`/feedback/${id}`); }
}
