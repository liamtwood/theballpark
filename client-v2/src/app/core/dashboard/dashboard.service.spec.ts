import { timeAgo } from './dashboard.service';

describe('timeAgo', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('says "just now" under a minute', () => {
    expect(timeAgo('2026-06-11T11:59:40Z', now)).toBe('just now');
  });

  it('renders minutes, hours, days, weeks', () => {
    expect(timeAgo('2026-06-11T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-06-11T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-06-09T12:00:00Z', now)).toBe('2d ago');
    expect(timeAgo('2026-05-28T12:00:00Z', now)).toBe('2w ago');
  });

  it('renders months and years', () => {
    expect(timeAgo('2026-02-11T12:00:00Z', now)).toBe('4mo ago');
    expect(timeAgo('2024-06-01T12:00:00Z', now)).toBe('2y ago');
  });

  it('clamps future timestamps to "just now" (clock skew)', () => {
    expect(timeAgo('2026-06-11T12:05:00Z', now)).toBe('just now');
  });

  it('returns empty for unparseable input', () => {
    expect(timeAgo('not-a-date', now)).toBe('');
  });
});
