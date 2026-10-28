export type ThemeMode = 'light' | 'dark' | 'system';
export type Locale = 'kn' | 'en';
export type Visibility = 'private' | 'public';
export type InviteMode = 'code' | 'link' | 'manual';
export type PaymentStatus = 'verified' | 'pending' | 'overdue';
export type ChitType = 'auction' | 'fixed-discount' | 'lucky-draw';
export type ManagementMode = 'self-managed' | 'agent-managed';
export type AdminFeeMode = 'none' | 'monthly-per-member' | 'one-time-per-member';
export type AuctionRemainderMode = 'dividend' | 'carry-forward' | 'reserve';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
}

export interface Member {
  id: string;
  userId?: string;
  name: string;
  role: 'primary-admin' | 'admin' | 'member';
  status: 'active' | 'pending';
  phone: string;
  email?: string;
  paidThisMonth: boolean;
  isGuest?: boolean;
  source?: 'app-user' | 'guest' | 'invited';
}

export interface PendingInvite {
  id: string;
  name: string;
  status: 'pending' | 'accepted';
  contact: string;
  addedByUserId?: string;
}

export interface PaymentRecord {
  id: string;
  round?: number;
  memberId: string;
  memberName: string;
  paidByMemberId?: string;
  paidByName?: string;
  amount: number;
  status: PaymentStatus;
  date: string;
  type: 'collection' | 'admin-fee' | 'payout';
}

export interface AuctionRecord {
  id: string;
  round: number;
  date: string;
  outcomeType?: 'auction' | 'final-payout';
  winnerMemberId: string;
  winnerName: string;
  winningDiscount: number;
  foremanCommission: number;
  adminFeeCollected: number;
  dividendPerMember: number;
  remainderMode: AuctionRemainderMode;
  remainingAmount: number;
  carryForwardAmount: number;
  reserveAmount: number;
  reserveBalanceAfter?: number;
  payoutAmount: number;
  contributions: { memberId: string; amount: number }[];
  paidMemberIds: string[];
  waivedContributionMemberIds?: string[];
}

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  detail: string;
}

export interface Group {
  id: string;
  createdByUserId?: string;
  name: string;
  description: string;
  visibility: Visibility;
  inviteMode: InviteMode;
  invitationCode: string;
  inviteLink: string;
  allowGuestMembers: boolean;
  monthlyContribution: number;
  chitType: ChitType;
  managementMode: ManagementMode;
  foremanCommissionPercent: number;
  adminFeeMode: AdminFeeMode;
  adminFeeAmount: number;
  minimumBidDiscount: number;
  bidIncrement: number;
  fixedDiscountAmount: number;
  instalmentCount: number;
  memberCount: number;
  dueDay: number;
  totalAmount: number;
  carryForwardBalance: number;
  reserveBalance: number;
  verifiedCollection: number;
  outstanding: number;
  currentRound: number;
  members: Member[];
  pendingInvites: PendingInvite[];
  auctions: AuctionRecord[];
  payments: PaymentRecord[];
  activities: ActivityItem[];
}

export interface AppState {
  user: UserProfile | null;
  theme: ThemeMode;
  locale: Locale;
  groups: Group[];
  activities: ActivityItem[];
}
