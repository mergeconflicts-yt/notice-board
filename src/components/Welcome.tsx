import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
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

type ShowcasePost =
  | { kind: 'note'; color: keyof typeof noteColors; body: string; meta: string; rotate: string }
  | { kind: 'list'; color: keyof typeof noteColors; title: string; rows: { text: string; done: boolean }[]; meta: string; rotate: string }
  | { kind: 'date'; color: keyof typeof noteColors; title: string; time: string; place: string; dow: string; day: string; mon: string; meta: string; rotate: string }
  | { kind: 'photo'; color: keyof typeof noteColors; caption: string; meta: string; rotate: string };

// One bigger example per post type. The content inside each card is a
// realistic use for that type — quick message, shared shopping, upcoming
// plan, saved moment — so first-time users get the purpose at a glance.
const SHOWCASE: ShowcasePost[] = [
  {
    kind: 'note',
    color: 'butter',
    body: "Dinner's in the fridge — reheat 3 min! 🍲",
    meta: 'Mum · 2 h',
    rotate: '-2deg',
  },
  {
    kind: 'list',
    color: 'paper',
    title: 'Weekly shop',
    rows: [
      { text: 'Milk', done: true },
      { text: 'Bread', done: false },
      { text: 'Coffee', done: false },
      { text: 'Eggs', done: false },
    ],
    meta: 'Dad · 1 h',
    rotate: '1.5deg',
  },
  {
    kind: 'date',
    color: 'sky',
    title: 'Dentist',
    time: '10:30',
    place: 'Smile Clinic',
    dow: 'THU',
    day: '12',
    mon: 'MAR',
    meta: 'Mum · Yesterday',
    rotate: '-1.5deg',
  },
  {
    kind: 'photo',
    color: 'blush',
    caption: 'Beach day! 🏖️',
    meta: 'Sofia · 3 h',
    rotate: '2deg',
  },
];

const TYPE_BADGE: Record<ShowcasePost['kind'], string> = {
  note: 'NOTE',
  list: 'LIST',
  date: 'DATE',
  photo: 'PHOTO',
};

/** Demo beach shot for the welcome photo card (same photo as the website
 *  hero). Remote so no binary ships with the app; falls back to the icon
 *  placeholder when offline. */
const SHOWCASE_PHOTO_URL =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop';

/** Body of a showcase card: the same realistic per-type content. */
function ShowcaseBody({ post }: { post: ShowcasePost }) {
  const palette = noteColors[post.color];
  const [imgFailed, setImgFailed] = useState(false);
  if (post.kind === 'note') {
    return <Text style={[styles.cardNote, { color: palette.ink }]}>{post.body}</Text>;
  }
  if (post.kind === 'list') {
    return (
      <View>
        <Text style={[styles.cardListTitle, { color: palette.ink }]}>{post.title}</Text>
        {post.rows.map((row) => (
          <View key={row.text} style={styles.cardRow}>
            <View style={[styles.cardBox, row.done && styles.cardBoxDone]}>
              {row.done ? <Text style={styles.cardTick}>✓</Text> : null}
            </View>
            <Text
              style={[styles.cardRowText, { color: palette.ink }, row.done && styles.cardRowDone]}
            >
              {row.text}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  if (post.kind === 'date') {
    return (
      <View style={styles.cardTicket}>
        <View style={styles.cardCal}>
          <Text style={styles.cardDow}>{post.dow}</Text>
          <Text style={[styles.cardDay, { color: palette.ink }]}>{post.day}</Text>
          <Text style={[styles.cardMon, { color: palette.ink }]}>{post.mon}</Text>
        </View>
        <View style={styles.cardTicketMain}>
          <Text style={[styles.cardDateTitle, { color: palette.ink }]}>{post.title}</Text>
          <Text style={[styles.cardDateTime, { color: palette.ink }]}>{post.time}</Text>
          <Text style={[styles.cardPlace, { color: palette.ink }]}>{post.place}</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.cardPhoto}>
        {imgFailed ? (
          <MaterialCommunityIcons name="image-outline" size={26} color={palette.ink} />
        ) : (
          <Image
            source={{ uri: SHOWCASE_PHOTO_URL }}
            style={styles.cardPhotoImg}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
            accessibilityRole="image"
            accessibilityLabel={post.caption}
          />
        )}
      </View>
      <Text style={[styles.cardCaption, { color: palette.ink }]}>{post.caption}</Text>
    </View>
  );
}

const GUEST_WARNING =
  'Your fridges are tied to this phone. If you delete the app or lose the phone, they’re gone. You can save your account any time.';

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
              <Text style={styles.subtitle}>Join the fridge to see what’s on it.</Text>
            </>
          )}
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {SHOWCASE.map((post, i) => {
              const palette = noteColors[post.color];
              return (
                <View
                  key={post.kind}
                  style={[
                    styles.gridCard,
                    { backgroundColor: palette.bg, borderColor: palette.edge, transform: [{ rotate: post.rotate }] },
                  ]}
                >
                  <View
                    style={[styles.gridMagnet, { backgroundColor: fastenerColors.magnets[i % fastenerColors.magnets.length] }]}
                  />
                  <Text style={styles.cardBadge}>{TYPE_BADGE[post.kind]}</Text>
                  <ShowcaseBody post={post} />
                  <Text style={[styles.cardMeta, { color: palette.ink }]}>{post.meta}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.title}>Fridge Board</Text>
          <Text style={styles.subtitle}>
            {mode === 'resume'
              ? 'Welcome back — pick how you’d like to continue.'
              : 'One fridge for the people you live with.'}
          </Text>
        </>
      )}
    </>
  );

  const accountButtons = (
    <>
      {Platform.OS === 'ios' ? (
        <Pressable
          style={[styles.providerBtn, styles.leafBtn]}
          onPress={() => void runAuthed(() => continueWithProvider('apple'))}
          disabled={busy}
        >
          <MaterialCommunityIcons name="apple" size={20} color={colors.pine} />
          <Text style={styles.leafBtnText}>Continue with Apple</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.providerBtn, styles.leafBtn]}
        onPress={() => void runAuthed(() => continueWithProvider('google'))}
        disabled={busy}
      >
        <MaterialCommunityIcons name="google" size={20} color={colors.pine} />
        <Text style={styles.leafBtnText}>Continue with Google</Text>
      </Pressable>
      <Pressable
        style={[styles.providerBtn, styles.orangeBtn]}
        onPress={() => setStep('email')}
        disabled={busy}
      >
        <MaterialCommunityIcons name="email-outline" size={20} color={colors.white} />
        <Text style={styles.darkText}>Continue with email</Text>
      </Pressable>
    </>
  );

  const roundAccounts = (
    <View style={styles.roundRow}>
      {Platform.OS === 'ios' ? (
        <Pressable
          style={[styles.round, styles.leafBtn]}
          onPress={() => void runAuthed(() => continueWithProvider('apple'))}
          disabled={busy}
        >
          <MaterialCommunityIcons name="apple" size={22} color={colors.pine} />
        </Pressable>
      ) : null}
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
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.bodyScroll} bounces={false}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  scroll: { flex: 1 },
  bodyScroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 24, paddingBottom: 32 },
  spinner: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 16 },
  gridCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
    boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 10px 18px -8px rgba(20,30,25,0.45)',
  },
  gridMagnet: {
    position: 'absolute',
    top: -7,
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardBadge: {
    fontFamily: fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 6,
  },
  cardNote: { fontFamily: fonts.hand.semibold, fontSize: 20, lineHeight: 25 },
  cardListTitle: {
    fontFamily: fonts.hand.regular,
    fontSize: 21,
    lineHeight: 25,
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 },
  cardBox: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBoxDone: { backgroundColor: colors.ink },
  cardTick: { color: colors.paper, fontSize: 10, fontWeight: '800', marginTop: -1 },
  cardRowText: { fontFamily: fonts.hand.regular, fontSize: 17, lineHeight: 21 },
  cardRowDone: { textDecorationLine: 'line-through', opacity: 0.55 },
  cardTicket: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  cardCal: { alignItems: 'center', minWidth: 40 },
  cardDow: { fontFamily: fonts.ui.bold, fontSize: 10, letterSpacing: 0.5, color: colors.danger },
  cardDay: { fontFamily: fonts.hand.bold, fontSize: 28.5, lineHeight: 30 },
  cardMon: { fontFamily: fonts.ui.semibold, fontSize: 10, opacity: 0.7 },
  cardTicketMain: { flex: 1, minWidth: 0 },
  cardDateTitle: { fontFamily: fonts.hand.bold, fontSize: 21, lineHeight: 25 },
  cardDateTime: { fontFamily: fonts.hand.bold, fontSize: 17, lineHeight: 21, marginTop: 2 },
  cardPlace: { fontFamily: fonts.ui.semibold, fontSize: 12, marginTop: 4, opacity: 0.85 },
  cardPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardPhotoImg: { width: '100%', height: '100%' },
  cardCaption: { fontFamily: fonts.hand.semibold, fontSize: 18, lineHeight: 23, textAlign: 'center' },
  cardMeta: {
    marginTop: 8,
    fontFamily: fonts.ui.semibold,
    fontSize: 10,
    opacity: 0.65,
    textAlign: 'right',
  },
  title: { fontFamily: fonts.hand.bold, fontSize: 40, lineHeight: 42, color: colors.onPine },
  subtitle: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.onPineSoft, marginTop: 8 },
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
  orangeBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
  leafBtn: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  leafBtnText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.pine },
  providerText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  darkText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.white },
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
  backText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.onPine },
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
