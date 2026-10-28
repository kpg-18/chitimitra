import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;

const pendingOAuthExchanges = new Map<string, Promise<Session>>();

export function exchangeOAuthCode(code: string): Promise<Session> {
  const existingExchange = pendingOAuthExchanges.get(code);
  if (existingExchange) return existingExchange;
  if (!supabase) return Promise.reject(new Error('Supabase authentication is not configured.'));

  const exchange = supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
    if (error) throw error;
    if (!data.session) throw new Error('Google sign-in did not return a valid session.');
    return data.session;
  });
  pendingOAuthExchanges.set(code, exchange);
  return exchange;
}
