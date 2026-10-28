import { router } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { getText } from '../src/lib/i18n';
import type { Locale, ThemeMode } from '../src/types';

export default function ProfileScreen() {
  const { state, setTheme, setLocale } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;

  const toggleTheme = (mode: ThemeMode) => setTheme(mode);
  const toggleLang = (locale: Locale) => setLocale(locale);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'profile')}</Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{state.user.initials}</Text></View>
          <Text style={[styles.name, { color: palette.text }]}>{state.user.name}</Text>
          <Text style={[styles.subtle, { color: palette.muted }]}>{state.user.email}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.section, { color: palette.text }]}>{getText(state.locale, 'language')}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.option, { backgroundColor: state.locale === 'kn' ? palette.primarySoft : palette.softBg }]} onPress={() => toggleLang('kn')}>
              <Text style={{ color: palette.text }}>Kannada / English</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.option, { backgroundColor: state.locale === 'en' ? palette.primarySoft : palette.softBg }]} onPress={() => toggleLang('en')}>
              <Text style={{ color: palette.text }}>English</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.section, { color: palette.text }]}>{getText(state.locale, 'darkMode')}</Text>
          <View style={styles.themeList}>
            <ThemeToggle label="Light" checked={state.theme === 'light'} onPress={() => toggleTheme('light')} palette={palette} />
            <ThemeToggle label="Dark" checked={state.theme === 'dark'} onPress={() => toggleTheme('dark')} palette={palette} />
            <ThemeToggle label="System" checked={state.theme === 'system'} onPress={() => toggleTheme('system')} palette={palette} />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.text }]}>Theme sync</Text>
            <Switch value={isDark} onValueChange={(value) => setTheme(value ? 'dark' : 'light')} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active={false} onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active={false} onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active={false} onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active={false} onPress={() => router.push('/activity')} palette={palette} />
        <NavItem label="Profile" active onPress={() => router.push('/profile')} palette={palette} />
      </View>
    </View>
  );
}

function ThemeToggle({ label, checked, onPress, palette }: { label: string; checked: boolean; onPress: () => void; palette: typeof lightColors }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.themeToggle, { backgroundColor: checked ? palette.primarySoft : palette.softBg }]}>
      <Text style={{ color: palette.text }}>{label}</Text>
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
  content: { padding: 18, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 14 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#1b7f6a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  subtle: { fontSize: 13, marginTop: 6 },
  section: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  themeList: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  themeToggle: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
