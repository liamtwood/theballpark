/**
 * v1.65dz (p0015) — Persona switcher state.
 *
 * Real users in production belong to ONE org and see only their persona.
 * Dev / admin sessions want to swap personas (agency ↔ supplier ↔
 * platform admin) to validate cross-surface flows without re-logging in.
 *
 * This service is the single source of truth for the active persona.
 * Consumers (top-nav, message-inbox viewer prop, future supplier shell)
 * subscribe to `active$` and re-render when it flips.
 *
 * Gating: `canSwitch` returns true only in non-production OR for users
 * with the admin role. The switcher dropdown hides itself otherwise.
 *
 * Hard-coded persona list for now (matches the p0015 mockup). When real
 * multi-persona auth lands, populate from the server's session payload.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PersonaKind = 'agency' | 'admin' | 'supplier';

export interface Persona {
  /** Stable id used in localStorage + the URL query-param fallback. */
  id: string;
  kind: PersonaKind;
  /** Human display name (e.g. "Sarah Mitchell"). */
  name: string;
  /** Org / role line (e.g. "Woodland Agency · Admin"). */
  subtitle: string;
  /** 2-letter avatar initials. */
  initials: string;
  /** Hex used to colour the avatar in the persona dropdown. */
  avatarColor: string;
  /** For supplier personas — the supplier org id, used to build
      /suppliers/:id routes (Front + Store tabs target this). */
  supplierOrgId?: string;
}

/** v1.65dz — seeded persona list mirroring the p0015 mockup. The
    supplierOrgId on Rocket Food is the real seeded org id from
    server/src/db/seed.js so /suppliers/{id} resolves end-to-end. */
const PERSONAS: Persona[] = [
  {
    id: 'sarah-mitchell',
    kind: 'agency',
    name: 'Sarah Mitchell',
    subtitle: 'Woodland Agency · Admin',
    initials: 'SM',
    avatarColor: '#ec1f6d',
  },
  {
    id: 'beth-pizey',
    kind: 'admin',
    name: 'Beth Pizey',
    subtitle: 'Ballpark · Admin',
    initials: 'BP',
    avatarColor: '#4f46e5',
  },
  {
    id: 'rocket-food',
    kind: 'supplier',
    name: 'Rocket Food',
    subtitle: 'Supplier · London',
    initials: 'RF',
    avatarColor: '#0f766e',
    // Populated by the seed; the supplier-detail route resolves on
    // this id. If your local seed uses a different id, override it in
    // localStorage:  bp-persona-supplier-id
    supplierOrgId: 'rocket-food-london',
  },
];

const LS_KEY = 'bp-active-persona';

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly _active = new BehaviorSubject<Persona>(this.loadInitial());
  readonly active$ = this._active.asObservable();

  /** True when the user is allowed to flip personas. Dev builds always
      allow it; production gates on admin role (TODO when auth lands). */
  get canSwitch(): boolean {
    if (!environment.production) return true;
    // TODO(v1.65dz): wire to OrgService.currentUser.role === 'admin'
    // once real auth lands. For now production hides the switcher.
    return false;
  }

  /** All personas the active user is allowed to inhabit. Dev/admin sees
      everyone; in production a real user would only see their own. */
  list(): Persona[] {
    return this.canSwitch ? PERSONAS : [this._active.value];
  }

  get active(): Persona { return this._active.value; }

  set(personaId: string): void {
    const found = PERSONAS.find(p => p.id === personaId);
    if (!found || found.id === this._active.value.id) return;
    this._active.next(found);
    try { localStorage.setItem(LS_KEY, found.id); } catch { /* ignore */ }
  }

  /** v1.65dz — convenience for components that branch on persona kind. */
  isAgency():   boolean { return this._active.value.kind === 'agency';   }
  isAdmin():    boolean { return this._active.value.kind === 'admin';    }
  isSupplier(): boolean { return this._active.value.kind === 'supplier'; }

  /** Load the persona from localStorage, falling back to the agency
      persona on first visit. Invalid ids fall through to the default. */
  private loadInitial(): Persona {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const found = PERSONAS.find(p => p.id === stored);
        if (found) return found;
      }
    } catch { /* ignore */ }
    return PERSONAS[0];
  }
}
