import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { requiresOrgGuard } from './requires-org.guard';
import { AuthService } from './auth.service';

// Functional-guard pattern (see admin.guard.spec): runInInjectionContext +
// provideRouter([]), AuthService stubbed at the signal surface the guard reads.

function runGuard(isLoggedIn: boolean, hasActiveOrg: boolean): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { isLoggedIn: () => isLoggedIn, hasActiveOrg: () => hasActiveOrg },
      },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    requiresOrgGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

describe('requiresOrgGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('passes a signed-in user with an active org', () => {
    expect(runGuard(true, true)).toBe(true);
  });

  it('redirects a signed-out user to /login', () => {
    const result = runGuard(false, false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });

  it('redirects a signed-in but orgless user to /onboarding', () => {
    const result = runGuard(true, false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/onboarding');
  });
});
