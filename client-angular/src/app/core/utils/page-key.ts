import { Router, ActivatedRouteSnapshot } from '@angular/router';

/**
 * Stable per-page settings key derived from the active route's CONFIG path
 * pattern (e.g. `/suppliers/:id`) rather than the resolved URL
 * (`/suppliers/5488…`). Pages with route params then share ONE per-page
 * settings entry + a clean name, instead of a separate one (and a raw UUID
 * label) per concrete id.
 *
 * Both the app-shell hero and the page-config drawer use this so their keys
 * always match. Falls back to the resolved path for param-less routes.
 */
export function pagePatternKey(router: Router): string {
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  const segments: string[] = [];
  while (route) {
    const p = route.routeConfig?.path;
    if (p) segments.push(p);
    route = route.firstChild;
  }
  const key = '/' + segments.filter(Boolean).join('/');
  return key === '/' ? (router.url.split('?')[0] || '/') : key;
}
