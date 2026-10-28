import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { AUTHENTICATION_ENABLED, useAppContext } from '../src/context/AppContext';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthScreen() {
  const { mode: requestedMode, code: authCode } = useLocalSearchParams<{ mode?: string; code?: string | string[] }>();
  const {
    state,
    authConfigured,
    isPasswordRecovery,
    authInitializationError,
    continueAsGuest,
    signIn,
    signInWithGoogle,
    signUp,
    sendPasswordReset,
    exchangeAuthCode,
    updatePassword,
  } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = useMemo(() => isDark ? darkColors : lightColors, [isDark]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const processedCodes = useRef(new Set<string>());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const code = Array.isArray(authCode) ? authCode[0] : authCode;
  const mode: AuthMode = isPasswordRecovery ? 'reset' : getRequestedMode(requestedMode);

  useEffect(() => {
    if (!AUTHENTICATION_ENABLED || !code || !authConfigured || processedCodes.current.has(code)) return;
    processedCodes.current.add(code);
    void exchangeAuthCode(code)
      .catch((authError: unknown) => setError(getErrorMessage(authError)))
      .finally(() => setIsSubmitting(false));
  }, [authConfigured, code, exchangeAuthCode]);

  if (!AUTHENTICATION_ENABLED) {
    return (
      <NameEntryScreen
        palette={palette}
        initializationError={authInitializationError}
        continueAsGuest={continueAsGuest}
      />
    );
  }

  const changeMode = (nextMode: AuthMode) => {
    router.setParams({ mode: nextMode, code: undefined });
    setMessage('');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    setError('');
    setMessage('');

    if (!authConfigured) {
      setError('Account access is not configured yet. Add your Supabase project URL and anon key to enable it.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Enter your name to create an account.');
      return;
    }
    if (mode === 'signup' || mode === 'reset') {
      if (password.length < 8) {
        setError('Choose a password with at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
    }
    if (mode === 'login' && !password) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const needsEmailConfirmation = await signUp(name.trim(), cleanEmail, password);
        if (needsEmailConfirmation) {
          router.setParams({ mode: 'login', code: undefined });
          setPassword('');
          setConfirmPassword('');
          setMessage('Check your email to confirm your account, then log in.');
        } else {
          router.replace('/');
        }
      } else if (mode === 'login') {
        await signIn(cleanEmail, password);
        router.replace('/');
      } else if (mode === 'forgot') {
        await sendPasswordReset(cleanEmail);
        setMessage('If an account exists for this email, a password reset link is on its way.');
      } else {
        await updatePassword(password);
        setMessage('Your password has been updated.');
        router.replace('/');
      }
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    if (!authConfigured) {
      setError('Account access is not configured yet. Add the Supabase URL and anon key to enable Google sign-in.');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) router.replace('/');
      else setIsGoogleSubmitting(false);
    } catch (authError) {
      setError(getErrorMessage(authError));
      setIsGoogleSubmitting(false);
    }
  };

  const title = mode === 'signup'
    ? 'Create your account'
    : mode === 'forgot'
      ? 'Reset your password'
      : mode === 'reset'
        ? 'Choose a new password'
        : 'Welcome back';
  const description = mode === 'signup'
    ? 'Create a secure account to manage your savings circles.'
    : mode === 'forgot'
      ? 'We’ll send a secure password reset link to your email.'
      : mode === 'reset'
        ? 'Choose a new password for your Chiti Mitra account.'
        : 'Log in to continue to your groups and payments.';
  const submitLabel = mode === 'signup'
    ? 'Create account'
    : mode === 'forgot'
      ? 'Send reset link'
      : mode === 'reset'
        ? 'Save new password'
        : 'Log in';

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
            <Text style={[styles.backText, { color: palette.primary }]}>← Chiti Mitra</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.brandMark, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.brandSymbol, { color: palette.primary }]}>₹</Text>
            </View>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.description, { color: palette.muted }]}>{description}</Text>

            {!authConfigured && (
              <View style={[styles.notice, { backgroundColor: palette.primarySoft }]}>
                <Text style={[styles.noticeText, { color: palette.text }]}>
                  Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your local environment to enable account access.
                </Text>
              </View>
            )}

            {mode === 'signup' && (
              <TextInput
                accessibilityLabel="Your name"
                autoComplete="name"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            )}

            {mode !== 'reset' && (
              <TextInput
                accessibilityLabel="Email address"
                autoComplete="email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                textContentType="emailAddress"
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <TextInput
                accessibilityLabel={mode === 'reset' ? 'New password' : 'Password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'reset' ? 'New password' : 'Password'}
                placeholderTextColor={palette.muted}
                returnKeyType="done"
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <>
                <TextInput
                  accessibilityLabel={mode === 'reset' ? 'New password' : 'Confirm password'}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={mode === 'reset' ? 'Confirm new password' : 'Confirm password'}
                  placeholderTextColor={palette.muted}
                  returnKeyType="done"
                  textContentType="newPassword"
                  style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
                />
                <Text style={[styles.helperText, { color: palette.muted }]}>Use at least 8 characters.</Text>
              </>
            )}

            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            {message ? <Text accessibilityRole="status" style={[styles.messageText, { color: palette.primary }]}>{message}</Text> : null}

            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSubmitting || isGoogleSubmitting || !authConfigured}
              onPress={() => void handleSubmit()}
              style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: isSubmitting || isGoogleSubmitting || !authConfigured ? 0.6 : 1 }]}
            >
              {isSubmitting
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={styles.primaryButtonText}>{submitLabel}</Text>}
            </TouchableOpacity>

            {mode !== 'reset' && (
              <>
                <View style={styles.separator}>
                  <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
                  <Text style={[styles.separatorText, { color: palette.muted }]}>OR</Text>
                  <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={isSubmitting || isGoogleSubmitting || !authConfigured}
                  onPress={() => void handleGoogleSignIn()}
                  style={[
                    styles.googleButton,
                    { backgroundColor: palette.card, borderColor: palette.border, opacity: isSubmitting || isGoogleSubmitting || !authConfigured ? 0.6 : 1 },
                  ]}
                >
                  {isGoogleSubmitting
                    ? <ActivityIndicator color={palette.primary} />
                    : (
                      <>
                        <Text style={styles.googleMark}>G</Text>
                        <Text style={[styles.googleButtonText, { color: palette.text }]}>Continue with Google</Text>
                      </>
                    )}
                </TouchableOpacity>
              </>
            )}

            {mode === 'login' && (
              <TouchableOpacity accessibilityRole="button" onPress={() => changeMode('forgot')} style={styles.textButton}>
                <Text style={[styles.linkText, { color: palette.primary }]}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {mode !== 'reset' && mode !== 'forgot' && (
              <View style={styles.switchRow}>
                <Text style={[styles.switchText, { color: palette.muted }]}>
                  {mode === 'signup' ? 'Already have an account?' : 'New to Chiti Mitra?'}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => changeMode(mode === 'signup' ? 'login' : 'signup')}
                >
                  <Text style={[styles.linkText, { color: palette.primary }]}>
                    {mode === 'signup' ? 'Log in' : 'Create account'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <TouchableOpacity accessibilityRole="button" onPress={() => changeMode('login')} style={styles.textButton}>
                <Text style={[styles.linkText, { color: palette.primary }]}>Back to log in</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function NameEntryScreen({
  palette,
  initializationError,
  continueAsGuest,
}: {
  palette: typeof lightColors;
  initializationError: string | null;
  continueAsGuest: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    setError('');
    if (!name.trim()) {
      setError('Enter your name to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await continueAsGuest(name);
      router.replace('/');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.brandMark, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.brandSymbol, { color: palette.primary }]}>₹</Text>
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Welcome to Chiti Mitra</Text>
            <Text style={[styles.description, { color: palette.muted }]}>
              What should we call you?
            </Text>
            {initializationError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{initializationError}</Text>
            ) : null}
            <TextInput
              accessibilityLabel="Your name"
              autoComplete="name"
              autoCapitalize="words"
              autoFocus
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => void handleContinue()}
              placeholder="Your name"
              placeholderTextColor={palette.muted}
              returnKeyType="go"
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
            />
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void handleContinue()}
              style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: isSubmitting ? 0.6 : 1 }]}
            >
              {isSubmitting
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={styles.primaryButtonText}>Continue</Text>}
            </TouchableOpacity>
            <Text style={[styles.namePrivacyNote, { color: palette.muted }]}>
              Your name is saved on this device. You can continue without an account.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function getRequestedMode(mode: string | undefined): AuthMode {
  return mode === 'signup' || mode === 'forgot' || mode === 'reset' ? mode : 'login';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const lightColors = {
  bg: '#f5f5f1',
  card: '#ffffff',
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
  border: '#2c3a4d',
  primary: '#7ae4c5',
  primarySoft: '#103a31',
  softBg: '#1d2d3f',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16, minHeight: 40, justifyContent: 'center' },
  backText: { fontSize: 15, fontWeight: '700' },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 24 },
  brandMark: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  brandSymbol: { fontSize: 30, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  notice: { borderRadius: 12, padding: 12, marginBottom: 16 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  input: { minHeight: 52, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, marginBottom: 12, fontSize: 15 },
  helperText: { fontSize: 12, marginTop: -4, marginBottom: 10 },
  errorText: { color: '#b42318', fontSize: 13, lineHeight: 19, marginVertical: 8 },
  messageText: { fontSize: 13, lineHeight: 19, marginVertical: 8 },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  separatorLine: { flex: 1, height: 1 },
  separatorText: { fontSize: 11, fontWeight: '700' },
  googleButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 },
  googleMark: { color: '#4285F4', fontSize: 18, fontWeight: '900' },
  googleButtonText: { fontSize: 14, fontWeight: '700' },
  textButton: { alignSelf: 'center', padding: 12, marginTop: 6 },
  linkText: { fontSize: 14, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  switchText: { fontSize: 13 },
  namePrivacyNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});
