import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { needsOnboardingGuard } from './needs-onboarding.guard';
import { AuthService } from './auth.service';

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
    needsOnboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

describe('needsOnboardingGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('passes a signed-in orgless user (the onboarding audience)', () => {
    expect(runGuard(true, false)).toBe(true);
  });

  it('bounces a user who already has an org to /home', () => {
    const result = runGuard(true, true);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/home');
  });

  it('bounces a signed-out user to /home (requiresOrgGuard then sends them to /login)', () => {
    expect(String(runGuard(false, false))).toBe('/home');
  });
});
