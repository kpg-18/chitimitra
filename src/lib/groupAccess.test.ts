import { describe, expect, it } from 'vitest';
import { canManageGroup, getMemberGroups, isGroupMember } from './groupAccess';
import type { Group } from '../types';

const group: Group = {
  id: 'group-one',
  createdByUserId: 'admin-1',
  name: 'Family circle',
  description: 'Private family savings group',
  visibility: 'private',
  inviteMode: 'code',
  invitationCode: 'FAMILY-1',
  inviteLink: 'chitmitra://join/FAMILY-1',
  allowGuestMembers: true,
  monthlyContribution: 5000,
  chitType: 'auction',
  managementMode: 'self-managed',
  foremanCommissionPercent: 0,
  adminFeeMode: 'none',
  adminFeeAmount: 0,
  minimumBidDiscount: 500,
  bidIncrement: 200,
  fixedDiscountAmount: 500,
  instalmentCount: 20,
  memberCount: 2,
  dueDay: 30,
  totalAmount: 100000,
  carryForwardBalance: 0,
  reserveBalance: 0,
  verifiedCollection: 0,
  outstanding: 0,
  currentRound: 1,
  members: [
    { id: 'member-admin', userId: 'admin-1', name: 'Admin', role: 'primary-admin', status: 'active', phone: '', paidThisMonth: false },
    { id: 'member-person', userId: 'person-1', name: 'Member', role: 'member', status: 'active', phone: '', paidThisMonth: false },
  ],
  pendingInvites: [],
  auctions: [],
  payments: [],
  activities: [],
};

describe('group visibility and management', () => {
  it('only includes groups where the user is a member', () => {
    expect(getMemberGroups([group], 'person-1', 'Member')).toEqual([group]);
    expect(getMemberGroups([group], 'stranger', 'Stranger')).toEqual([]);
  });

  it('recognises admins but not ordinary members as group managers', () => {
    expect(canManageGroup(group, 'admin-1', 'Admin')).toBe(true);
    expect(canManageGroup(group, 'person-1', 'Member')).toBe(false);
  });

  it('supports legacy records with name-based membership only', () => {
    const legacyGroup = {
      ...group,
      members: [{ ...group.members[1], userId: undefined }],
    };

    expect(isGroupMember(legacyGroup, 'different-id', 'Member')).toBe(true);
    expect(isGroupMember(legacyGroup, 'different-id', 'Someone else')).toBe(false);
  });
});
