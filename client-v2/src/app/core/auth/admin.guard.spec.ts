import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService, Role } from './auth.service';

// adminGuard keys off can(role, 'org.invite_member') — practically the two
// org-admin roles. Each role is run through the real permissions matrix; only
// AuthService is stubbed.

function runGuard(role: Role | null): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { role: () => role } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

describe('adminGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('passes agency_admin', () => {
    expect(runGuard('agency_admin')).toBe(true);
  });

  it('passes supplier_admin', () => {
    expect(runGuard('supplier_admin')).toBe(true);
  });

  it('bounces agency_member to /home', () => {
    const result = runGuard('agency_member');
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/home');
  });

  it('bounces supplier_member to /home', () => {
    expect(String(runGuard('supplier_member'))).toBe('/home');
  });

  it('bounces ballpark_admin to /home (cross-org admin ≠ org admin)', () => {
    expect(String(runGuard('ballpark_admin'))).toBe('/home');
  });

  it('bounces a signed-out user to /home', () => {
    expect(String(runGuard(null))).toBe('/home');
  });
});
