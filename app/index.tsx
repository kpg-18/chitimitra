import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { formatCurrency, getCollectionSummary } from '../src/lib/finance';
import { getMemberGroups } from '../src/lib/groupAccess';
import { getText } from '../src/lib/i18n';

export default function HomeScreen() {
  const { state, authInitializationError } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const user = state.user;
  const visibleGroups = user ? getMemberGroups(state.groups, user.id, user.name) : [];
  const summary = getCollectionSummary(visibleGroups);
  const recentActivities = visibleGroups.flatMap((group) => group.activities);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.48] });
  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const logoOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Animated.Image
              source={require('../assets/chiti-mitra-logo.png')}
              resizeMode="contain"
              accessibilityLabel="Chiti Mitra logo"
              style={[styles.brandMark, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
            />
            <View style={styles.brandCopy}>
              <Text style={[styles.eyebrow, { color: palette.primary }]}>CHITI MITRA · ಚಿಟಿ ಮಿತ್ರ</Text>
              <Text numberOfLines={1} style={[styles.welcome, { color: palette.text }]}>
                {user ? `Namaskara, ${user.name.split(' ')[0]}` : 'Welcome to Chiti Mitra'}
              </Text>
            </View>
          </View>
          {authInitializationError ? (
            <Text accessibilityRole="alert" style={styles.startupError}>{authInitializationError}</Text>
          ) : null}
          <View style={[styles.avatar, { backgroundColor: palette.primarySoft }]}>
            <Text style={[styles.avatarText, { color: palette.primary }]}>{user?.initials ?? 'CM'}</Text>
          </View>
        </View>

        {visibleGroups.length === 0 ? (
          <>
            <View style={[styles.emptyHero, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.illustration}>
                <Animated.View style={[styles.orbit, { borderColor: palette.primary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <View style={[styles.coinOuter, { backgroundColor: palette.primarySoft }]}>
                  <View style={[styles.coinInner, { backgroundColor: palette.primary }]}>
                    <Text style={styles.coinSymbol}>₹</Text>
                  </View>
                </View>
                <View style={[styles.sparkle, styles.sparkleOne, { backgroundColor: palette.gold }]} />
                <View style={[styles.sparkle, styles.sparkleTwo, { backgroundColor: palette.primary }]} />
                <View style={[styles.sparkle, styles.sparkleThree, { backgroundColor: palette.gold }]} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>Good things grow together.</Text>
              <Text style={[styles.emptyCopy, { color: palette.muted }]}>
                Start a trusted savings circle. Organise contributions, people and every important update in one clear place.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.createButton, { backgroundColor: palette.primary }]}
                onPress={() => router.push(user ? '/groups' : '/auth')}
              >
                <Text style={styles.createButtonText}>{user ? 'Create your first group' : 'Enter your name'}</Text>
                <Text style={styles.createButtonArrow}>→</Text>
              </TouchableOpacity>
              <Text style={[styles.helperNote, { color: palette.muted }]}>Private by default · Invite people or add guest members</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: palette.text }]}>A simpler way to stay in sync</Text>
            <OnboardingStep number="01" title="Set up your circle" detail="Choose a name, monthly amount and due date." palette={palette} />
            <OnboardingStep number="02" title="Bring everyone together" detail="Invite app users or keep guest member records for people who are not using the app yet." palette={palette} />
            <OnboardingStep number="03" title="Keep a clear record" detail="Track collections, payment status and group updates in one place." palette={palette} />

            <View style={[styles.privacyNote, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.privacyTitle, { color: palette.primary }]}>Your groups, your circle</Text>
              <Text style={[styles.privacyCopy, { color: palette.text }]}>
                Private groups are not listed in discovery. Only add people who should be part of that group.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.eyebrow, { color: palette.primary }]}>YOUR COMMUNITY OVERVIEW</Text>
              <Text style={[styles.title, { color: palette.text }]}>{getText(state.locale, 'myGroups')}</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>A clear view of your active circles.</Text>
              <View style={styles.inlineRow}>
                <View style={[styles.pill, { backgroundColor: palette.primarySoft }]}>
                  <Text style={[styles.pillText, { color: palette.primary }]}>{visibleGroups.length} Active groups</Text>
                </View>
              </View>
            </View>

            <View style={styles.grid}>
              <MetricCard label={getText(state.locale, 'thisMonthCollection')} value={formatCurrency(summary.verified)} palette={palette} />
              <MetricCard label={getText(state.locale, 'monthlyDue')} value={formatCurrency(summary.outstanding)} palette={palette} />
              <MetricCard label={getText(state.locale, 'verified')} value={formatCurrency(summary.verified)} palette={palette} />
              <MetricCard label={getText(state.locale, 'outstanding')} value={formatCurrency(summary.outstanding)} palette={palette} />
            </View>

            <View style={[styles.groupStrip, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {visibleGroups.map((group) => (
                <View key={group.id} style={[styles.groupRow, { backgroundColor: palette.softBg }]}>
                  <View>
                    <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
                    <Text style={[styles.groupMeta, { color: palette.muted }]}>{group.memberCount} members • {group.visibility}</Text>
                  </View>
                  <Text style={[styles.groupValue, { color: palette.primary }]}>{formatCurrency(group.verifiedCollection)}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent group activity</Text>
            {recentActivities.map((activity) => (
              <View key={activity.id} style={[styles.activityCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.activityTitle, { color: palette.text }]}>{activity.title}</Text>
                <Text style={[styles.activityMeta, { color: palette.muted }]}>{activity.time}</Text>
                <Text style={[styles.activityDetail, { color: palette.muted }]}>{activity.detail}</Text>
              </View>
            ))}

            <View style={[styles.quickActions, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{getText(state.locale, 'quickActions')}</Text>
              <View style={styles.actionGrid}>
                <ActionButton label={getText(state.locale, 'addGroup')} onPress={() => router.push('/groups')} palette={palette} />
                <ActionButton label={getText(state.locale, 'recordPayment')} onPress={() => router.push('/payments')} palette={palette} />
                <ActionButton label={getText(state.locale, 'shareInvitation')} onPress={() => router.push('/groups')} palette={palette} />
                <ActionButton label={getText(state.locale, 'verifyPayment')} onPress={() => router.push('/payments')} palette={palette} />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active={false} onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active={false} onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active={false} onPress={() => router.push('/activity')} palette={palette} />
        <NavItem label="Profile" active={false} onPress={() => router.push('/profile')} palette={palette} />
      </View>
    </View>
  );
}

function OnboardingStep({ number, title, detail, palette }: { number: string; title: string; detail: string; palette: typeof lightColors }) {
  return (
    <View style={[styles.stepCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.stepNumber, { color: palette.primary, backgroundColor: palette.primarySoft }]}>{number}</Text>
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.stepDetail, { color: palette.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

function MetricCard({ label, value, palette }: { label: string; value: string; palette: typeof lightColors }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, palette }: { label: string; onPress: () => void; palette: typeof lightColors }) {
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: palette.primarySoft, borderColor: palette.border }]} onPress={onPress}>
      <Text style={[styles.actionText, { color: palette.primary }]}>{label}</Text>
    </TouchableOpacity>
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
  gold: '#edb647',
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
  gold: '#e8b95c',
  softBg: '#1d2d3f',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 100 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  brandBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 44, height: 44, borderRadius: 12 },
  brandCopy: { flex: 1, minWidth: 0 },
  startupError: { color: '#b42318', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  welcome: { fontSize: 21, fontWeight: '700', marginTop: 6, flexShrink: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700' },
  emptyHero: { borderRadius: 26, borderWidth: 1, padding: 20, alignItems: 'center', overflow: 'hidden' },
  illustration: { height: 160, width: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  orbit: { position: 'absolute', width: 142, height: 142, borderRadius: 71, borderWidth: 1.5 },
  coinOuter: { height: 104, width: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  coinInner: { height: 76, width: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', shadowColor: '#0b3028', shadowOpacity: 0.2, shadowRadius: 16, elevation: 5 },
  coinSymbol: { color: '#ffffff', fontSize: 42, fontWeight: '700', marginTop: -4 },
  sparkle: { position: 'absolute', width: 9, height: 9, borderRadius: 5 },
  sparkleOne: { top: 24, right: 49 },
  sparkleTwo: { left: 36, top: 54, width: 7, height: 7 },
  sparkleThree: { right: 28, bottom: 30, width: 6, height: 6 },
  emptyTitle: { fontSize: 25, lineHeight: 32, textAlign: 'center', fontWeight: '800', letterSpacing: -0.5 },
  emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, maxWidth: 320 },
  createButton: { width: '100%', minHeight: 52, borderRadius: 15, paddingHorizontal: 16, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  createButtonArrow: { color: '#ffffff', fontSize: 20, marginLeft: 10, marginTop: -2 },
  authActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 10 },
  authAction: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  authActionText: { fontSize: 14, fontWeight: '700' },
  helperNote: { fontSize: 11, textAlign: 'center', marginTop: 12 },
  stepCard: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', padding: 15, marginBottom: 10 },
  stepNumber: { width: 38, height: 38, lineHeight: 38, textAlign: 'center', borderRadius: 12, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  stepContent: { flex: 1, marginLeft: 12 },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepDetail: { marginTop: 4, fontSize: 12, lineHeight: 18 },
  privacyNote: { borderRadius: 17, padding: 15, marginTop: 6 },
  privacyTitle: { fontSize: 14, fontWeight: '800' },
  privacyCopy: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  heroCard: { borderRadius: 24, padding: 18, marginBottom: 18, borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '700', marginTop: 6 },
  subtitle: { marginTop: 8, fontSize: 14 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  metricCard: { width: '48%', borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  metricLabel: { fontSize: 12, marginBottom: 8 },
  metricValue: { fontSize: 20, fontWeight: '700' },
  groupStrip: { borderRadius: 18, borderWidth: 1, padding: 12, marginTop: 6 },
  groupRow: { borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 15, fontWeight: '700' },
  groupMeta: { marginTop: 4, fontSize: 11 },
  groupValue: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  activityCard: { borderRadius: 18, padding: 14, borderWidth: 1, marginBottom: 12 },
  activityTitle: { fontSize: 15, fontWeight: '700' },
  activityMeta: { marginTop: 4, fontSize: 12 },
  activityDetail: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  quickActions: { borderRadius: 18, padding: 14, borderWidth: 1, marginTop: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionButton: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, minWidth: '46%' },
  actionText: { fontSize: 12, fontWeight: '600' },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
