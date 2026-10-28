import { describe, expect, it } from 'vitest';
import {
  calculateAuctionPrize,
  calculateDividendAllocation,
  calculateExpectedTotal,
  calculateGrossMonthlyChit,
  calculateOutstandingBalance,
  formatCurrency,
  getCollectionSummary,
} from './finance';

describe('financial formulas', () => {
  it('calculates gross monthly chit amount', () => {
    expect(calculateGrossMonthlyChit(20, 5000)).toBe(100000);
  });

  it('calculates expected total contributions', () => {
    expect(calculateExpectedTotal(20, 5000, 20)).toBe(2000000);
  });

  it('calculates outstanding balances without negative values', () => {
    expect(calculateOutstandingBalance(25000, 15000)).toBe(10000);
    expect(calculateOutstandingBalance(5000, 8000)).toBe(0);
  });

  it('calculates net auction prize', () => {
    expect(calculateAuctionPrize(100000, 12000, 3000, 5000)).toBe(80000);
  });

  it('calculates dividend allocation', () => {
    expect(calculateDividendAllocation(50000, 10)).toBe(5000);
  });

  it('formats Indian currency', () => {
    expect(formatCurrency(5000)).toContain('₹');
  });

  it('summarises monthly collections across groups', () => {
    const summary = getCollectionSummary([
      { memberCount: 20, monthlyContribution: 5000, instalmentCount: 20, verifiedCollection: 70000, outstanding: 30000 },
      { memberCount: 12, monthlyContribution: 8000, instalmentCount: 12, verifiedCollection: 48000, outstanding: 16000 },
    ]);

    expect(summary.expected).toBe(2000000 + 1152000);
    expect(summary.verified).toBe(118000);
    expect(summary.outstanding).toBe(46000);
  });
});
