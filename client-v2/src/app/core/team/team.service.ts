import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';

/** A row in Settings → Team. userId is non-null in practice (invites create a
 *  stub users row), but stays nullable for forward-compat with email-only
 *  invite storage. */
export interface TeamMember {
  userId: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  status: 'active' | 'invited' | 'suspended';
  invitedAt: string | null;
  joinedAt: string | null;
}

/** Payload for POST /api/team/invite. */
export interface InvitePayload {
  email: string;
  displayName?: string;
  jobTitle?: string;
  isAdmin: boolean;
}

/** Team management API (admin-gated server-side; see routes/team.js). */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly api = inject(ApiService);

  list(): Observable<TeamMember[]> {
    return this.api.get<TeamMember[]>('/api/team');
  }
  invite(body: InvitePayload): Observable<TeamMember> {
    return this.api.post<TeamMember>('/api/team/invite', body);
  }
  setAdmin(userId: string, isAdmin: boolean): Observable<TeamMember> {
    return this.api.patch<TeamMember>(`/api/team/${userId}`, { isAdmin });
  }
  setStatus(userId: string, suspend: boolean): Observable<TeamMember> {
    return this.api.patch<TeamMember>(`/api/team/${userId}/status`, { suspend });
  }
  remove(userId: string): Observable<void> {
    return this.api.delete<void>(`/api/team/${userId}`);
  }
}
