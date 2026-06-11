import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

// Functional-guard pattern: guards call inject(), so they must execute inside
// TestBed.runInInjectionContext. AuthService is stubbed at the signal surface
// the guard reads (isLoggedIn) — no HTTP, no real session.

function runGuard(isLoggedIn: boolean): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isLoggedIn: () => isLoggedIn } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as boolean | UrlTree;
}

describe('authGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('passes a signed-in user through', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('redirects a signed-out user to /login', () => {
    const result = runGuard(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });
});
