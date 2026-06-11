/** Pull the API's { error } message out of an HttpErrorResponse-ish unknown.
 *  Extracted from team.component when onboarding became the second consumer
 *  (Extract Before Duplicate). */
export function errorDetail(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const inner = (e as { error: unknown }).error;
    if (inner && typeof inner === 'object' && 'error' in inner) {
      return String((inner as { error: unknown }).error);
    }
  }
  return 'Request failed';
}
