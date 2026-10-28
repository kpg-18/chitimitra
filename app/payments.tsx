import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { formatCurrency } from '../src/lib/finance';
import { getText } from '../src/lib/i18n';

export default function PaymentsScreen() {
  const { state, verifyPayment } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;

  const visibleGroups = state.groups.filter((group) => group.members.some(
    (member) => member.userId === state.user.id || (!member.userId && member.name === state.user.name),
  ));
  const payments = visibleGroups.flatMap((group) =>
    group.payments.map((payment) => ({
      ...payment,
      groupId: group.id,
      groupName: group.name,
      canVerify: group.members.some((member) =>
        (member.userId === state.user.id || (!member.userId && member.name === state.user.name))
        && (member.role === 'primary-admin' || member.role === 'admin'),
      ),
    })),
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'payments')}</Text>
        {payments.length === 0 ? (
          <Text style={[styles.empty, { color: palette.muted }]}>No payment updates yet.</Text>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={[styles.paymentCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.memberName, { color: palette.text }]}>{payment.memberName}</Text>
                <Text style={[styles.amount, { color: palette.primary }]}>{formatCurrency(payment.amount)}</Text>
              </View>
              <Text style={[styles.meta, { color: palette.muted }]}>{payment.groupName}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{payment.date}</Text>
              <Text style={[styles.status, { color: payment.status === 'verified' ? palette.primary : palette.muted }]}>
                {payment.status === 'verified' ? 'Verified' : 'Pending verification'}
              </Text>
              {payment.status === 'pending' && payment.type === 'collection' && payment.canVerify && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: palette.primary }]}
                  onPress={() => verifyPayment(payment.groupId, payment.id)}
                >
                  <Text style={styles.primaryText}>Verify payment</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active={false} onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active={false} onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active={false} onPress={() => router.push('/activity')} palette={palette} />
        <NavItem label="Profile" active={false} onPress={() => router.push('/profile')} palette={palette} />
      </View>
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
  text: '#17212b',
  muted: '#54606d',
};

const darkColors = {
  bg: '#111827',
  card: '#1a2333',
  header: '#131d2a',
  border: '#2c3a4d',
  primary: '#7ae4c5',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 14 },
  paymentCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 18, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 6 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  primaryButton: { marginTop: 14, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  empty: { fontSize: 14 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
