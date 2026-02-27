const { formatCurrency } = require('../utils/format');

describe('formatCurrency', () => {
  it('formats a number as USD currency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats whole numbers with .00', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });
});
