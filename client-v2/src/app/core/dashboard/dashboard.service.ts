import { Injectable, inject } from '@angular/core';
import { HttpResourceRef } from '@angular/common/http';
import { ApiService } from '../api.service';

/** pV2-04 — /api/dashboard/* response shapes (server: routes/dashboard.js). */
export interface DashboardStats {
  active: number;
  openBriefs: number;
  awaiting: number;
  credits: number;
}

export interface UpcomingProject {
  id: string;
  name: string;
  clientName: string | null;
  venueName: string | null;
  /** Legacy free-text date ("25–30 May 2026") — displayed verbatim. */
  dateLabel: string;
}

export interface ActivityEvent {
  id: string;
  kind: 'project_created' | 'supplier_saved' | 'reply_received';
  actorName: string | null;
  subject: string | null;
  /** ISO-8601 — render with timeAgo(). */
  at: string;
}

export interface CreditsBalance {
  balance: number;
  monthlyAllowance: number;
}

export interface SavedSupplier {
  id: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

/** Typed httpResource factories for the home sections. Each card creates its
 *  own resource in its field initializer (injection context flows through). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  stats(): HttpResourceRef<DashboardStats | undefined> {
    return this.api.getResource<DashboardStats>('/api/dashboard/stats');
  }

  upcoming(limit = 3): HttpResourceRef<UpcomingProject[] | undefined> {
    return this.api.getResource<UpcomingProject[]>(`/api/dashboard/upcoming?limit=${limit}`);
  }

  activity(limit = 10): HttpResourceRef<ActivityEvent[] | undefined> {
    return this.api.getResource<ActivityEvent[]>(`/api/dashboard/activity?limit=${limit}`);
  }

  credits(): HttpResourceRef<CreditsBalance | undefined> {
    return this.api.getResource<CreditsBalance>('/api/dashboard/credits');
  }

  savedSuppliers(limit = 4): HttpResourceRef<SavedSupplier[] | undefined> {
    return this.api.getResource<SavedSupplier[]>(`/api/dashboard/saved-suppliers?limit=${limit}`);
  }
}

/** "2h ago" / "3d ago" relative label from an ISO timestamp. Pure — tested. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
