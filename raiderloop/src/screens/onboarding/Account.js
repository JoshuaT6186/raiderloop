import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Button, Field, Card, Divider } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { emailSignUp, emailSignIn, guestSignIn, appleSignIn, resetPassword, getMyProfile } from '../../lib/firebase';
import { DEFAULT_AVATAR } from '../../ui/avatarParts';
import { AppleAuth, Crypto } from '../../lib/native';

const friendly = (e) => {
  const c = e?.code || '';
  if (c.includes('email-already-in-use')) return 'That email already has an account. Switch to "Sign in".';
  if (c.includes('invalid-email')) return "That email doesn't look right.";
  if (c.includes('weak-password')) return 'Use at least 6 characters for your password.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return "Email or password didn't match.";
  if (c.includes('network')) return "Can't reach the server. Check your connection.";
  if (c.includes('canceled') || c.includes('ERR_REQUEST_CANCELED')) return null;
  return e?.message || 'Something went wrong.';
};

export default function Account() {
  const { t } = useTheme();
  const { set, userName } = useApp();
  const [mode, setMode] = useState('create'); // create | signin
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const next = (patch = {}) => set({ ...patch, onboardStep: 'school' });

  /* Someone who already finished setup (new phone, or signed out and back
     in) doesn't redo it. An account only has a saved profile once setup
     was completed, so that's the signal. Their name, avatar and school
     come back from the server; only the permissions screen is left. */
  const continueAs = async (user, fallback = {}) => {
    const prof = user && !user.isAnonymous ? await getMyProfile(user.uid) : null;
    if (prof && prof.name && prof.avatar) {
      set({
        userName: prof.name, avatar: { ...DEFAULT_AVATAR, ...prof.avatar }, schoolId: prof.schoolId || 'ttu',
        onboardStep: 'welcomeback',
      });
    } else next(fallback);
  };

  const submit = async () => {
    setError(null); setInfo(null); setBusy('email');
    try {
      if (mode === 'create') {
        if (!name.trim()) { setError('Add your first name so friends know it\'s you.'); setBusy(null); return; }
        await emailSignUp(email.trim(), password, name.trim());
        next({ userName: name.trim() });
      } else {
        const u = await emailSignIn(email.trim(), password);
        await continueAs(u, u.displayName ? { userName: u.displayName } : {});
      }
    } catch (e) { setError(friendly(e)); }
    setBusy(null);
  };

  const apple = async () => {
    setError(null); setBusy('apple');
    try {
      const res = await appleSignIn(AppleAuth, Crypto);
      await continueAs(res.user || res, res.name ? { userName: res.name } : {});
    } catch (e) { const m = friendly(e); if (m) setError(m); }
    setBusy(null);
  };

  const guest = async () => {
    setBusy('guest');
    try { await guestSignIn(); } catch (e) { /* offline is fine, local features still work */ }
    next();
    setBusy(null);
  };

  return (
    <Shell step="account" onBack={() => set({ onboardStep: 'welcome' })}
      footer={<T kind="small" style={{ textAlign: 'center', fontSize: 12 }}>Flyer never asks for your university password.</T>}>
      <Heading eyebrow="step one" title={mode === 'create' ? 'Make your account' : 'Welcome back'}
        sub="An account lets friends find you and keeps your stuff if you switch phones." />

      {AppleAuth ? (
        <>
          <Button title="Continue with Apple" icon="lock" kind="ghost" loading={busy === 'apple'} onPress={apple} />
          <Divider />
        </>
      ) : null}

      {mode === 'create' ? <Field label="First name" placeholder="Joshua" value={name} onChangeText={setName} autoCapitalize="words" textContentType="givenName" /> : null}
      <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" placeholder="6+ characters" value={password} onChangeText={setPassword} secureTextEntry textContentType={mode === 'create' ? 'newPassword' : 'password'} />
      {error ? <T kind="small" color={t.redPen} style={{ marginBottom: 10 }}>{error}</T> : null}
      {info ? <T kind="small" color={t.ok} style={{ marginBottom: 10 }}>{info}</T> : null}
      <Button title={mode === 'create' ? 'Create account' : 'Sign in'} icon="plane" loading={busy === 'email'} disabled={!email || password.length < 6} onPress={submit} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
        <Pressable onPress={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(null); }} hitSlop={8}>
          <T kind="hand" color={t.accent}>{mode === 'create' ? 'I have an account' : 'Make a new account'}</T>
        </Pressable>
        {mode === 'signin' ? (
          <Pressable hitSlop={8} onPress={async () => {
            if (!email) { setError('Type your email first, then tap this again.'); return; }
            try { await resetPassword(email.trim()); setInfo('Reset link sent. Check your inbox.'); } catch (e) { setError(friendly(e)); }
          }}>
            <T kind="hand" color={t.pencil}>forgot password?</T>
          </Pressable>
        ) : null}
      </View>

      <Card style={{ marginTop: 26 }}>
        <Pressable onPress={guest} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button">
          <Icon name="ghost" color={t.inkSoft} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <T kind="bold">Look around first</T>
            <T kind="small">Everything works except friends. You can make an account later and keep your setup.</T>
          </View>
          {busy === 'guest' ? null : <Icon name="chevronRight" color={t.faint} />}
        </Pressable>
      </Card>
    </Shell>
  );
}
