export type ThemeMode = 'light' | 'dark' | 'system';
export type Locale = 'kn' | 'en';
export type Visibility = 'private' | 'public';
export type InviteMode = 'code' | 'link' | 'manual';
export type PaymentStatus = 'verified' | 'pending' | 'overdue';

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
  memberId: string;
  memberName: string;
  amount: number;
  status: PaymentStatus;
  date: string;
  type: 'collection' | 'payout';
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
  instalmentCount: number;
  memberCount: number;
  dueDay: number;
  totalAmount: number;
  verifiedCollection: number;
  outstanding: number;
  currentRound: number;
  members: Member[];
  pendingInvites: PendingInvite[];
  payments: PaymentRecord[];
  activities: ActivityItem[];
}

export interface AppState {
  user: UserProfile;
  theme: ThemeMode;
  locale: Locale;
  groups: Group[];
  activities: ActivityItem[];
}
