import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, Animated, AccessibilityInfo, KeyboardAvoidingView } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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

/** Staggered pop-in for the showcase sticky, like a post pinning onto a board.
 *  Skipped when the OS asks for reduced motion. */
function AnimatedShowcaseCard({
  index,
  rotate,
  style,
  children,
}: {
  index: number;
  rotate: string;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    let alive = true;
    const run = (reduced: boolean) => {
      if (!alive) return;
      if (reduced) {
        pop.setValue(1);
        return;
      }
      Animated.spring(pop, {
        toValue: 1,
        delay: 150 + index * 130,
        useNativeDriver: true,
      }).start();
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(run)
      .catch(() => run(false));
    return () => {
      alive = false;
    };
  }, [index, pop]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: pop,
          transform: [
            { rotate },
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
            { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const GUEST_WARNING =
  'Your fridges are tied to this phone. If you delete the app or lose the phone, they’re gone. You can save your account any time.';

export function Welcome({ inviteToken }: Props) {
  const continueAsGuest = useSession((s) => s.continueAsGuest);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const continueWithProvider = useSession((s) => s.continueWithProvider);
  const sendEmailCode = useSession((s) => s.sendEmailCode);
  const verifyEmailCode = useSession((s) => s.verifyEmailCode);
  const beginNameCheck = useSession((s) => s.beginNameCheck);
  const [step, setStep] = useState<Step>('options');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestCap, setGuestCap] = useState<string | null>(null);
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

  // Guest entry: sign in anonymously, then claim the entered name so posts
  // are attributed. The create screen keeps a fallback name field in case
  // the rename fails (offline right after sign-up).
  const continueGuest = () =>
    runAuthed(async () => {
      await continueAsGuest(guestCap ?? undefined);
      const n = guestName.trim();
      if (n) await setDisplayName(n);
    });

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
              <Text style={styles.subtitle}>Join the fridge to see what’s on it.</Text>
            </>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.kicker}>Fridge Board</Text>
          <Text style={styles.hero}>A shared board for{'\n'}your people.</Text>
          <AnimatedShowcaseCard
            index={0}
            rotate="-2deg"
            style={[
              styles.showCard,
              { backgroundColor: noteColors.butter.bg, borderColor: noteColors.butter.edge },
            ]}
          >
            <View style={[styles.gridMagnet, { backgroundColor: fastenerColors.magnets[0] }]} />
            <Text style={[styles.cardNote, { color: noteColors.butter.ink }]}>
              Just the{'\n'}information.{'\n'}
              <Text style={styles.cardStrike}>All </Text>
              None of{'\n'}the noise.
            </Text>
            <Text style={[styles.cardMeta, { color: noteColors.butter.ink }]}>Fridge Board · now</Text>
          </AnimatedShowcaseCard>
        </>
      )}
    </>
  );

  const accountButtons = (
    <View style={styles.roundRow}>
      <Pressable
        style={[styles.round, styles.leafBtn]}
        onPress={() => void runAuthed(() => continueWithProvider('google'))}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <MaterialCommunityIcons name="google" size={22} color={colors.pine} />
      </Pressable>
      <Pressable
        style={[styles.round, styles.orangeBtn]}
        onPress={() => setStep('email')}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue with email"
      >
        <MaterialCommunityIcons name="email-outline" size={22} color={colors.white} />
      </Pressable>
    </View>
  );

  const roundAccounts = (
    <View style={styles.roundRow}>
      <Pressable
        style={[styles.round, styles.leafBtn]}
        onPress={() => void runAuthed(() => continueWithProvider('google'))}
        disabled={busy}
      >
        <MaterialCommunityIcons name="google" size={22} color={colors.pine} />
      </Pressable>
      <Pressable
        style={[styles.round, styles.orangeBtn]}
        onPress={() => setStep('email')}
        disabled={busy}
      >
        <MaterialCommunityIcons name="email-outline" size={22} color={colors.white} />
      </Pressable>
    </View>
  );

  // ---- Invite landing (panel 5) -------------------------------------------
  if (isInvite && step === 'options') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          {header}
          {/* Name is collected on the guest step (same as the non-invite
              path), so a cold-start invite never joins as "Someone". */}
          <Button
            label="Join as guest"
            variant="accent"
            onPress={() => setStep('guest')}
            disabled={busy}
            style={styles.joinBig}
          />
          <Text style={styles.or}>or join with an account</Text>
          {roundAccounts}
          <Text style={styles.helper}>You’ll see the fridge after you join.</Text>
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
    <SafeAreaView style={[styles.safe, (step === 'guest' || step === 'email') && styles.safeCream]}>
      <StatusBar style={step === 'guest' || step === 'email' ? 'dark' : 'light'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.bodyScroll}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
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
            <Text style={styles.guestTitle}>Who are you?</Text>
            <Text style={styles.guestSub}>What do people on the fridge call you?</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              testID="guest-name"
              placeholderTextColor={colors.onPineFaint}
              value={guestName}
              onChangeText={setGuestName}
              maxLength={40}
              autoFocus
            />
            <Text style={styles.warning}>{GUEST_WARNING}</Text>
            {turnstileSiteKey ? (
              <View style={styles.captcha}>
                <Turnstile
                  siteKey={turnstileSiteKey}
                  onToken={setGuestCap}
                  onError={() => setGuestCap(null)}
                />
              </View>
            ) : null}
            <Button
              label="Continue as guest"
              onPress={() => void continueGuest()}
              disabled={busy || !guestName.trim()}
              style={styles.primaryGap}
            />
            {error || joinError ? (
              <Text style={styles.error}>{error ?? joinError}</Text>
            ) : null}
            <Pressable onPress={() => setStep('options')} hitSlop={8} style={styles.backLink}>
              <Text style={styles.backText}>Go back</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'email' ? (
          <EmailCode
            mode="signup"
            tone="cream"
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
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  safeCream: { backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  scroll: { flex: 1 },
  bodyScroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 24, paddingBottom: 32 },
  spinner: { marginTop: 16 },
  kicker: {
    fontFamily: fonts.ui.bold,
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.brandYellow,
    marginTop: 8,
    marginBottom: 10,
  },
  hero: {
    fontFamily: fonts.hand.bold,
    fontSize: 48,
    lineHeight: 50,
    color: colors.onPine,
    marginBottom: 20,
  },
  showCard: {
    alignSelf: 'center',
    width: '84%',
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 18,
    minHeight: 300,
    justifyContent: 'center',
    boxShadow: '0 2px 2px rgba(0,0,0,0.14), 0 22px 34px -12px rgba(0,0,0,0.55)',
  },
  gridMagnet: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  cardNote: { fontFamily: fonts.hand.semibold, fontSize: 40, lineHeight: 47 },
  cardStrike: { textDecorationLine: 'line-through', color: colors.accentDeep },
  cardMeta: {
    marginTop: 6,
    fontFamily: fonts.ui.semibold,
    fontSize: 10,
    opacity: 0.65,
    textAlign: 'right',
  },
  title: { fontFamily: fonts.hand.bold, fontSize: 40, lineHeight: 42, color: colors.onPine },
  subtitle: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.onPineSoft, marginTop: 8 },
  guestTitle: { fontFamily: fonts.hand.bold, fontSize: 40, lineHeight: 42, color: colors.pine },
  guestSub: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  nameInput: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 16,
  },
  warning: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 12,
  },
  orangeBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
  leafBtn: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  guestLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 6 },
  guestLinkText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.onPine,
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
  inviteBy: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.onPineSoft },
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
  roundRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 30 },
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
    color: colors.onPineSoft,
    textAlign: 'center',
    marginTop: 20,
  },
  helper: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.onPineFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  after: { marginTop: 12 },
});
