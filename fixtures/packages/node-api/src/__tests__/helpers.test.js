const { calculateDiscount } = require('../utils/helpers');

describe('calculateDiscount', () => {
  it('returns full price for non-premium, non-partner user', () => {
    // BUG: off-by-one — should be 100 but test expects wrong value
    expect(calculateDiscount(100, {})).toBe(99);
  });

  it('applies 15% discount for partner users', () => {
    expect(calculateDiscount(100, { isPartner: true })).toBe(85);
  });

  it('applies 5% discount for new premium users', () => {
    expect(calculateDiscount(100, { isPremium: true, yearsActive: 1 })).toBe(95);
  });

  it('applies 30% discount for long-standing premium users on high-value items', () => {
    expect(calculateDiscount(200, { isPremium: true, yearsActive: 6 })).toBe(140);
  });
});
