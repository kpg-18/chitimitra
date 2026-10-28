import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { getMemberGroups } from '../src/lib/groupAccess';
import { getText } from '../src/lib/i18n';

export default function ActivityScreen() {
  const { state } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const visibleActivities = state.user
    ? getMemberGroups(state.groups, state.user.id, state.user.name).flatMap((group) => group.activities)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'activity')}</Text>
        {visibleActivities.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.title, { color: palette.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>{item.time}</Text>
            <Text style={[styles.detail, { color: palette.muted }]}>{item.detail}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active={false} onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active={false} onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active={false} onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active onPress={() => router.push('/activity')} palette={palette} />
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
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 12 },
  detail: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
