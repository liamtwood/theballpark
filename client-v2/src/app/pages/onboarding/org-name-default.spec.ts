import { defaultOrgName } from './org-name-default';

describe('defaultOrgName', () => {
  it('takes the first name + agency suffix from a spaced display name', () => {
    expect(defaultOrgName('Liam Wood', 'liam@x.com', 'agency')).toBe("Liam's Agency");
  });

  it('swaps the suffix for supplier', () => {
    expect(defaultOrgName('Liam Wood', 'liam@x.com', 'supplier')).toBe("Liam's Supplier");
  });

  it('uses the whole display name when it has no space', () => {
    expect(defaultOrgName('Liam', null, 'agency')).toBe("Liam's Agency");
  });

  it('collapses extra whitespace before splitting', () => {
    expect(defaultOrgName('  Liam   Wood  ', null, 'agency')).toBe("Liam's Agency");
  });

  it('falls back to the email local-part when no display name', () => {
    expect(defaultOrgName(null, 'liam.wood@gmail.com', 'agency')).toBe("liam.wood's Agency");
  });

  it('email fallback follows the selected type too', () => {
    expect(defaultOrgName('', 'liam.wood@gmail.com', 'supplier')).toBe("liam.wood's Supplier");
  });

  it('returns empty when neither name nor email exists', () => {
    expect(defaultOrgName(null, null, 'agency')).toBe('');
  });
});
