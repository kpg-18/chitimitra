import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { formatCurrency } from '../src/lib/finance';
import { getText } from '../src/lib/i18n';
import type { Visibility } from '../src/types';

export default function GroupsScreen() {
  const { state, createGroup } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [inviteMode, setInviteMode] = useState<'code' | 'link' | 'manual'>('code');
  const [monthlyContribution, setMonthlyContribution] = useState('5000');
  const [dueDay, setDueDay] = useState('8');
  const [guestInput, setGuestInput] = useState('');
  const [guestNames, setGuestNames] = useState<string[]>([]);

  const visibleGroups = useMemo(
    () => state.groups.filter((group) => group.members.some(
      (member) => member.userId === state.user.id || (!member.userId && member.name === state.user.name),
    )),
    [state.groups, state.user.name],
  );
  const publicGroups = useMemo(
    () => state.groups.filter(
      (group) => group.visibility === 'public' && !visibleGroups.some((visible) => visible.id === group.id),
    ),
    [state.groups, visibleGroups],
  );

  const addGuest = () => {
    const clean = guestInput.trim();
    if (!clean || guestNames.includes(clean)) return;
    setGuestNames((current) => [...current, clean]);
    setGuestInput('');
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createGroup({
      name,
      description,
      visibility,
      inviteMode,
      monthlyContribution: Number(monthlyContribution) || 5000,
      instalmentCount: 20,
      dueDay: Number(dueDay) || 8,
      guestNames: guestNames,
      allowGuestMembers: true,
    });
    setName('');
    setDescription('');
    setVisibility('private');
    setInviteMode('code');
    setMonthlyContribution('5000');
    setDueDay('8');
    setGuestNames([]);
    router.push('/');
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'groups')}</Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Create premium chit group</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Short description"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Visibility</Text>
          <View style={styles.segmentRow}>
            {(['private', 'public'] as Visibility[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segmentButton, { backgroundColor: visibility === option ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                onPress={() => setVisibility(option)}
              >
                <Text style={[styles.segmentText, { color: visibility === option ? palette.primary : palette.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Invite method</Text>
          <View style={styles.segmentRow}>
            {(['code', 'link', 'manual'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segmentButton, { backgroundColor: inviteMode === option ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                onPress={() => setInviteMode(option)}
              >
                <Text style={[styles.segmentText, { color: inviteMode === option ? palette.primary : palette.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.doubleRow}>
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: palette.muted }]}>Contribution</Text>
              <TextInput
                value={monthlyContribution}
                keyboardType="numeric"
                onChangeText={setMonthlyContribution}
                placeholder="5000"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: palette.muted }]}>Due day</Text>
              <TextInput
                value={dueDay}
                keyboardType="numeric"
                onChangeText={setDueDay}
                placeholder="8"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Add invited people / guest names</Text>
          <View style={styles.rowAdd}>
            <TextInput
              value={guestInput}
              onChangeText={setGuestInput}
              placeholder="Type name and tap add"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg, flex: 1, marginBottom: 0 }]}
            />
            <TouchableOpacity style={[styles.smallButton, { backgroundColor: palette.primary }]} onPress={addGuest}>
              <Text style={styles.smallButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {guestNames.length > 0 && (
            <View style={styles.chipRow}>
              {guestNames.map((guest) => (
                <View key={guest} style={[styles.chip, { backgroundColor: palette.primarySoft }]}>
                  <Text style={[styles.chipText, { color: palette.primary }]}>{guest}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: palette.primary }]} onPress={handleCreate}>
            <Text style={styles.primaryText}>Create Group</Text>
          </TouchableOpacity>
        </View>

        {visibleGroups.map((group) => (
          <View key={group.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
              <Text style={[styles.badge, { color: palette.primary, backgroundColor: palette.primarySoft }]}>{group.visibility}</Text>
            </View>
            <Text style={[styles.groupDescription, { color: palette.muted }]}>{group.description}</Text>
            <View style={styles.metaGrid}>
              <InfoBubble label="Invite" value={group.invitationCode} palette={palette} />
              <InfoBubble label="Due" value={`₹${group.monthlyContribution.toLocaleString('en-IN')}`} palette={palette} />
              <InfoBubble label="Members" value={String(group.memberCount)} palette={palette} />
              <InfoBubble label="Link" value={group.inviteMode} palette={palette} />
            </View>
            <View style={styles.memberList}>
              {group.members.slice(0, 4).map((member) => (
                <View key={member.id} style={[styles.memberRow, { backgroundColor: palette.softBg }]}>
                  <Text style={[styles.memberInitials, { backgroundColor: palette.primarySoft, color: palette.primary }]}>{member.name.slice(0, 2).toUpperCase()}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: palette.text }]}>{member.name}</Text>
                    <Text style={[styles.memberStatus, { color: palette.muted }]}>{member.status === 'active' ? 'Active' : 'Pending'} · {member.role}</Text>
                  </View>
                </View>
              ))}

              {publicGroups.length > 0 && (
                <>
                  <Text style={[styles.discoverTitle, { color: palette.text }]}>Discover public groups</Text>
                  <Text style={[styles.discoverDescription, { color: palette.muted }]}>
                    Public listings show group information only. Member records, invitations, and finances stay private.
                  </Text>
                  {publicGroups.map((group) => (
                    <View key={group.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
                        <Text style={[styles.badge, { color: palette.primary, backgroundColor: palette.primarySoft }]}>Public</Text>
                      </View>
                      <Text style={[styles.groupDescription, { color: palette.muted }]}>{group.description}</Text>
                      <Text style={[styles.publicMeta, { color: palette.muted }]}>Join policy: contact group admin</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
            {group.pendingInvites.length > 0 && (
              <View style={styles.pendingInviteBox}>
                <Text style={[styles.pendingTitle, { color: palette.text }]}>Pending invites</Text>
                {group.pendingInvites.map((invite) => (
                  <Text key={invite.id} style={[styles.pendingText, { color: palette.muted }]}>{invite.name} · {invite.status}</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active={false} onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active={false} onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active={false} onPress={() => router.push('/activity')} palette={palette} />
        <NavItem label="Profile" active={false} onPress={() => router.push('/profile')} palette={palette} />
      </View>
    </View>
  );
}

function InfoBubble({ label, value, palette }: { label: string; value: string; palette: typeof lightColors }) {
  return (
    <View style={[styles.infoBubble, { backgroundColor: palette.softBg }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function NavItem({ label, active, onPress, palette }: { label: string; active: boolean; onPress: () => void; palette: typeof lightColors }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navText, { color: active ? palette.primary : palette.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const lightColors = {
  bg: '#f5f5f1',
  card: '#ffffff',
  header: '#f6f8f4',
  border: '#e3e7df',
  primary: '#1b7f6a',
  primarySoft: '#dff5ee',
  softBg: '#eef3f0',
  text: '#17212b',
  muted: '#54606d',
};

const darkColors = {
  bg: '#111827',
  card: '#1a2333',
  header: '#131d2a',
  border: '#2c3a4d',
  primary: '#7ae4c5',
  primarySoft: '#103a31',
  softBg: '#1d2d3f',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 14 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentButton: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontWeight: '700', textTransform: 'capitalize' },
  doubleRow: { flexDirection: 'row', gap: 10 },
  fieldWrap: { flex: 1 },
  rowAdd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  smallButtonText: { color: '#fff', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  primaryButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  groupName: { fontSize: 18, fontWeight: '700' },
  groupDescription: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  discoverTitle: { fontSize: 19, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  discoverDescription: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  publicMeta: { fontSize: 12, marginTop: 12 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  infoBubble: { width: '48%', borderRadius: 12, padding: 10 },
  infoLabel: { fontSize: 10, marginBottom: 4, textTransform: 'uppercase' },
  infoValue: { fontSize: 12, fontWeight: '700' },
  memberList: { marginTop: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 8 },
  memberInitials: { width: 28, height: 28, borderRadius: 14, marginRight: 10, textAlign: 'center', lineHeight: 28, fontSize: 12, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '700' },
  memberStatus: { marginTop: 2, fontSize: 11 },
  pendingInviteBox: { marginTop: 12, borderRadius: 12, padding: 10, backgroundColor: '#f8f4eb' },
  pendingTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  pendingText: { fontSize: 12, marginTop: 2 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
