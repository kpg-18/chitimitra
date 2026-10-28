import type { AppState, Group, PaymentRecord } from '../types';

const payments: PaymentRecord[] = [
  { id: 'pay-1', memberId: 'm-1', memberName: 'Ananya', amount: 5000, status: 'verified', date: '2026-10-05', type: 'collection' },
  { id: 'pay-2', memberId: 'm-2', memberName: 'Ravi', amount: 5000, status: 'pending', date: '2026-10-08', type: 'collection' },
  { id: 'pay-3', memberId: 'm-3', memberName: 'Suma', amount: 5000, status: 'verified', date: '2026-10-07', type: 'collection' },
  { id: 'pay-4', memberId: 'm-1', memberName: 'Ananya', amount: 25000, status: 'verified', date: '2026-10-12', type: 'payout' },
];

const groups: Group[] = [
  {
    id: 'g-1',
    createdByUserId: 'u-1',
    name: 'Nagar Community Chit',
    description: 'Monthly chit for local homeowners and traders.',
    visibility: 'private',
    inviteMode: 'code',
    invitationCode: 'NAGAR-42',
    inviteLink: 'chitmitra://group/NAGAR-42',
    allowGuestMembers: true,
    monthlyContribution: 5000,
    instalmentCount: 20,
    memberCount: 20,
    dueDay: 8,
    totalAmount: 100000,
    verifiedCollection: 70000,
    outstanding: 30000,
    currentRound: 4,
    members: [
      { id: 'm-1', userId: 'u-1', name: 'Ananya Gowda', role: 'primary-admin', status: 'active', phone: '98765 12345', paidThisMonth: true, source: 'app-user' },
      { id: 'm-2', name: 'Ravi', role: 'admin', status: 'active', phone: '98765 12346', paidThisMonth: false, source: 'app-user' },
      { id: 'm-3', name: 'Suma', role: 'member', status: 'active', phone: '98765 12347', paidThisMonth: true, source: 'app-user' },
      { id: 'm-4', name: 'Nikhil', role: 'member', status: 'pending', phone: '98765 12348', paidThisMonth: false, isGuest: true, source: 'guest' },
    ],
    pendingInvites: [
      { id: 'pi-1', name: 'Shivaram', status: 'pending', contact: '+91 98989 70001', addedByUserId: 'u-1' },
      { id: 'pi-2', name: 'Divya', status: 'accepted', contact: 'divya@localgroup.in', addedByUserId: 'u-1' },
    ],
    payments,
    activities: [
      { id: 'a-1', title: 'Payment verified', time: '2h ago', detail: 'Suma verified ₹5,000 collection.' },
      { id: 'a-2', title: 'Auction cycle started', time: '1d ago', detail: 'Round 4 call-out opened by Ananya.' },
    ],
  },
  {
    id: 'g-2',
    createdByUserId: 'u-2',
    name: 'Bharath Street Savings',
    description: 'Monthly chit for shopkeepers and families.',
    visibility: 'public',
    inviteMode: 'link',
    invitationCode: 'BHARATH-18',
    inviteLink: 'chitmitra://join/BHARATH-18',
    allowGuestMembers: false,
    monthlyContribution: 8000,
    instalmentCount: 12,
    memberCount: 12,
    dueDay: 12,
    totalAmount: 96000,
    verifiedCollection: 48000,
    outstanding: 16000,
    currentRound: 2,
    members: [
      { id: 'm-5', name: 'Keerthi', role: 'primary-admin', status: 'active', phone: '98234 44444', paidThisMonth: true, source: 'app-user' },
      { id: 'm-6', name: 'Varun', role: 'member', status: 'active', phone: '98234 44445', paidThisMonth: true, source: 'app-user' },
      { id: 'm-7', name: 'Meera', role: 'member', status: 'active', phone: '98234 44446', paidThisMonth: false, source: 'app-user' },
    ],
    pendingInvites: [{ id: 'pi-3', name: 'Arun', status: 'pending', contact: '+91 99887 77880' }],
    payments: [
      { id: 'pay-5', memberId: 'm-5', memberName: 'Keerthi', amount: 8000, status: 'verified', date: '2026-10-04', type: 'collection' },
      { id: 'pay-6', memberId: 'm-6', memberName: 'Varun', amount: 8000, status: 'verified', date: '2026-10-03', type: 'collection' },
    ],
    activities: [
      { id: 'a-3', title: 'New member added', time: '3d ago', detail: 'Meera joined the group.' },
    ],
  },
];

export const initialState: AppState = {
  user: {
    id: 'u-1',
    name: 'Ananya Gowda',
    email: 'ananya@chitmitra.app',
    phone: '+91 98765 43210',
    initials: 'AG',
  },
  theme: 'system',
  locale: 'kn',
  groups,
  activities: [
    { id: 'ac-1', title: 'Group update', time: '2h ago', detail: 'Nagar Community Chit verified collection.' },
    { id: 'ac-2', title: 'Invitation sent', time: '1d ago', detail: 'Public link for Bharath Street Savings shared.' },
  ],
};
