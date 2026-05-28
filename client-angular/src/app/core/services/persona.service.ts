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
  /** Org / role line — long form used in the persona dropdown body.
      e.g. "Woodland Agency · Admin". Computed from orgName + role
      via the subtitleFor() helper below, but kept on the record as
      a static field so the dropdown template stays declarative. */
  subtitle: string;
  /** v1.65e2 — short role label rendered in the shell hero pill as
      "{name} · {role}". Independent from subtitle so the pill stays
      compact (subtitle includes the org name which would dwarf the
      pill). e.g. "Admin", "Supplier". */
  role: string;
  /** 2-letter avatar initials. */
  initials: string;
  /** Hex used to colour the avatar in the persona dropdown. */
  avatarColor: string;
  /** v1.65e6 — the person's org. Each persona belongs to a distinct
      org: Sarah → Woodland Agency, Beth → Ballpark, Ryan → Rocket
      Food. orgType mirrors `kind` for the foreseeable future but is
      kept separate so future "agency Admin who's also a sub-org
      member" cases don't require a kind change. */
  orgName: string;
  orgType: PersonaKind;
  /** v1.65e8 — real seeded org id from the orgs table, used by the
      settings page (/settings/organisation reads this to show the
      right org's record) and any future "this persona's org" lookup.
      Set for all three personas. */
  orgId?: string;
  /** For supplier personas — the supplier org id, used to build
      /suppliers/:id routes (Front + Store tabs target this).
      v1.65e8 — same as orgId for supplier kind; retained as an
      alias so existing call sites (supplier-detail routing) don't
      need to change. */
  supplierOrgId?: string;
  /** v1.65e2 — secondary location pill in the hero (e.g. "London").
      Supplier personas surface their city; agency / admin personas
      can leave it undefined. */
  location?: string;
}

/** v1.65dz — seeded persona list mirroring the p0015 mockup. The
    supplierOrgId on Rocket Food is the real seeded org id from
    server/src/db/seed.js so /suppliers/{id} resolves end-to-end. */
// v1.65e8 — real seeded org ids. Update these if your local DB
// re-rolls them. Confirmed via:
//   SELECT id, name, type FROM orgs WHERE name IN
//     ('Woodland Agency', 'Ballpark', 'Rocket Food');
const ORG_ID_WOODLAND   = 'b9025772-1723-4f95-a056-add54eebd100';
const ORG_ID_BALLPARK   = 'de4258e7-6694-4c76-b548-9ab958b4dda0';
const ORG_ID_ROCKETFOOD = '5488cde0-ba0d-48a2-a599-d00d04aa655e';

const PERSONAS: Persona[] = [
  {
    id: 'sarah-mitchell',
    kind: 'agency',
    name: 'Sarah Mitchell',
    orgName: 'Woodland Agency',
    orgType: 'agency',
    orgId: ORG_ID_WOODLAND,
    subtitle: 'Woodland Agency · Admin',
    role: 'Admin',
    initials: 'SM',
    avatarColor: '#ec1f6d',
    location: 'London',
  },
  {
    id: 'beth-pizey',
    kind: 'admin',
    name: 'Beth Pizey',
    orgName: 'Ballpark',
    orgType: 'admin',
    // v1.65e8 — Beth is now assigned to the Ballpark admin org
    // Liam created through the /ballpark-settings/orgs UI.
    orgId: ORG_ID_BALLPARK,
    subtitle: 'Ballpark · Admin',
    role: 'Admin',
    initials: 'BP',
    avatarColor: '#4f46e5',
  },
  {
    // v1.65e3 — Ryan Foster is the Admin at Rocket Food (the
    // supplier org). Persona kind stays 'supplier' because that
    // drives routing + UI (4-tab supplier-detail surface) — Ryan is
    // the person, Rocket Food is his org.
    id: 'rocket-food',
    kind: 'supplier',
    name: 'Ryan Foster',
    orgName: 'Rocket Food',
    orgType: 'supplier',
    orgId: ORG_ID_ROCKETFOOD,
    subtitle: 'Rocket Food · Admin',
    role: 'Admin',
    initials: 'RF',
    avatarColor: '#0f766e',
    location: 'London',
    // v1.65e1 — Rocket Food's seeded supplier org id (matches the
    // /suppliers/:id URL Liam shared). v1.65e8 — same as orgId now;
    // kept as an alias so supplier-detail routing doesn't need to
    // change.
    supplierOrgId: ORG_ID_ROCKETFOOD,
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
