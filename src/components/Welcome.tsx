import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, noteColors, fastenerColors } from '../theme';
import { Button } from './Button';
import { Turnstile } from './Turnstile';
import { EmailCode } from './EmailCode';
import { turnstileSiteKey } from '../lib/supabase';
import {
  acceptInvite,
  AuthCancelledError,
  friendlyMessage,
  previewInviteToken,
} from '../lib/api';
import type { InvitePreview } from '../types';
import { useSession } from '../store/session';

type Props = {
  /** Fresh install (no identity) vs returning to a lost one. */
  mode: 'fresh' | 'resume';
  /** Deep-link invite token: preview first, then join. */
  inviteToken?: string | null;
};

type Step = 'options' | 'guest' | 'email';

const DECOS: { text: string; color: keyof typeof noteColors; top: number; left: number; rotate: string; w: number }[] = [
  { text: 'Buy milk', color: 'butter', top: 14, left: 6, rotate: '-5deg', w: 96 },
  { text: 'Dentist\nSat 10:30', color: 'sky', top: 0, left: 112, rotate: '3deg', w: 118 },
  { text: 'Grandma visits\nSat', color: 'blush', top: 104, left: 54, rotate: '-2deg', w: 132 },
];

const GUEST_WARNING =
  'Your boards are tied to this phone. If you delete the app or lose the phone, they’re gone. You can save your account any time.';

export function Welcome({ mode, inviteToken }: Props) {
  const continueAsGuest = useSession((s) => s.continueAsGuest);
  const continueWithProvider = useSession((s) => s.continueWithProvider);
  const sendEmailCode = useSession((s) => s.sendEmailCode);
  const verifyEmailCode = useSession((s) => s.verifyEmailCode);
  const beginNameCheck = useSession((s) => s.beginNameCheck);
  const [step, setStep] = useState<Step>('options');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [inviteCap, setInviteCap] = useState<string | null>(null);
  const isInvite = Boolean(inviteToken);

  // Token preview is public (token-only), so the invite screen can name the
  // board before any session exists.
  useEffect(() => {
    if (!inviteToken) return;
    let alive = true;
    void previewInviteToken(inviteToken)
      .then((info) => {
        if (alive) setPreview(info);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [inviteToken]);

  /** After any successful auth, join the linked board if this came from an
   *  invite. (The one-time name step is owned by the gate's `name` status.) */
  const afterAuth = async () => {
    await finish();
  };

  const finish = async () => {
    if (!inviteToken) return;
    setBusy(true);
    setJoinError(null);
    try {
      const boardId = await acceptInvite(inviteToken);
      if (!boardId) {
        setJoinError('That invite isn’t working. Ask for a fresh link.');
        return;
      }
      router.replace(`/board/${boardId}`);
    } catch (e) {
      setJoinError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runAuthed = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await afterAuth();
    } catch (e) {
      if (!(e instanceof AuthCancelledError)) setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <>
      {isInvite ? (
        <View style={styles.inviteHead}>
          {preview ? (
            <>
              <View style={styles.inviteByRow}>
                <View style={[styles.inviteDot, { backgroundColor: fastenerColors.magnets[0] }]} />
                <Text style={styles.inviteBy}>
                  {preview.invitedBy ? `${preview.invitedBy} invited you to` : 'You’re invited to'}
                </Text>
              </View>
              <View style={[styles.paper, { backgroundColor: noteColors.butter.bg }]}>
                <View style={[styles.magnet, { backgroundColor: fastenerColors.magnets[0] }]} />
                <Text style={styles.paperTitle}>{preview.boardName}</Text>
                <Text style={styles.paperSub}>
                  {preview.memberCount} {preview.memberCount === 1 ? 'person' : 'people'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>You’re invited</Text>
              <Text style={styles.subtitle}>Join the board to see what’s on it.</Text>
            </>
          )}
        </View>
      ) : (
        <>
          <View style={styles.decor}>
            {DECOS.map((d, i) => (
              <View
                key={d.text}
                style={[
                  styles.deco,
                  {
                    backgroundColor: noteColors[d.color].bg,
                    top: d.top,
                    left: d.left,
                    width: d.w,
                    transform: [{ rotate: d.rotate }],
                  },
                ]}
              >
                <View
                  style={[styles.decoMagnet, { backgroundColor: fastenerColors.magnets[i % fastenerColors.magnets.length] }]}
                />
                <Text style={[styles.decoText, { color: noteColors[d.color].ink }]}>{d.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.title}>Notice board</Text>
          <Text style={styles.subtitle}>
            {mode === 'resume'
              ? 'Welcome back — pick how you’d like to continue.'
              : 'One board for the people you live with.'}
          </Text>
        </>
      )}
    </>
  );

  const accountButtons = (
    <>
      {Platform.OS === 'ios' ? (
        <Pressable
          style={[styles.providerBtn, styles.darkBtn]}
          onPress={() => void runAuthed(() => continueWithProvider('apple'))}
          disabled={busy}
        >
          <MaterialCommunityIcons name="apple" size={20} color={colors.white} />
          <Text style={styles.darkText}>Continue with Apple</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.providerBtn}
        onPress={() => void runAuthed(() => continueWithProvider('google'))}
        disabled={busy}
      >
        <MaterialCommunityIcons name="google" size={20} color={colors.ink} />
        <Text style={styles.providerText}>Continue with Google</Text>
      </Pressable>
      <Pressable style={styles.providerBtn} onPress={() => setStep('email')} disabled={busy}>
        <MaterialCommunityIcons name="email-outline" size={20} color={colors.ink} />
        <Text style={styles.providerText}>Continue with email</Text>
      </Pressable>
    </>
  );

  const roundAccounts = (
    <View style={styles.roundRow}>
      {Platform.OS === 'ios' ? (
        <Pressable
          style={[styles.round, styles.darkBtn]}
          onPress={() => void runAuthed(() => continueWithProvider('apple'))}
          disabled={busy}
        >
          <MaterialCommunityIcons name="apple" size={22} color={colors.white} />
        </Pressable>
      ) : null}
      <Pressable
        style={styles.round}
        onPress={() => void runAuthed(() => continueWithProvider('google'))}
        disabled={busy}
      >
        <MaterialCommunityIcons name="google" size={22} color={colors.ink} />
      </Pressable>
      <Pressable style={styles.round} onPress={() => setStep('email')} disabled={busy}>
        <MaterialCommunityIcons name="email-outline" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );

  // ---- Invite landing (panel 5) -------------------------------------------
  if (isInvite && step === 'options') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          {header}
          <Button
            label="Join as guest"
            variant="accent"
            onPress={() => {
              if (turnstileSiteKey && !inviteCap) {
                setError('Complete the human check first.');
                return;
              }
              void runAuthed(() => continueAsGuest(inviteCap ?? undefined));
            }}
            disabled={busy}
            style={styles.joinBig}
          />
          {turnstileSiteKey ? (
            <View style={styles.captcha}>
              <Turnstile
                siteKey={turnstileSiteKey}
                onToken={setInviteCap}
                onError={() => setInviteCap(null)}
              />
            </View>
          ) : null}
          <Text style={styles.or}>or join with an account</Text>
          {roundAccounts}
          <Text style={styles.helper}>You’ll see the board after you join.</Text>
          {busy ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {joinError ? (
            <>
              <Text style={styles.error}>{joinError}</Text>
              <Button label="Continue" onPress={() => router.replace('/')} style={styles.after} />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {step === 'options' ? (
          <>
            {header}
            {accountButtons}
            <Pressable onPress={() => setStep('guest')} hitSlop={8} style={styles.guestLink}>
              <Text style={styles.guestLinkText}>Use as guest</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'guest' ? (
          <>
            <Text style={styles.title}>Use as guest?</Text>
            <Text style={styles.subtitle}>{GUEST_WARNING}</Text>
            {turnstileSiteKey ? (
              <View style={styles.captcha}>
                <Turnstile
                  siteKey={turnstileSiteKey}
                  onToken={(t) => void runAuthed(() => continueAsGuest(t))}
                  onError={() => setError('Couldn’t load the check. Try again.')}
                />
              </View>
            ) : null}
            <Button
              label="Continue as guest"
              variant="accent"
              onPress={() => void runAuthed(() => continueAsGuest())}
              disabled={busy}
              style={styles.primaryGap}
            />
            <Pressable onPress={() => setStep('options')} hitSlop={8} style={styles.backLink}>
              <Text style={styles.backText}>Go back</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'email' ? (
          <EmailCode
            mode="signup"
            onSend={(email, token) => sendEmailCode(email, token)}
            onVerify={async (email, code) => {
              // Arm the one-time name step before the session lands; the gate
              // then shows it (or goes straight to ready for a returning user).
              beginNameCheck();
              await verifyEmailCode(email, code);
            }}
            // The auth listener owns navigation: it lands on `name` or `ready`.
            onDone={() => {}}
            onBack={() => setStep('options')}
          />
        ) : null}

        {busy && step !== 'email' ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : null}
        {error && step === 'options' ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  spinner: { marginTop: 16 },
  decor: { height: 200, marginBottom: 8 },
  deco: {
    position: 'absolute',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 8px 14px -8px rgba(20,30,25,0.4)',
  },
  decoMagnet: {
    position: 'absolute',
    top: -7,
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  decoText: { fontFamily: fonts.hand.semibold, fontSize: 17, lineHeight: 21 },
  title: { fontFamily: fonts.hand.bold, fontSize: 40, lineHeight: 42, color: colors.ink },
  subtitle: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  providerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  darkBtn: { backgroundColor: colors.ink, borderColor: colors.ink },
  providerText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  darkText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.white },
  guestLink: { alignSelf: 'center', marginTop: 20 },
  guestLinkText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  captcha: { marginTop: 18, alignItems: 'center' },
  primaryGap: { marginTop: 20 },
  backLink: { alignSelf: 'center', marginTop: 16 },
  backText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
  // Invite
  inviteHead: { marginBottom: 28 },
  inviteByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  inviteDot: { width: 22, height: 22, borderRadius: 11 },
  inviteBy: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft },
  paper: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 26, alignSelf: 'flex-start' },
  magnet: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  paperTitle: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  paperSub: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  joinBig: { marginTop: 4 },
  roundRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 14 },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  or: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 20,
  },
  helper: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  after: { marginTop: 12 },
});
