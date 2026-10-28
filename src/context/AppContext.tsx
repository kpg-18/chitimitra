import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { initialState } from '../data/seed';
import { canManageGroup } from '../lib/groupAccess';
import { calculateChitSettlement, getAdminFeePerMemberForRound, getExpectedGroupCollections, getFinalPayoutMember, hasOnePayoutPerMemberSchedule } from '../lib/finance';
import { exchangeOAuthCode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AppState, AuctionRecord, AuctionRemainderMode, ChitType, Group, InviteMode, Locale, ManagementMode, ThemeMode, UserProfile, Visibility } from '../types';
import type { User } from '@supabase/supabase-js';

const STORAGE_KEY_PREFIX = 'chiti-mitra-state-v2:';
const LOCAL_PROFILE_KEY = 'chiti-mitra-local-profile-v1';
const AUTH_CONFIGURATION_ERROR = 'Authentication is not configured. Add the Supabase URL and anon key to your environment.';

export const AUTHENTICATION_ENABLED = false;

function getAuthRedirectUrl() {
  if (Platform.OS === 'web') {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return new URL(path, window.location.origin).toString();
  }
  return Linking.createURL('auth');
}

function normalizeStoredGroups(groups: Group[] | undefined): Group[] {
  return (groups ?? [])
    .filter((group) => group.id !== 'g-1' && group.id !== 'g-2')
    .map((group) => ({
      ...group,
      dueDay: group.dueDay || 30,
      chitType: group.chitType ?? 'auction',
      managementMode: group.managementMode ?? 'self-managed',
      foremanCommissionPercent: group.foremanCommissionPercent ?? 0,
      minimumBidDiscount: group.minimumBidDiscount ?? 500,
      bidIncrement: group.bidIncrement ?? 200,
      fixedDiscountAmount: group.fixedDiscountAmount ?? 500,
      adminFeeMode: group.adminFeeMode ?? 'none',
      adminFeeAmount: group.adminFeeAmount ?? 0,
      carryForwardBalance: group.carryForwardBalance ?? 0,
      reserveBalance: group.reserveBalance ?? 0,
      members: (group.members ?? []).map((member) => ({ ...member, status: 'active' as const })),
      pendingInvites: [],
      currentRound: group.currentRound || 1,
      auctions: (group.auctions ?? []).map((auction) => ({
        ...auction,
        winningDiscount: auction.winningDiscount ?? Math.max(group.totalAmount - auction.payoutAmount, 0),
        foremanCommission: auction.foremanCommission ?? 0,
        adminFeeCollected: auction.adminFeeCollected ?? 0,
        dividendPerMember: auction.dividendPerMember ?? 0,
        remainderMode: auction.remainderMode ?? 'dividend',
        remainingAmount: auction.remainingAmount ?? Math.max(auction.winningDiscount - (auction.foremanCommission ?? 0), 0),
        carryForwardAmount: auction.carryForwardAmount ?? 0,
        reserveAmount: auction.reserveAmount ?? 0,
        contributions: auction.contributions ?? [],
      })),
      payments: group.payments ?? [],
      activities: group.activities ?? [],
    }));
}

function getPayerDetails(group: Group, memberId: string, rawName?: string) {
  const member = group.members.find((item) => item.id === memberId);
  const paidByName = rawName?.trim() || member?.name || 'Unknown payer';
  const otherMember = group.members.find((item) =>
    item.id !== memberId && item.name.trim().toLocaleLowerCase() === paidByName.toLocaleLowerCase(),
  );
  return {
    paidByName,
    ...(otherMember ? { paidByMemberId: otherMember.id } : {}),
  };
}

interface CreateGroupInput {
  name: string;
  description: string;
  visibility: Visibility;
  inviteMode: InviteMode;
  chitType: ChitType;
  managementMode: ManagementMode;
  foremanCommissionPercent: number;
  adminFeeMode: Group['adminFeeMode'];
  adminFeeAmount: number;
  minimumBidDiscount: number;
  bidIncrement: number;
  fixedDiscountAmount: number;
  monthlyContribution: number;
  memberCount: number;
  instalmentCount: number;
  dueDay: number;
  members: { name: string; contact: string }[];
  allowGuestMembers: boolean;
}

interface RecordAuctionInput {
  date: string;
  winnerMemberId: string;
  winningDiscount: number;
  remainderMode: AuctionRemainderMode;
  memberContributions: { memberId: string; amount: number; adminFeeAmount: number; paidByName?: string }[];
}

interface AppContextValue {
  state: AppState;
  authReady: boolean;
  authConfigured: boolean;
  authInitializationError: string | null;
  isPasswordRecovery: boolean;
  theme: ThemeMode;
  locale: Locale;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  continueAsGuest: (name: string) => Promise<void>;
  clearGuestProfile: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  exchangeAuthCode: (code: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  addGroup: (group: Group) => void;
  createGroup: (draft: CreateGroupInput) => string;
  recordRoundContributions: (groupId: string, round: number, contributions: { memberId: string; amount: number; adminFeeAmount: number; paidByName?: string }[]) => boolean;
  recordAuction: (groupId: string, draft: RecordAuctionInput) => AuctionRecord | null;
  recordFinalPayout: (groupId: string, date: string, adminFees: { memberId: string; amount: number; paidByName?: string }[]) => AuctionRecord | null;
  setAuctionMemberPaid: (groupId: string, auctionId: string, memberId: string, isPaid: boolean, paidByName?: string) => boolean;
  deleteGroup: (groupId: string) => boolean;
  addMemberToGroup: (groupId: string, memberName: string, isGuest?: boolean) => void;
  verifyPayment: (groupId: string, paymentId: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(AUTHENTICATION_ENABLED && !isSupabaseConfigured);
  const [authReady, setAuthReady] = useState(AUTHENTICATION_ENABLED && !isSupabaseConfigured);
  const [authInitializationError, setAuthInitializationError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let loadGeneration = 0;

    const restoreUserState = async (authUser: User | null) => {
      const generation = ++loadGeneration;
      const user = authUser ? getUserProfile(authUser) : null;
      setState({ ...initialState, user });
      setReady(false);
      setAuthReady(false);

      if (!user) {
        setReady(true);
        setAuthReady(true);
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
        if (!active || generation !== loadGeneration) return;
        if (raw) {
          const persisted = JSON.parse(raw) as Partial<AppState>;
          const groups = normalizeStoredGroups(persisted.groups);
          setState({
            ...initialState,
            ...persisted,
            user,
            groups,
            activities: groups.length > 0 ? persisted.activities ?? [] : [],
          });
        }
      } catch (error) {
        console.warn('Persisted state unavailable', error);
        setAuthInitializationError('Your account is signed in, but this device could not load its saved app data.');
      } finally {
        if (active && generation === loadGeneration) {
          setReady(true);
          setAuthReady(true);
        }
      }
    };

    if (!AUTHENTICATION_ENABLED || !supabase) {
      return () => {
        active = false;
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsPasswordRecovery(event === 'PASSWORD_RECOVERY');
      setAuthInitializationError(null);
      void restoreUserState(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthInitializationError(error.message);
        void restoreUserState(null);
        return;
      }
      setAuthInitializationError(null);
      void restoreUserState(data.session?.user ?? null);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthInitializationError(error instanceof Error ? error.message : 'Could not restore your sign-in session.');
      void restoreUserState(null);
    });

    return () => {
      active = false;
      loadGeneration += 1;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (AUTHENTICATION_ENABLED) return;
    let active = true;

    const restoreLocalProfile = async () => {
      try {
        const rawProfile = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
        if (!active) return;
        if (rawProfile) {
          const user = JSON.parse(rawProfile) as UserProfile;
          if (!user.id || !user.name?.trim()) {
            throw new Error('The saved local profile is invalid. Please clear this app’s local data and try again.');
          }
          const rawState = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
          if (!active) return;
          const persisted = rawState ? JSON.parse(rawState) as Partial<AppState> : {};
          setState({
            ...initialState,
            ...persisted,
            user,
            groups: normalizeStoredGroups(persisted.groups),
          });
        }
      } catch (error) {
        console.warn('Local profile unavailable', error);
        setAuthInitializationError(
          error instanceof Error ? error.message : 'Could not load the saved local profile.',
        );
      } finally {
        if (active) {
          setReady(true);
          setAuthReady(true);
        }
      }
    };

    void restoreLocalProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !state.user) return;
    void AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${state.user.id}`, JSON.stringify(state))
      .catch((error: unknown) => console.warn('Could not save app state', error));
  }, [state, ready]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      authReady,
      authConfigured: isSupabaseConfigured,
      authInitializationError,
      isPasswordRecovery,
      theme: state.theme,
      locale: state.locale,
      signIn: async (email, password) => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signInWithGoogle: async () => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const redirectTo = getAuthRedirectUrl();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data.url) throw new Error('Could not start Google sign-in.');

        if (Platform.OS === 'web') {
          window.location.assign(data.url);
          return false;
        }

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return false;

        const callback = Linking.parse(result.url);
        const callbackParams = callback.queryParams ?? {};
        const oauthError = callbackParams.error_description ?? callbackParams.error;
        if (typeof oauthError === 'string') throw new Error(oauthError);
        const code = callbackParams.code;
        if (typeof code !== 'string' || !code) {
          throw new Error('Google sign-in returned without an authorization code. Please try again.');
        }
        await exchangeOAuthCode(code);
        return true;
      },
      signUp: async (name, email, password) => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        if (error) throw error;
        return !data.session;
      },
      continueAsGuest: async (name) => {
        const cleanName = name.trim();
        if (!cleanName) throw new Error('Enter your name to continue.');
        const user = {
          id: 'local-profile',
          name: cleanName,
          email: '',
          phone: '',
          initials: getInitials(cleanName),
        };
        await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(user));
        setAuthInitializationError(null);
        setState((current) => ({ ...current, user }));
        setReady(true);
        setAuthReady(true);
      },
      clearGuestProfile: async () => {
        await AsyncStorage.removeItem(LOCAL_PROFILE_KEY);
        setState((current) => ({ ...current, user: null }));
      },
      sendPasswordReset: async (email) => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
        });
        if (error) throw error;
      },
      exchangeAuthCode: async (code) => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        await exchangeOAuthCode(code);
      },
      updatePassword: async (password) => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setIsPasswordRecovery(false);
      },
      signOut: async () => {
        if (!supabase) throw new Error(AUTH_CONFIGURATION_ERROR);
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        setIsPasswordRecovery(false);
      },
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      setLocale: (locale) => setState((current) => ({ ...current, locale })),
      addGroup: (group) =>
        setState((current) => ({
          ...current,
          groups: [group, ...current.groups],
        })),
      createGroup: (draft) => {
        const user = state.user;
        if (!user) throw new Error('Sign in before creating a group.');
        if (
          !hasOnePayoutPerMemberSchedule(draft.memberCount, draft.instalmentCount)
        ) throw new Error('The group must have the same number of members and monthly rounds.');
        if (!Number.isSafeInteger(draft.bidIncrement) || draft.bidIncrement <= 0) {
          throw new Error('The bid raise must be a positive whole-rupee amount.');
        }
        const groupId = `group-${Date.now()}`;
        const invitees = draft.members.map((member) => ({
          name: member.name.trim(),
          contact: member.contact.trim(),
        }));
        const currentUser = { id: 'member-self', userId: user.id, name: user.name, role: 'primary-admin' as const, status: 'active' as const, phone: user.phone, paidThisMonth: true, source: 'app-user' as const };
        const invitedMembers = invitees.map(({ name, contact }, index) => ({
          id: `member-${Date.now()}-${index}`,
          name,
          role: 'member' as const,
          status: 'active' as const,
          phone: isPhoneNumber(contact) ? contact : '',
          ...(isEmailAddress(contact) ? { email: contact } : {}),
          paidThisMonth: false,
          isGuest: !contact,
          source: contact ? 'invited' as const : 'guest' as const,
        }));
        const nextGroup: Group = {
          id: groupId,
          createdByUserId: user.id,
          name: draft.name.trim(),
          description: draft.description.trim() || 'Community savings group',
          visibility: draft.visibility,
          inviteMode: draft.inviteMode,
          invitationCode: `CHITI-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          inviteLink: `chitmitra://join/${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          allowGuestMembers: draft.allowGuestMembers,
          monthlyContribution: draft.monthlyContribution,
          chitType: draft.chitType,
          managementMode: draft.managementMode,
          foremanCommissionPercent: draft.managementMode === 'agent-managed' ? draft.foremanCommissionPercent : 0,
          adminFeeMode: draft.adminFeeMode,
          adminFeeAmount: draft.adminFeeMode === 'none' ? 0 : draft.adminFeeAmount,
          minimumBidDiscount: draft.minimumBidDiscount,
          bidIncrement: draft.bidIncrement,
          fixedDiscountAmount: draft.fixedDiscountAmount,
          instalmentCount: draft.instalmentCount,
          memberCount: draft.memberCount,
          dueDay: draft.dueDay || 30,
          totalAmount: draft.monthlyContribution * draft.memberCount,
          carryForwardBalance: 0,
          reserveBalance: 0,
          verifiedCollection: 0,
          outstanding: 0,
          currentRound: 1,
          members: [currentUser, ...invitedMembers],
          pendingInvites: [],
          auctions: [],
          payments: [],
          activities: [{
            id: `activity-${Date.now()}`,
            title: 'Group created',
            time: 'just now',
            detail: `${draft.name.trim()} is ready for ${draft.visibility} access.`,
          }],
        };

        setState((current) => ({
          ...current,
          groups: [nextGroup, ...current.groups],
          activities: [{
            id: `activity-feed-${Date.now()}`,
            title: 'New group created',
            time: 'just now',
            detail: `${draft.name.trim()} is active. The admin can begin recording contributions and round 1.`,
          }, ...current.activities],
        }));
        return groupId;
      },
      recordRoundContributions: (groupId, round, contributions) => {
        const user = state.user;
        const group = state.groups.find((item) => item.id === groupId);
        if (
          !user
          || !group
          || !canManageGroup(group, user.id, user.name)
          || round !== group.currentRound
          || group.auctions.some((auction) => auction.round === round)
          || contributions.length !== group.members.length
          || new Set(contributions.map(({ memberId }) => memberId)).size !== group.members.length
          || contributions.some(({ memberId, amount, adminFeeAmount }) =>
            !group.members.some((member) => member.id === memberId)
            || !Number.isSafeInteger(amount)
            || amount < 0
            || amount > group.monthlyContribution
            || !Number.isSafeInteger(adminFeeAmount)
            || adminFeeAmount < 0
            || adminFeeAmount > getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round),
          )
        ) return false;

        const roundPayments = contributions.flatMap(({ memberId, amount, adminFeeAmount }) => {
            const member = group.members.find((item) => item.id === memberId);
            if (!member) return [];
            const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
            return [
              ...(amount > 0 ? [{
                id: `payment-round-${group.id}-${round}-${memberId}`,
                round,
                memberId,
                memberName: member.name,
                ...getPayerDetails(group, memberId, contributions.find((item) => item.memberId === memberId)?.paidByName),
                amount,
                status: 'verified' as const,
                date,
                type: 'collection' as const,
              }] : []),
              ...(adminFeeAmount > 0 ? [{
                id: `payment-admin-fee-${group.id}-${round}-${memberId}`,
                round,
                memberId,
                memberName: member.name,
                ...getPayerDetails(group, memberId, contributions.find((item) => item.memberId === memberId)?.paidByName),
                amount: adminFeeAmount,
                status: 'verified' as const,
                date,
                type: 'admin-fee' as const,
              }] : []),
            ];
          });
        const previousRoundTotal = group.payments
          .filter((payment) => payment.round === round && (payment.type === 'collection' || payment.type === 'admin-fee'))
          .reduce((sum, payment) => sum + payment.amount, 0);
        const nextRoundTotal = roundPayments.reduce((sum, payment) => sum + payment.amount, 0);

        setState((current) => ({
          ...current,
          groups: current.groups.map((item) => {
            if (item.id !== groupId) return item;
            const verifiedCollection = Math.max(
              item.verifiedCollection + nextRoundTotal - previousRoundTotal,
              0,
            );
            const expectedCollected = getExpectedGroupCollections(item);
            return {
              ...item,
              payments: [
                ...item.payments.filter((payment) => payment.round !== round || (payment.type !== 'collection' && payment.type !== 'admin-fee')),
                ...roundPayments,
              ],
              verifiedCollection,
              outstanding: Math.max(expectedCollected - verifiedCollection, 0),
              activities: [
                {
                  id: `activity-round-payments-${Date.now()}`,
                  title: `Round ${round} payment checklist updated`,
                  time: 'just now',
                  detail: `${roundPayments.filter((payment) => payment.type === 'collection').length} contribution and ${roundPayments.filter((payment) => payment.type === 'admin-fee').length} admin-fee payment records saved.`,
                },
                ...item.activities,
              ],
            };
          }),
        }));
        return true;
      },
      recordAuction: (groupId, draft) => {
        const user = state.user;
        const group = state.groups.find((item) => item.id === groupId);
        if (!user || !group || !canManageGroup(group, user.id, user.name)) return null;

        const round = group.currentRound;
        const winningMember = group.members.find((member) => member.id === draft.winnerMemberId);
        const previousWinners = new Set(group.auctions.map((auction) => auction.winnerMemberId));
        const grossPot = group.totalAmount + (group.carryForwardBalance ?? 0);
        const maximumDiscount = Math.floor(grossPot * 0.3);
        const winningDiscount = draft.winningDiscount;
        const foremanCommission = Math.floor(grossPot * (group.foremanCommissionPercent ?? 0) / 100);
        const minDiscount = group.chitType === 'auction'
          ? Math.max(group.minimumBidDiscount, Math.floor(grossPot * (group.foremanCommissionPercent ?? 0) / 100))
          : group.chitType === 'fixed-discount'
            ? group.fixedDiscountAmount
            : foremanCommission;
        const settlement = calculateChitSettlement({
          grossPot,
          winningDiscount,
          foremanCommission,
          memberCount: group.memberCount,
          monthlyContribution: group.monthlyContribution,
          remainderMode: 'reserve',
        });
        const contributionByMember = new Map(
          group.payments
            .filter((payment) => payment.round === round && payment.type === 'collection')
            .map((payment) => [payment.memberId, payment.amount]),
        );
        const adminFeeByMember = new Map(
          group.payments
            .filter((payment) => payment.round === round && payment.type === 'admin-fee')
            .map((payment) => [payment.memberId, payment.amount]),
        );
        draft.memberContributions.forEach(({ memberId, amount, adminFeeAmount }) => {
          contributionByMember.set(memberId, amount);
          adminFeeByMember.set(memberId, adminFeeAmount);
        });
        const allContributions = [...contributionByMember].map(([memberId, amount]) => ({ memberId, amount }));
        const contributions = allContributions.filter(({ amount }) => amount > 0);
        const draftMembers = draft.memberContributions.map(({ memberId }) => memberId);
        const allContributionsValid = allContributions.every(({ memberId, amount }) =>
          group.members.some((member) => member.id === memberId)
          && Number.isSafeInteger(amount)
          && amount >= 0
          && amount <= group.monthlyContribution,
        ) && [...adminFeeByMember].every(([memberId, amount]) =>
          group.members.some((member) => member.id === memberId)
          && Number.isSafeInteger(amount)
          && amount >= 0
          && amount <= getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round),
        );
        const adminFeeCollected = [...adminFeeByMember.values()].reduce((sum, amount) => sum + amount, 0);
        const parsedDate = new Date(`${draft.date}T00:00:00Z`);
        if (
          !hasOnePayoutPerMemberSchedule(group.memberCount, group.instalmentCount)
          || !winningMember
          || previousWinners.has(winningMember.id)
          || round < 1
          || round > group.instalmentCount
          || !Number.isSafeInteger(winningDiscount)
          || winningDiscount < minDiscount
          || winningDiscount > maximumDiscount
          || foremanCommission > winningDiscount
          || draft.memberContributions.length !== group.members.length
          || new Set(draftMembers).size !== group.members.length
          || draftMembers.some((memberId) => !group.members.some((member) => member.id === memberId))
          || !allContributionsValid
          || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)
          || Number.isNaN(parsedDate.getTime())
          || parsedDate.toISOString().slice(0, 10) !== draft.date
          || group.auctions.some((auction) => auction.round === round)
        ) return null;

        const auction: AuctionRecord = {
          id: `auction-${Date.now()}`,
          round,
          date: draft.date,
          outcomeType: 'auction',
          winnerMemberId: winningMember.id,
          winnerName: winningMember.name,
          winningDiscount,
          foremanCommission,
          adminFeeCollected,
          dividendPerMember: settlement.dividendPerMember,
          remainderMode: 'reserve',
          remainingAmount: settlement.remainingAmount,
          carryForwardAmount: settlement.carryForwardAmount,
          reserveAmount: settlement.reserveAmount,
          reserveBalanceAfter: (group.reserveBalance ?? 0) + settlement.reserveAmount,
          payoutAmount: settlement.winnerPayout,
          contributions,
          paidMemberIds: group.members
            .filter((member) =>
              (contributionByMember.get(member.id) ?? 0) >= settlement.effectiveContribution
              && (adminFeeByMember.get(member.id) ?? 0) >= getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round)
              && (settlement.effectiveContribution > 0 || getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round) > 0),
            )
            .map(({ id }) => id),
        };
        const paymentRecords = group.members.flatMap((member) => {
          const amount = contributionByMember.get(member.id) ?? 0;
          const adminFeeAmount = adminFeeByMember.get(member.id) ?? 0;
          return [
            ...(amount > 0 ? [{
              id: `payment-${auction.id}-${member.id}`,
              round,
              memberId: member.id,
              memberName: member.name,
              ...getPayerDetails(group, member.id, draft.memberContributions.find((item) => item.memberId === member.id)?.paidByName),
              amount,
              status: 'verified' as const,
              date: draft.date,
              type: 'collection' as const,
            }] : []),
            ...(adminFeeAmount > 0 ? [{
              id: `payment-admin-fee-${auction.id}-${member.id}`,
              round,
              memberId: member.id,
              memberName: member.name,
              ...getPayerDetails(group, member.id, draft.memberContributions.find((item) => item.memberId === member.id)?.paidByName),
              amount: adminFeeAmount,
              status: 'verified' as const,
              date: draft.date,
              type: 'admin-fee' as const,
            }] : []),
          ];
        });
        const collectedAmount = paymentRecords.reduce((sum, payment) => sum + payment.amount, 0);

        setState((current) => ({
          ...current,
          groups: current.groups.map((item) => {
            if (item.id !== groupId) return item;
            const previousRoundTotal = item.payments
              .filter((payment) => payment.round === round && (payment.type === 'collection' || payment.type === 'admin-fee'))
              .reduce((sum, payment) => sum + payment.amount, 0);
            const updatedGroup = {
              ...item,
              auctions: [...item.auctions, auction],
            };
            const expectedCollected = getExpectedGroupCollections(updatedGroup);
            return {
                ...item,
                currentRound: round + 1,
                auctions: [...item.auctions, auction],
                payments: [
                  ...item.payments.filter((payment) => payment.round !== round || (payment.type !== 'collection' && payment.type !== 'admin-fee')),
                  ...paymentRecords,
                ],
                carryForwardBalance: auction.carryForwardAmount,
                reserveBalance: (item.reserveBalance ?? 0) + auction.reserveAmount,
                verifiedCollection: item.verifiedCollection + collectedAmount - previousRoundTotal,
                outstanding: Math.max(expectedCollected - item.verifiedCollection - collectedAmount + previousRoundTotal, 0),
                activities: [
                  {
                    id: `activity-${Date.now()}`,
                    title: `Chit auction completed · Round ${round}`,
                    time: 'just now',
                    detail: `${auction.winnerName} received ₹${auction.payoutAmount.toLocaleString('en-IN')} on ${auction.date}.`,
                  },
                  ...item.activities,
                ],
            };
          }),
        }));
        return auction;
      },
      recordFinalPayout: (groupId, date, adminFees) => {
        const user = state.user;
        const group = state.groups.find((item) => item.id === groupId);
        const finalMember = group ? getFinalPayoutMember(group) : null;
        const round = group?.currentRound ?? 0;
        const expectedFee = group
          ? getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, round)
          : 0;
        const feeMemberIds = adminFees.map(({ memberId }) => memberId);
        const parsedDate = new Date(`${date}T00:00:00Z`);
        if (
          !user
          || !group
          || !canManageGroup(group, user.id, user.name)
          || !finalMember
          || !Number.isSafeInteger(group.totalAmount)
          || adminFees.length !== group.members.length
          || new Set(feeMemberIds).size !== group.members.length
          || adminFees.some(({ memberId, amount }) =>
            !group.members.some((member) => member.id === memberId)
            || !Number.isSafeInteger(amount)
            || amount < 0
            || amount > expectedFee,
          )
          || !/^\d{4}-\d{2}-\d{2}$/.test(date)
          || Number.isNaN(parsedDate.getTime())
          || parsedDate.toISOString().slice(0, 10) !== date
          || group.auctions.some((auction) => auction.round === round)
        ) return null;

        const id = `final-payout-${Date.now()}`;
        const waivedContributionMemberIds = group.members.map((member) => member.id);
        const adminFeeCollected = adminFees.reduce((sum, item) => sum + item.amount, 0);
        const auction: AuctionRecord = {
          id,
          round,
          date,
          outcomeType: 'final-payout',
          winnerMemberId: finalMember.id,
          winnerName: finalMember.name,
          winningDiscount: 0,
          foremanCommission: 0,
          adminFeeCollected,
          dividendPerMember: 0,
          remainderMode: 'reserve',
          remainingAmount: 0,
          carryForwardAmount: 0,
          reserveAmount: 0,
          reserveBalanceAfter: group.reserveBalance - group.totalAmount,
          payoutAmount: group.totalAmount,
          contributions: [],
          paidMemberIds: waivedContributionMemberIds,
          waivedContributionMemberIds,
        };
        const feePayments = adminFees.flatMap(({ memberId, amount, paidByName }) => {
          if (amount <= 0) return [];
          const member = group.members.find((item) => item.id === memberId);
          if (!member) return [];
          return [{
            id: `payment-admin-fee-${id}-${memberId}`,
            round,
            memberId,
            memberName: member.name,
            ...getPayerDetails(group, memberId, paidByName),
            amount,
            status: 'verified' as const,
            date,
            type: 'admin-fee' as const,
          }];
        });
        const payoutPayment: Group['payments'][number] = {
          id: `payment-${id}`,
          round,
          memberId: finalMember.id,
          memberName: finalMember.name,
          amount: group.totalAmount,
          status: 'verified',
          date,
          type: 'payout',
        };
        const newPayments = [...feePayments, payoutPayment];
        const collectedAmount = feePayments.reduce((sum, payment) => sum + payment.amount, 0);

        setState((current) => ({
          ...current,
          groups: current.groups.map((item) => {
            if (item.id !== groupId) return item;
            const previousRoundTotal = item.payments
              .filter((payment) => payment.round === round && (payment.type === 'collection' || payment.type === 'admin-fee'))
              .reduce((sum, payment) => sum + payment.amount, 0);
            const updatedGroup = { ...item, auctions: [...item.auctions, auction] };
            const expectedCollected = getExpectedGroupCollections(updatedGroup);
            const verifiedCollection = Math.max(item.verifiedCollection + collectedAmount - previousRoundTotal, 0);
            return {
              ...item,
              currentRound: round + 1,
              auctions: updatedGroup.auctions,
              payments: [
                ...item.payments.filter((payment) =>
                  payment.round !== round || (payment.type !== 'collection' && payment.type !== 'admin-fee'),
                ),
                ...newPayments,
              ],
              reserveBalance: group.reserveBalance - group.totalAmount,
              verifiedCollection,
              outstanding: Math.max(expectedCollected - verifiedCollection, 0),
              activities: [
                {
                  id: `activity-${Date.now()}`,
                  title: `Final chit payout · Round ${round}`,
                  time: 'just now',
                  detail: `${finalMember.name} received ${group.totalAmount.toLocaleString('en-IN')} from the accumulated chit balance. Contributions were waived for all members this round.`,
                },
                ...item.activities,
              ],
            };
          }),
        }));
        return auction;
      },
      setAuctionMemberPaid: (groupId, auctionId, memberId, isPaid, paidByName) => {
        const user = state.user;
        const group = state.groups.find((item) => item.id === groupId);
        if (
          !user
          || !group
          || !canManageGroup(group, user.id, user.name)
          || !group.members.some((member) => member.id === memberId)
          || !group.auctions.some((auction) => auction.id === auctionId && auction.outcomeType !== 'final-payout')
        ) return false;

        setState((current) => ({
          ...current,
          groups: current.groups.map((item) => {
            if (item.id !== groupId) return item;
            const targetAuction = item.auctions.find((auction) => auction.id === auctionId);
            if (!targetAuction) return item;
            const due = Math.max(item.monthlyContribution - targetAuction.dividendPerMember, 0);
            const adminFeeDue = getAdminFeePerMemberForRound(item.adminFeeMode ?? 'none', item.adminFeeAmount ?? 0, targetAuction.round);
            const oldContribution = targetAuction.contributions?.find((payment) => payment.memberId === memberId)?.amount
              ?? (targetAuction.paidMemberIds.includes(memberId) ? due : 0);
            const nextContribution = isPaid ? due : 0;
            const oldAdminFee = item.payments
              .find((payment) => payment.round === targetAuction.round && payment.type === 'admin-fee' && payment.memberId === memberId)?.amount ?? 0;
            const nextAdminFee = isPaid ? adminFeeDue : 0;
            const delta = nextContribution + nextAdminFee - oldContribution - oldAdminFee;
            const member = item.members.find((currentMember) => currentMember.id === memberId);
            const paymentId = `payment-${auctionId}-${memberId}`;
            if (!member) return item;
            const existingCollectionPayment = item.payments.find((payment) => payment.id === paymentId);
            const nextPaidByName = paidByName?.trim() || existingCollectionPayment?.paidByName || member.name;
            const contributions = (targetAuction.contributions ?? [])
              .filter((payment) => payment.memberId !== memberId);
            if (nextContribution > 0) contributions.push({ memberId, amount: nextContribution });
            const paidMemberIds = new Set(targetAuction.paidMemberIds);
            if (isPaid) paidMemberIds.add(memberId);
            else paidMemberIds.delete(memberId);
            const adminFeePaymentId = `payment-admin-fee-${auctionId}-${memberId}`;
            const payments = item.payments.filter((payment) => payment.id !== paymentId && payment.id !== adminFeePaymentId);
            if (nextContribution > 0 && member) {
              payments.push({
                id: paymentId,
                round: targetAuction.round,
                memberId,
                memberName: member.name,
                ...getPayerDetails(item, memberId, nextPaidByName),
                amount: nextContribution,
                status: 'verified',
                date: targetAuction.date,
                type: 'collection',
              });
            }
            if (nextAdminFee > 0 && member) {
              payments.push({
                id: adminFeePaymentId,
                round: targetAuction.round,
                memberId,
                memberName: member.name,
                ...getPayerDetails(item, memberId, nextPaidByName),
                amount: nextAdminFee,
                status: 'verified',
                date: targetAuction.date,
                type: 'admin-fee',
              });
            }
            const updatedAuctions = item.auctions.map((auction) => auction.id === auctionId
              ? {
                ...auction,
                adminFeeCollected: Math.max(auction.adminFeeCollected - oldAdminFee + nextAdminFee, 0),
                contributions,
                paidMemberIds: [...paidMemberIds],
              }
              : auction);
            const expectedCollected = getExpectedGroupCollections({ ...item, auctions: updatedAuctions });
            const verifiedCollection = Math.max(item.verifiedCollection + delta, 0);
            return {
              ...item,
              auctions: updatedAuctions,
              payments,
              verifiedCollection,
              outstanding: Math.max(expectedCollected - verifiedCollection, 0),
              activities: [
                {
                  id: `activity-payment-${Date.now()}`,
                  title: isPaid ? 'Payment recorded or corrected' : 'Payment marked unpaid',
                  time: 'just now',
                  detail: isPaid
                    ? `${nextPaidByName} paid ${member.name}'s round ${targetAuction.round} contribution of ₹${nextContribution.toLocaleString('en-IN')}${nextPaidByName === member.name ? '' : ` on ${member.name}'s behalf`}.`
                    : `${member.name}'s round ${targetAuction.round} contribution was marked unpaid.`,
                },
                ...item.activities,
              ],
            };
          }),
        }));
        return true;
      },
      deleteGroup: (groupId) => {
        if (!state.user) return false;
        const group = state.groups.find((item) => item.id === groupId);
        if (!group || !canManageGroup(group, state.user.id, state.user.name)) return false;

        setState((current) => ({
          ...current,
          groups: current.groups.filter((item) => item.id !== groupId),
          activities: current.activities.filter((item) => !item.detail.includes(group.name)),
        }));
        return true;
      },
      addMemberToGroup: (groupId, memberName, isGuest = false) =>
        setState((current) => ({
          ...current,
          groups: current.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  memberCount: group.memberCount + 1,
                  members: [
                    ...group.members,
                    {
                      id: `member-${Date.now()}`,
                      name: memberName,
                      role: 'member',
                      status: 'active',
                      phone: '',
                      paidThisMonth: false,
                      isGuest,
                      source: isGuest ? 'guest' : 'invited',
                    },
                  ],
                  pendingInvites: group.pendingInvites,
                }
              : group,
          ),
        })),
      verifyPayment: (groupId, paymentId) =>
        setState((current) => ({
          ...current,
          groups: current.groups.map((group) => {
            if (group.id !== groupId) return group;
            const payment = group.payments.find((item) => item.id === paymentId);
            if (!payment || payment.status !== 'pending' || payment.type !== 'collection') return group;
            return {
              ...group,
              verifiedCollection: group.verifiedCollection + payment.amount,
              outstanding: Math.max(group.outstanding - payment.amount, 0),
              payments: group.payments.map((item) =>
                item.id === paymentId ? { ...item, status: 'verified' } : item,
              ),
              activities: [
                { id: `activity-${Date.now()}`, title: 'Payment verified', time: 'just now', detail: `${payment.memberName}'s ${payment.amount} collection was verified.` },
                ...group.activities,
              ],
            };
          }),
        })),
    }),
    [state, authReady, authInitializationError, isPasswordRecovery],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function getUserProfile(user: User): UserProfile {
  const metadataName = user.user_metadata?.full_name;
  const name = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : user.email?.split('@')[0] || 'New member';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'CM';

  return {
    id: user.id,
    name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    initials,
  };
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'CM';
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string): boolean {
  return value.length > 0 && !value.includes('@') && /^\+?[\d\s().-]{7,20}$/.test(value);
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
