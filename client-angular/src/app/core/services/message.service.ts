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
}
