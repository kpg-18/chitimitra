import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { formatCurrency, getCollectionSummary } from '../src/lib/finance';
import { getText } from '../src/lib/i18n';

export default function HomeScreen() {
  const { state } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const visibleGroups = state.groups.filter(
    (group) => group.members.some(
      (member) => member.userId === state.user.id || (!member.userId && member.name === state.user.name),
    ),
  );
  const summary = getCollectionSummary(visibleGroups);
  const recentActivities = visibleGroups.flatMap((group) => group.activities);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.primary }]}>Premium community finance</Text>
          <Text style={[styles.title, { color: palette.text }]}>{getText(state.locale, 'appTitle')}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Visible groups only for current members and admins</Text>
          <View style={styles.inlineRow}>
            <View style={[styles.pill, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.pillText, { color: palette.primary }]}>{visibleGroups.length} Active groups</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: palette.softBg }]}>
              <Text style={[styles.pillText, { color: palette.text }]}>{visibleGroups[0]?.invitationCode ?? 'NAGAR-42'}</Text>
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
  scrollContent: { padding: 18, paddingBottom: 100 },
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
