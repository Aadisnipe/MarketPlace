const pagination = require('../../src/utils/pagination');
const slugify = require('../../src/utils/slug');

describe('pagination utility', () => {
  test('applies defaults and parses valid query values', () => {
    expect(pagination({})).toEqual({ page: 1, limit: 20 });
    expect(pagination({ page: '4', limit: '25' })).toEqual({ page: 4, limit: 25 });
  });

  test.each([
    [{ page: '0' }, 'page'],
    [{ page: '-1' }, 'page'],
    [{ page: '1.5' }, 'page'],
    [{ page: '10001' }, 'page'],
    [{ limit: '51' }, 'limit'],
    [{ limit: ['5', '10'] }, 'limit'],
  ])('rejects invalid input %p', (query, field) => {
    expect(() => pagination(query)).toThrow(`${field} must`);
  });
});

describe('slugify utility', () => {
  test.each([
    ['  Caf\u00e9 & Tea  ', 'cafe-tea'],
    ['Phone Cases / Accessories', 'phone-cases-accessories'],
    ['', ''],
    [null, ''],
  ])('converts %p to %p', (value, expected) => {
    expect(slugify(value)).toBe(expected);
  });
});
