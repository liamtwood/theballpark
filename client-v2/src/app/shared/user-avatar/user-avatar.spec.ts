import { deriveInitials } from './user-avatar.component';

describe('deriveInitials', () => {
  it('takes first + last initials from a two-part name', () => {
    expect(deriveInitials('Sarah Mitchell', null)).toBe('SM');
  });

  it('takes first + LAST initials from a three-part name', () => {
    expect(deriveInitials('Sarah Jane Mitchell', null)).toBe('SM');
  });

  it('takes the first two letters of a single name', () => {
    expect(deriveInitials('Sarah', null)).toBe('SA');
  });

  it('survives surrounding and internal extra whitespace', () => {
    expect(deriveInitials('  sarah   mitchell  ', null)).toBe('SM');
  });

  it('falls back to the email first letter when no name', () => {
    expect(deriveInitials(null, 'alex@example.com')).toBe('A');
  });

  it('prefers name over email when both exist', () => {
    expect(deriveInitials('Sarah Mitchell', 'alex@example.com')).toBe('SM');
  });

  it('returns ? when neither name nor email exists', () => {
    expect(deriveInitials(null, null)).toBe('?');
  });
});
