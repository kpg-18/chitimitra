import { describe, expect, it } from 'vitest';
import { formatReportDate, getAuctionHistory, getAuctionPaymentSummary, getPreviousAuctionWinners } from './auctionReport';
import type { AuctionRecord, Group, Member } from '../types';

const members: Member[] = [
  { id: 'm1', name: 'Asha', role: 'primary-admin', status: 'active', phone: '', paidThisMonth: false },
  { id: 'm2', name: 'Bala', role: 'member', status: 'active', phone: '', paidThisMonth: false },
  { id: 'm3', name: 'Chitra', role: 'member', status: 'active', phone: '', paidThisMonth: false },
];

const auctions: AuctionRecord[] = [
  { id: 'r1', round: 1, date: '2026-09-30', winnerMemberId: 'm1', winnerName: 'Asha', winningDiscount: 1000, foremanCommission: 0, adminFeeCollected: 0, dividendPerMember: 333, remainderMode: 'dividend', remainingAmount: 1000, carryForwardAmount: 0, reserveAmount: 1, payoutAmount: 14000, contributions: [], paidMemberIds: ['m1', 'm2', 'm3'] },
  { id: 'r2', round: 2, date: '2026-10-28', winnerMemberId: 'm2', winnerName: 'Bala', winningDiscount: 1500, foremanCommission: 0, adminFeeCollected: 0, dividendPerMember: 500, remainderMode: 'dividend', remainingAmount: 1500, carryForwardAmount: 0, reserveAmount: 0, payoutAmount: 13500, contributions: [], paidMemberIds: ['m1'] },
];

const group = { auctions } as Group;

describe('auction JPG report data', () => {
  it('orders auction history newest first and finds earlier winners', () => {
    expect(getAuctionHistory(group).map((auction) => auction.round)).toEqual([2, 1]);
    expect(getPreviousAuctionWinners(group, 2).map((auction) => auction.winnerName)).toEqual(['Asha']);
  });

  it('summarizes all-paid rounds and names unpaid members for outstanding rounds', () => {
    expect(getAuctionPaymentSummary(auctions[0], members)).toMatchObject({
      paidCount: 3,
      unpaidMembers: [],
      allPaid: true,
    });
    expect(getAuctionPaymentSummary(auctions[1], members)).toMatchObject({
      paidCount: 1,
      unpaidMembers: [{ name: 'Bala' }, { name: 'Chitra' }],
      allPaid: false,
    });
  });

  it('formats the recorded auction date for the report', () => {
    expect(formatReportDate('2026-10-28')).toMatch(/28/);
    expect(formatReportDate('not-a-date')).toBe('not-a-date');
  });
});
