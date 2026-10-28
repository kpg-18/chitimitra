import type { AuctionRecord, Group, Member } from '../types';

export function getAuctionHistory(group: Group): AuctionRecord[] {
  return [...(group.auctions ?? [])].sort((a, b) => b.round - a.round);
}

export function getAuctionPaymentSummary(auction: AuctionRecord, members: Member[]) {
  const paidIds = new Set(auction.paidMemberIds);
  const unpaid = members.filter((member) => !paidIds.has(member.id));
  const paidCount = members.length - unpaid.length;

  return {
    paidCount,
    unpaidMembers: unpaid,
    allPaid: unpaid.length === 0 && members.length > 0,
  };
}

export function getPreviousAuctionWinners(group: Group, round: number): AuctionRecord[] {
  return getAuctionHistory(group).filter((auction) => auction.round < round);
}

export function formatReportDate(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
