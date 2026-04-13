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
  created_at: string;
  category_name?: string;
  subcategory_name?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<FeedbackEntry[]>('/feedback'); }
  create(data: Partial<FeedbackEntry>) { return this.api.post<FeedbackEntry>('/feedback', data); }
}
