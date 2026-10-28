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
  getFinalPayoutMember,
  getAdminFeePerMemberForRound,
  getCollectionSummary,
  getExpectedGroupCollections,
  hasOnePayoutPerMemberSchedule,
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

  it('requires the round count to match the member count', () => {
    expect(hasOnePayoutPerMemberSchedule(10, 10)).toBe(true);
    expect(hasOnePayoutPerMemberSchedule(10, 9)).toBe(false);
    expect(hasOnePayoutPerMemberSchedule(1, 1)).toBe(false);
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

  it('accumulates auction discount remainder without reducing the member contribution', () => {
    const firstRound = calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 13000,
      foremanCommission: 0,
      memberCount: 10,
      monthlyContribution: 10000,
      remainderMode: 'reserve',
    });
    const secondRound = calculateChitSettlement({
      grossPot: 100000,
      winningDiscount: 17000,
      foremanCommission: 0,
      memberCount: 10,
      monthlyContribution: 10000,
      remainderMode: 'reserve',
    });

    expect(firstRound).toMatchObject({ winnerPayout: 87000, reserveAmount: 13000, effectiveContribution: 10000 });
    expect(secondRound).toMatchObject({ winnerPayout: 83000, reserveAmount: 17000, effectiveContribution: 10000 });
    expect(firstRound.reserveAmount + secondRound.reserveAmount).toBe(30000);
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

  it('finds the last unpaid recipient only when the accumulated balance covers the chit amount', () => {
    const finalRoundGroup = {
      members: [
        { id: 'm1', name: 'Asha' },
        { id: 'm2', name: 'Bala' },
        { id: 'm3', name: 'Chitra' },
      ],
      auctions: [{ winnerMemberId: 'm1' }, { winnerMemberId: 'm2' }],
      currentRound: 3,
      instalmentCount: 3,
      memberCount: 3,
      reserveBalance: 100000,
      totalAmount: 100000,
    };

    expect(getFinalPayoutMember(finalRoundGroup)?.id).toBe('m3');
    expect(getFinalPayoutMember({ ...finalRoundGroup, reserveBalance: 99999 })).toBeNull();
    expect(getFinalPayoutMember({ ...finalRoundGroup, auctions: [{ winnerMemberId: 'm1' }] })).toBeNull();
  });

  it('waives final-round member contributions while keeping separately scheduled admin fees due', () => {
    const group = {
      memberCount: 3,
      monthlyContribution: 10000,
      instalmentCount: 3,
      adminFeeMode: 'monthly-per-member' as const,
      adminFeeAmount: 10,
      auctions: [
        { round: 1, dividendPerMember: 0, waivedContributionMemberIds: [] },
        { round: 2, dividendPerMember: 0, waivedContributionMemberIds: [] },
        { round: 3, dividendPerMember: 0, waivedContributionMemberIds: ['m1', 'm2', 'm3'] },
      ],
    };

    expect(getExpectedGroupCollections(group)).toBe(60090);
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
