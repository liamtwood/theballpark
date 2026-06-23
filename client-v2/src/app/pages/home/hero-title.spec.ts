import { firstName, heroTitle } from './hero-title';

const liam = { displayName: 'Liam Wood', email: 'liam@x.com', activeOrgName: "Liam's Agency" };

describe('firstName', () => {
  it('takes the first token of the display name', () => {
    expect(firstName(liam)).toBe('Liam');
  });

  it('falls back to the email local-part', () => {
    expect(firstName({ displayName: null, email: 'sarah.m@x.com' })).toBe('sarah.m');
  });

  it('falls back to "there" with neither', () => {
    expect(firstName(null)).toBe('there');
    expect(firstName({ displayName: '  ', email: '' })).toBe('there');
  });
});

describe('heroTitle', () => {
  it('greeting mode', () => {
    expect(heroTitle('greeting', liam, '')).toBe('Welcome back, Liam');
  });

  it('username mode (email fallback)', () => {
    expect(heroTitle('username', liam, '')).toBe('Liam Wood');
    expect(heroTitle('username', { displayName: null, email: 'x@y.com', activeOrgName: null }, '')).toBe('x@y.com');
  });

  it('orgName mode (greeting fallback when orgless)', () => {
    expect(heroTitle('orgName', liam, '')).toBe("Liam's Agency");
    expect(heroTitle('orgName', { ...liam, activeOrgName: null }, '')).toBe('Welcome back, Liam');
  });

  it('fixed mode uses the configured text, falling back to the greeting when empty', () => {
    expect(heroTitle('fixed', liam, 'Mission Control')).toBe('Mission Control');
    expect(heroTitle('fixed', liam, '   ')).toBe('Welcome back, Liam');
  });

  it('survives a signed-out edge (guards prevent it; function tolerates it)', () => {
    expect(heroTitle('greeting', null, '')).toBe('Welcome back, there');
  });
});
