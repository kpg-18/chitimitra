import type { AdminFeeMode, AuctionRemainderMode, AuctionRecord, Group, Member } from '../types';

export function calculateGrossMonthlyChit(memberCount: number, monthlyContribution: number): number {
  return memberCount * monthlyContribution;
}

export function calculateExpectedTotal(groupMembers: number, monthlyContribution: number, instalments: number): number {
  const grossMonthly = calculateGrossMonthlyChit(groupMembers, monthlyContribution);
  return grossMonthly * instalments;
}

export function hasOnePayoutPerMemberSchedule(memberCount: number, instalmentCount: number): boolean {
  return Number.isSafeInteger(memberCount)
    && memberCount >= 2
    && Number.isSafeInteger(instalmentCount)
    && instalmentCount === memberCount;
}

export interface ChitPlan {
  monthlyContribution: number;
  grossMonthlyPot: number;
  totalGroupContributions: number;
}

export function calculateChitPlan(
  totalContributionPerMember: number,
  memberCount: number,
  instalments: number,
): ChitPlan | null {
  if (
    !Number.isSafeInteger(totalContributionPerMember)
    || totalContributionPerMember <= 0
    || !Number.isSafeInteger(memberCount)
    || memberCount < 2
    || !Number.isSafeInteger(instalments)
    || instalments < 1
    || totalContributionPerMember % instalments !== 0
  ) {
    return null;
  }

  const monthlyContribution = totalContributionPerMember / instalments;
  const grossMonthlyPot = calculateGrossMonthlyChit(memberCount, monthlyContribution);
  const totalGroupContributions = grossMonthlyPot * instalments;
  if (!Number.isSafeInteger(grossMonthlyPot) || !Number.isSafeInteger(totalGroupContributions)) return null;

  return { monthlyContribution, grossMonthlyPot, totalGroupContributions };
}

export function calculateOutstandingBalance(amountDue: number, verifiedPayments: number): number {
  return Math.max(amountDue - verifiedPayments, 0);
}

export function calculateAuctionPrize(
  grossChitAmount: number,
  winningDiscount: number,
  foremanCommission: number,
  otherDeductions: number,
): number {
  return Math.max(grossChitAmount - winningDiscount - foremanCommission - otherDeductions, 0);
}

export function calculateDividendAllocation(totalDividend: number, memberCount: number): number {
  return memberCount > 0 ? totalDividend / memberCount : 0;
}

export interface ChitSettlement {
  grossPot: number;
  winningDiscount: number;
  foremanCommission: number;
  remainingAmount: number;
  carryForwardAmount: number;
  reserveAmount: number;
  totalDividend: number;
  dividendPerMember: number;
  effectiveContribution: number;
  winnerPayout: number;
}

export function calculateChitSettlement({
  grossPot,
  winningDiscount,
  foremanCommission,
  memberCount,
  monthlyContribution,
  remainderMode = 'dividend',
}: {
  grossPot: number;
  winningDiscount: number;
  foremanCommission: number;
  memberCount: number;
  monthlyContribution: number;
  remainderMode?: AuctionRemainderMode;
}): ChitSettlement {
  const remainingAmount = Math.max(winningDiscount - foremanCommission, 0);
  const totalDividend = remainderMode === 'dividend' ? remainingAmount : 0;
  const dividendPerMember = remainderMode === 'dividend'
    ? Math.floor(calculateDividendAllocation(totalDividend, memberCount))
    : 0;
  const distributedDividend = dividendPerMember * memberCount;
  const unallocatedRemainder = Math.max(remainingAmount - distributedDividend, 0);
  return {
    grossPot,
    winningDiscount,
    foremanCommission,
    remainingAmount,
    carryForwardAmount: remainderMode === 'carry-forward' ? remainingAmount : 0,
    reserveAmount: remainderMode === 'reserve'
      ? remainingAmount
      : remainderMode === 'dividend'
        ? unallocatedRemainder
        : 0,
    totalDividend,
    dividendPerMember,
    effectiveContribution: Math.max(monthlyContribution - dividendPerMember, 0),
    winnerPayout: Math.max(grossPot - winningDiscount, 0),
  };
}

export function getFinalPayoutMember(group: {
  members: Pick<Member, 'id' | 'name'>[];
  auctions: Pick<AuctionRecord, 'winnerMemberId'>[];
  currentRound: number;
  instalmentCount: number;
  memberCount: number;
  reserveBalance: number;
  totalAmount: number;
}): Pick<Member, 'id' | 'name'> | null {
  if (
    group.currentRound > group.instalmentCount
    || group.members.length !== group.memberCount
    || group.memberCount !== group.instalmentCount
    || group.reserveBalance < group.totalAmount
    || group.totalAmount <= 0
  ) return null;

  const previousWinners = new Set(group.auctions.map((auction) => auction.winnerMemberId));
  const eligibleMembers = group.members.filter((member) => !previousWinners.has(member.id));
  return eligibleMembers.length === 1 ? eligibleMembers[0] : null;
}

export function getAdminFeePerMemberForRound(
  mode: AdminFeeMode,
  amount: number,
  round: number,
): number {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(round) || round < 1) return 0;
  return mode === 'monthly-per-member' || (mode === 'one-time-per-member' && round === 1)
    ? amount
    : 0;
}

export function getExpectedGroupCollections(
  group: Pick<Group, 'memberCount' | 'monthlyContribution' | 'instalmentCount' | 'adminFeeMode' | 'adminFeeAmount'>
    & { auctions: Pick<Group['auctions'][number], 'round' | 'dividendPerMember' | 'waivedContributionMemberIds'>[] },
): number {
  const auctionsByRound = new Map(group.auctions.map((auction) => [auction.round, auction]));
  let expected = 0;
  for (let round = 1; round <= group.instalmentCount; round += 1) {
    const auction = auctionsByRound.get(round);
    const basePerMember = auction
      ? Math.max(group.monthlyContribution - auction.dividendPerMember, 0)
      : group.monthlyContribution;
    const feePerMember = getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round);
    const waivedMemberIds = new Set(auction?.waivedContributionMemberIds ?? []);
    const contributingMembers = Math.max(group.memberCount - waivedMemberIds.size, 0);
    expected += contributingMembers * basePerMember + group.memberCount * feePerMember;
  }
  return expected;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getCollectionSummary(
  groups: {
    memberCount: number;
    monthlyContribution: number;
    instalmentCount: number;
    verifiedCollection: number;
    outstanding: number;
    adminFeeMode?: AdminFeeMode;
    adminFeeAmount?: number;
    auctions?: Pick<AuctionRecord, 'round' | 'dividendPerMember' | 'waivedContributionMemberIds'>[];
  }[],
) {
  const expected = groups.reduce(
    (sum, group) => {
      const expectedForGroup = group.auctions
        ? getExpectedGroupCollections({
          memberCount: group.memberCount,
          monthlyContribution: group.monthlyContribution,
          instalmentCount: group.instalmentCount,
          adminFeeMode: group.adminFeeMode ?? 'none',
          adminFeeAmount: group.adminFeeAmount ?? 0,
          auctions: group.auctions,
        })
        : calculateExpectedTotal(group.memberCount, group.monthlyContribution, group.instalmentCount)
          + (group.adminFeeMode === 'monthly-per-member'
            ? (group.adminFeeAmount ?? 0) * group.memberCount * group.instalmentCount
            : group.adminFeeMode === 'one-time-per-member'
              ? (group.adminFeeAmount ?? 0) * group.memberCount
              : 0);
      return sum + expectedForGroup;
    },
    0,
  );
  const verified = groups.reduce((sum, group) => sum + group.verifiedCollection, 0);
  const outstanding = groups.reduce((sum, group) => sum + group.outstanding, 0);
  return { expected, verified, outstanding };
}
