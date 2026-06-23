import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { ballparkAdminGuard } from './ballpark-admin.guard';
import { AuthService, Role } from './auth.service';

function runGuard(role: Role | null): boolean | UrlTree {
  TestBed.resetTestingModule(); // several runs per `it` below
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { role: () => role } }],
  });
  return TestBed.runInInjectionContext(() =>
    ballparkAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

describe('ballparkAdminGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('passes ballpark_admin', () => {
    expect(runGuard('ballpark_admin')).toBe(true);
  });

  it('bounces org admins to /home (org-level admin is not platform admin)', () => {
    expect(String(runGuard('agency_admin'))).toBe('/home');
    expect(String(runGuard('supplier_admin'))).toBe('/home');
  });

  it('bounces members and signed-out to /home', () => {
    expect(String(runGuard('agency_member'))).toBe('/home');
    expect(String(runGuard(null))).toBe('/home');
  });
});
