import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { formatCurrency } from '../src/lib/finance';
import { canManageGroup, getMemberGroups } from '../src/lib/groupAccess';
import { getText } from '../src/lib/i18n';

export default function PaymentsScreen() {
  const { state, verifyPayment } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;

  const user = state.user;
  const visibleGroups = user ? getMemberGroups(state.groups, user.id, user.name) : [];
  const payments = visibleGroups.flatMap((group) =>
    group.payments.map((payment) => ({
      ...payment,
      groupId: group.id,
      groupName: group.name,
      canVerify: user ? canManageGroup(group, user.id, user.name) : false,
    })),
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'payments')}</Text>
        {visibleGroups.map((group) => (
          <View key={`ledger-${group.id}`} style={[styles.ledgerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.ledgerTitle, { color: palette.text }]}>{group.name} · Member ledger</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>
              Accumulated chit balance {formatCurrency(group.reserveBalance)} · Outstanding {formatCurrency(group.outstanding)}
            </Text>
            {group.members.map((member) => {
              const memberPayments = group.payments.filter((payment) => payment.memberId === member.id && payment.status === 'verified');
              const contributions = memberPayments
                .filter((payment) => payment.type === 'collection')
                .reduce((sum, payment) => sum + payment.amount, 0);
              const fees = memberPayments
                .filter((payment) => payment.type === 'admin-fee')
                .reduce((sum, payment) => sum + payment.amount, 0);
              const payouts = memberPayments
                .filter((payment) => payment.type === 'payout')
                .reduce((sum, payment) => sum + payment.amount, 0);
              const paidOnBehalf = memberPayments
                .filter((payment) => payment.type === 'collection' && payment.paidByName && payment.paidByName !== member.name);
              const paidForOthers = group.payments.filter((payment) =>
                payment.type === 'collection' && payment.status === 'verified' && payment.paidByMemberId === member.id,
              );
              return (
                <View key={member.id} style={[styles.ledgerMember, { borderTopColor: palette.border }]}>
                  <Text style={[styles.memberName, { color: palette.text }]}>{member.name}</Text>
                  <Text style={[styles.meta, { color: palette.muted }]}>
                    Contributions {formatCurrency(contributions)} · Fees {formatCurrency(fees)} · Payouts received {formatCurrency(payouts)}
                  </Text>
                  {paidOnBehalf.map((payment) => (
                    <Text key={payment.id} style={[styles.meta, { color: palette.primary }]}>
                      {payment.paidByName} paid {formatCurrency(payment.amount)} for {member.name} · Round {payment.round}
                    </Text>
                  ))}
                  {paidForOthers.map((payment) => (
                    <Text key={payment.id} style={[styles.meta, { color: palette.muted }]}>
                      Paid {formatCurrency(payment.amount)} for {payment.memberName} · Round {payment.round}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
        {payments.length === 0 ? (
          <Text style={[styles.empty, { color: palette.muted }]}>No payment updates yet.</Text>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={[styles.paymentCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.memberName, { color: palette.text }]}>{payment.memberName}</Text>
                <Text style={[styles.amount, { color: palette.primary }]}>{formatCurrency(payment.amount)}</Text>
              </View>
              <Text style={[styles.meta, { color: palette.muted }]}>
                {payment.groupName}{payment.round ? ` · Round ${payment.round}` : ''}
                {payment.type === 'admin-fee' ? ' · Admin fee' : payment.type === 'payout' ? ' · Payout' : ' · Contribution'}
              </Text>
              {payment.type !== 'payout' && (
                <Text style={[styles.meta, { color: palette.muted }]}>
                  {payment.paidByName && payment.paidByName !== payment.memberName
                    ? `Paid by ${payment.paidByName} for ${payment.memberName}`
                    : `Paid by ${payment.memberName}`}
                </Text>
              )}
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
  ledgerCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  ledgerTitle: { fontSize: 17, fontWeight: '700' },
  ledgerMember: { borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
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
