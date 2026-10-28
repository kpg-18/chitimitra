import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { AppProvider, useAppContext } from '../src/context/AppContext';

function AppShell() {
  const { state, authReady, isPasswordRecovery } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const segments = useSegments();
  const rootSegment = segments[0];

  if (!authReady) {
    return (
      <View style={[styles.loading, { backgroundColor: isDark ? '#111827' : '#f5f5f1' }]}>
        <ActivityIndicator color={isDark ? '#7ae4c5' : '#1b7f6a'} />
      </View>
    );
  }

  if (!state.user && rootSegment !== 'auth') {
    return <Redirect href="/auth" />;
  }

  if (state.user && rootSegment === 'auth' && !isPasswordRecovery) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? '#111827' : '#f5f5f1' } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
