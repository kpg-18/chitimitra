import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialState } from '../data/seed';
import type { AppState, Group, InviteMode, Locale, ThemeMode, Visibility } from '../types';

const STORAGE_KEY = 'chiti-mitra-state-v1';

interface CreateGroupInput {
  name: string;
  description: string;
  visibility: Visibility;
  inviteMode: InviteMode;
  monthlyContribution: number;
  instalmentCount: number;
  dueDay: number;
  guestNames: string[];
  allowGuestMembers: boolean;
}

interface AppContextValue {
  state: AppState;
  theme: ThemeMode;
  locale: Locale;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  addGroup: (group: Group) => void;
  createGroup: (draft: CreateGroupInput) => void;
  addMemberToGroup: (groupId: string, memberName: string, isGuest?: boolean) => void;
  verifyPayment: (groupId: string, paymentId: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(JSON.parse(raw) as AppState);
        }
      } catch (error) {
        console.warn('Persisted state unavailable', error);
      } finally {
        setReady(true);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      theme: state.theme,
      locale: state.locale,
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      setLocale: (locale) => setState((current) => ({ ...current, locale })),
      addGroup: (group) =>
        setState((current) => ({
          ...current,
          groups: [group, ...current.groups],
        })),
      createGroup: (draft) => {
        const guestNames = [...new Set(draft.guestNames.map((name) => name.trim()).filter(Boolean))];
        const currentUser = { id: 'member-self', userId: state.user.id, name: state.user.name, role: 'primary-admin' as const, status: 'active' as const, phone: state.user.phone, paidThisMonth: true, source: 'app-user' as const };
        const invitedMembers = guestNames.map((name, index) => ({
          id: `guest-${Date.now()}-${index}`,
          name,
          role: 'member' as const,
          status: 'pending' as const,
          phone: 'Invited guest',
          paidThisMonth: false,
          isGuest: true,
          source: 'guest' as const,
        }));
        const nextGroup: Group = {
          id: `group-${Date.now()}`,
          createdByUserId: state.user.id,
          name: draft.name.trim(),
          description: draft.description.trim() || 'Community savings group',
          visibility: draft.visibility,
          inviteMode: draft.inviteMode,
          invitationCode: `CHITI-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          inviteLink: `chitmitra://join/${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          allowGuestMembers: draft.allowGuestMembers,
          monthlyContribution: draft.monthlyContribution,
          instalmentCount: draft.instalmentCount,
          memberCount: 1 + invitedMembers.length,
          dueDay: draft.dueDay,
          totalAmount: draft.monthlyContribution * draft.instalmentCount,
          verifiedCollection: 0,
          outstanding: 0,
          currentRound: 1,
          members: [currentUser, ...invitedMembers],
          pendingInvites: guestNames.map((name, index) => ({
            id: `invite-${Date.now()}-${index}`,
            name,
            contact: 'Guest invite pending',
            status: 'pending',
            addedByUserId: state.user.id,
          })),
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
            detail: `${draft.name.trim()} is now visible to the selected members.`,
          }, ...current.activities],
        }));
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
                      status: 'pending',
                      phone: isGuest ? 'Guest invite' : 'Pending verification',
                      paidThisMonth: false,
                      isGuest,
                      source: isGuest ? 'guest' : 'invited',
                    },
                  ],
                  pendingInvites: isGuest
                    ? [
                        ...group.pendingInvites,
                        { id: `invite-${Date.now()}`, name: memberName, contact: 'Guest invite pending', status: 'pending', addedByUserId: state.user.id },
                      ]
                    : group.pendingInvites,
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
    [state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
