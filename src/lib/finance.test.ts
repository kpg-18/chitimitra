import { describe, expect, it } from 'vitest';
import {
  calculateAuctionPrize,
  calculateChitPlan,
  calculateChitSettlement,
  calculateDividendAllocation,
  calculateExpectedTotal,
  calculateGrossMonthlyChit,
  calculateOutstandingBalance,
  formatCurrency,
  getAdminFeePerMemberForRound,
  getCollectionSummary,
  getExpectedGroupCollections,
} from './finance';

describe('financial formulas', () => {
  it('calculates gross monthly chit amount', () => {
    expect(calculateGrossMonthlyChit(20, 5000)).toBe(100000);
  });

  it('calculates expected total contributions', () => {
    expect(calculateExpectedTotal(20, 5000, 20)).toBe(2000000);
  });

  it('calculates a one-lakh chit with ten members and ten monthly rounds', () => {
    expect(calculateChitPlan(100000, 10, 10)).toEqual({
      monthlyContribution: 10000,
      grossMonthlyPot: 100000,
      totalGroupContributions: 1000000,
    });
  });

  it('rejects invalid chit terms and amounts that do not divide into whole rupees', () => {
    expect(calculateChitPlan(100000, 10, 0)).toBeNull();
    expect(calculateChitPlan(100001, 10, 10)).toBeNull();
    expect(calculateChitPlan(Number.MAX_SAFE_INTEGER, 100, 100)).toBeNull();
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

  it('settles an auction chit discount, agent fee, dividend and net payout', () => {
    expect(calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 20000,
      foremanCommission: 5000,
      memberCount: 20,
      monthlyContribution: 5000,
    })).toEqual({
      grossPot: 100000,
      winningDiscount: 20000,
      foremanCommission: 5000,
      remainingAmount: 15000,
      carryForwardAmount: 0,
      reserveAmount: 0,
      totalDividend: 15000,
      dividendPerMember: 750,
      effectiveContribution: 4250,
      winnerPayout: 80000,
    });

  });

  it('does not allocate negative dividends when an agent fee consumes the full discount', () => {
    expect(calculateChitSettlement({
      grossPot: 10000,
      winningDiscount: 500,
      foremanCommission: 500,
      memberCount: 5,
      monthlyContribution: 2000,
    })).toMatchObject({
      totalDividend: 0,
      dividendPerMember: 0,
      effectiveContribution: 2000,
      winnerPayout: 9500,
    });
  });

  it('carries the post-commission discount remainder into the next pot', () => {
    expect(calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 20000,
      foremanCommission: 5000,
      memberCount: 10,
      monthlyContribution: 10000,
      remainderMode: 'carry-forward',
    })).toMatchObject({
      remainingAmount: 15000,
      carryForwardAmount: 15000,
      reserveAmount: 0,
      dividendPerMember: 0,
      winnerPayout: 80000,
    });
  });

  it('keeps remainders in reserve and accounts for dividend rounding', () => {
    expect(calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 1001,
      foremanCommission: 0,
      memberCount: 10,
      monthlyContribution: 10000,
      remainderMode: 'reserve',
    })).toMatchObject({
      remainingAmount: 1001,
      reserveAmount: 1001,
      dividendPerMember: 0,
    });
    expect(calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 1001,
      foremanCommission: 0,
      memberCount: 10,
      monthlyContribution: 10000,
    })).toMatchObject({
      remainingAmount: 1001,
      reserveAmount: 1,
      dividendPerMember: 100,
    });
  });

  it('charges monthly admin commission each round or one-time commission in round one', () => {
    expect(getAdminFeePerMemberForRound('monthly-per-member', 10, 3)).toBe(10);
    expect(getAdminFeePerMemberForRound('one-time-per-member', 100, 1)).toBe(100);
    expect(getAdminFeePerMemberForRound('one-time-per-member', 100, 2)).toBe(0);
    expect(getAdminFeePerMemberForRound('none', 100, 1)).toBe(0);
  });

  it('includes scheduled admin fees and auction dividends in expected collections', () => {
    const group = {
      memberCount: 10,
      monthlyContribution: 10000,
      instalmentCount: 10,
      adminFeeMode: 'one-time-per-member' as const,
      adminFeeAmount: 100,
      auctions: [{ round: 1, dividendPerMember: 100 }],
    };
    expect(getExpectedGroupCollections(group)).toBe(1000000);
  });

  it('formats Indian currency', () => {
    expect(formatCurrency(5000)).toContain('₹');
  });

  it('summarises monthly collections across groups', () => {
    const summary = getCollectionSummary([
      { memberCount: 20, monthlyContribution: 5000, instalmentCount: 20, verifiedCollection: 70000, outstanding: 30000 },
      { memberCount: 12, monthlyContribution: 8000, instalmentCount: 12, verifiedCollection: 48000, outstanding: 16000 },
      { memberCount: 10, monthlyContribution: 10000, instalmentCount: 10, verifiedCollection: 0, outstanding: 0, adminFeeMode: 'monthly-per-member', adminFeeAmount: 10 },
    ]);

    expect(summary.expected).toBe(2000000 + 1152000 + 1000000 + 1000);
    expect(summary.verified).toBe(118000);
    expect(summary.outstanding).toBe(46000);
  });
});
