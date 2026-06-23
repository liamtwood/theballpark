import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Message } from '../../models';

@Injectable({ providedIn: 'root' })
export class MessageService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Message[]>('/messages'); }
  getById(id: string) { return this.api.get<Message>(`/messages/${id}`); }
  create(data: any) { return this.api.post<Message>('/messages', data); }
  update(id: string, data: any) { return this.api.put<Message>(`/messages/${id}`, data); }
  patch(id: string, data: any) { return this.api.patch<Message>(`/messages/${id}`, data); }
  delete(id: string) { return this.api.delete<Message>(`/messages/${id}`); }
  getByProject(projectId: string) { return this.api.get<Message[]>(`/messages?project_id=${projectId}`); }
  getAllByOrg(orgId: string) { return this.api.get<Message[]>(`/messages?org_id=${orgId}`); }
  /** v1.65ea (p0015) — supplier-side inbox feed. Returns messages
      where supplier_org_id matches, joined with the sending agency
      identity so the supplier UI can render "From: Agency". */
  getAllBySupplier(supplierOrgId: string) {
    return this.api.get<Message[]>(`/messages?supplier_org_id=${supplierOrgId}`);
  }

  /** Canonical thread grouping key — one supplier + category + project is
      one thread. Single source of truth for the key so the inbox's
      buildThreads() and any unread-count consumer agree on what a "thread"
      is (v1.67d). */
  static threadKey(m: any): string {
    return (m.supplier_org_id || 'unknown')
      + '_' + (m.category_id || '')
      + '_' + (m.project_id || '');
  }

  /** Count of distinct threads with at least one unread inbound message.
      Drives the supplier home Inbox tile badge. Mirrors the inbox's
      per-thread `unread` rule (inbound && !read). */
  static countUnreadThreads(msgs: any[]): number {
    const keys = new Set<string>();
    for (const m of msgs || []) {
      if (m.direction === 'inbound' && !m.read) keys.add(MessageService.threadKey(m));
    }
    return keys.size;
  }
}
