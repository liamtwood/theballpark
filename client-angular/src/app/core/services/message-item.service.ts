import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

/**
 * v1.65cv (p0008) — client-side service for the message_items lifecycle.
 *
 * Reads:
 *   getByMessage(id)            — list message_items on one thread.
 *
 * Writes:
 *   agentReply(messageId, body) — POST /api/messages/:id/reply
 *                                 body: { text?, item_actions?[], next_action_by? }
 *   publicReply(token, body)    — POST /api/brief/:token/reply
 *   publicGet(token)            — GET  /api/brief/:token
 *   publicHolding(token, until) — POST /api/brief/:token/holding
 *
 * Server-side every endpoint funnels through transitionItem so the
 * audit log stays consistent regardless of who acted.
 */

export interface MessageItemRow {
  id: string;
  message_id: string;
  item_id?: string | null;
  name: string;
  description?: string | null;
  price?: number | null;          // legacy column (pre-p0008)
  price_ref?: number | null;
  price_current?: number | null;
  unit?: string | null;
  status: string;
  adjusted_by?: 'agent' | 'supplier' | null;
  decline_reason?: string | null;
  decline_note?: string | null;
  next_action_by?: string | null;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export interface MessageItemAction {
  message_item_id: string;
  action: 'accept' | 'decline' | 'adjust' | 'quote' | 'pay' | 'holding';
  reason_code?: string;
  note?: string;
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
}

export interface ReplyPayload {
  text?: string;
  item_actions?: MessageItemAction[];
  next_action_by?: string | null;
  user_id?: string;
}

export interface BriefResponse {
  message: any;
  thread: any;
  messages: any[];
  items: MessageItemRow[];
  brief_url: string;
}

@Injectable({ providedIn: 'root' })
export class MessageItemService {
  constructor(private api: ApiService) {}

  getByMessage(messageId: string): Observable<MessageItemRow[]> {
    return this.api.get<MessageItemRow[]>(`/messages/${messageId}/items`);
  }

  agentReply(messageId: string, body: ReplyPayload): Observable<any> {
    return this.api.post<any>(`/messages/${messageId}/reply`, body);
  }

  publicGet(token: string): Observable<BriefResponse> {
    return this.api.get<BriefResponse>(`/brief/${token}`);
  }

  publicReply(token: string, body: ReplyPayload): Observable<any> {
    return this.api.post<any>(`/brief/${token}/reply`, body);
  }

  publicHolding(token: string, nextActionBy: string, text?: string): Observable<any> {
    return this.api.post<any>(`/brief/${token}/holding`, {
      next_action_by: nextActionBy, text,
    });
  }
}
