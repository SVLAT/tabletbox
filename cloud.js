import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const ready = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const client = ready ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const cloud = {
  ready,
  async session() { return client ? (await client.auth.getSession()).data.session : null; },
  async signIn(email) {
    if (!client) throw new Error('Supabase ещё не подключён');
    return client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  },
  async pull() {
    const session = await this.session(); if (!session) return null;
    const { data, error } = await client.from('app_state').select('data').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error; return data?.data || null;
  },
  async push(data) {
    const session = await this.session(); if (!session) return;
    const { error } = await client.from('app_state').upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
};
