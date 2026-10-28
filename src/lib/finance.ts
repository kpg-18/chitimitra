export function calculateGrossMonthlyChit(memberCount: number, monthlyContribution: number): number {
  return memberCount * monthlyContribution;
}

export function calculateExpectedTotal(groupMembers: number, monthlyContribution: number, instalments: number): number {
  const grossMonthly = calculateGrossMonthlyChit(groupMembers, monthlyContribution);
  return grossMonthly * instalments;
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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getCollectionSummary(
  groups: Array<{ memberCount: number; monthlyContribution: number; instalmentCount: number; verifiedCollection: number; outstanding: number }>,
) {
  const expected = groups.reduce(
    (sum, group) => sum + calculateExpectedTotal(group.memberCount, group.monthlyContribution, group.instalmentCount),
    0,
  );
  const verified = groups.reduce((sum, group) => sum + group.verifiedCollection, 0);
  const outstanding = groups.reduce((sum, group) => sum + group.outstanding, 0);
  return { expected, verified, outstanding };
}
