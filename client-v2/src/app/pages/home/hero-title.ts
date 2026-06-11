import { SessionUser } from '../../core/auth/auth.service';
import { PageConfigPayload } from '../../core/config/page-config.types';

/** First name for the greeting: first token of the display name, else the
 *  email local-part, else "there". Pure — unit tested. */
export function firstName(user: Pick<SessionUser, 'displayName' | 'email'> | null): string {
  const name = user?.displayName?.trim();
  if (name) return name.split(/\s+/)[0];
  const local = user?.email?.split('@')[0];
  return local || 'there';
}

/** The configured hero title (p0023's modes, v2 shape). Pure — unit tested.
 *  - greeting → "Welcome back, {firstName}"
 *  - username → full display name (email fallback)
 *  - orgName  → active org name (greeting fallback when somehow absent)
 *  - fixed    → the configured text (greeting fallback when empty) */
export function heroTitle(
  mode: NonNullable<PageConfigPayload['heroTitleMode']>,
  user: Pick<SessionUser, 'displayName' | 'email' | 'activeOrgName'> | null,
  fixedText: string
): string {
  switch (mode) {
    case 'username':
      return user?.displayName ?? user?.email ?? 'there';
    case 'orgName':
      return user?.activeOrgName ?? `Welcome back, ${firstName(user)}`;
    case 'fixed':
      return fixedText.trim() || `Welcome back, ${firstName(user)}`;
    case 'greeting':
      return `Welcome back, ${firstName(user)}`;
  }
}
