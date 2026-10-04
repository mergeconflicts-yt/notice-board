import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { MemberDot } from '../components/MemberDot';
import { EmailCode } from '../components/EmailCode';
import { useSession } from '../store/session';
import { useToast } from '../store/toast';
import { useMyBoards } from '../hooks/useBoards';
import {
  AuthCancelledError,
  confirmEmailChange,
  friendlyMessage,
  isIdentityConflict,
  linkProvider,
  myAccount,
  requestEmailChange,
} from '../lib/api';
import {
  assertOAuthProviderAvailable,
  isOAuthProviderAvailable,
  OAuthProviderId,
  ProviderUnavailableError,
} from '../lib/authProviders';
import { INVITE_BASE_URL } from '../lib/inviteLinks';

/** Open a legal page on the website (Privacy / Terms / Contact). */
async function openLegal(page: 'privacy.html' | 'terms.html' | 'contact.html'): Promise<void> {
  const base = INVITE_BASE_URL.replace(/\/$/, '');
  if (!base) return;
  try {
    await Linking.openURL(`${base}/${page}`);
  } catch {
    // No browser available — nothing to report.
  }
}

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const init = useSession((s) => s.init);
  const { boards } = useMyBoards();
  const [savingEmail, setSavingEmail] = useState(false);
  // Sign-out / delete-account is slow (server cleanup + fresh guest init):
  // show progress on the row and ignore repeat taps while one is running.
  // The ref is the real guard (alert closures go stale); the state drives UI.
  const [leaving, setLeaving] = useState<null | 'signout' | 'delete'>(null);
  const leavingRef = useRef(false);
  const [account, setAccount] = useState<{ email: string | null; provider: string | null } | null>(
    null,
  );
  const isGuest = !user || user.isAnonymous;
  // Google is hidden on iOS until Apple login is configured and review-safe.
  const googleAvailable = isOAuthProviderAvailable('google', Platform.OS);

  useEffect(() => {
    // Guests have no account row to show; nothing to fetch. (The saved account
    // isn't rendered while guest, so no clear is needed here either.)
    if (isGuest) return;
    let alive = true;
    void myAccount().then((a) => {
      if (alive) setAccount(a);
    });
    return () => {
      alive = false;
    };
  }, [isGuest, user?.id]);

  const confirmConflict = () => {
    Alert.alert(
      'That account already exists',
      'Sign in to it instead? Fridges you made as a guest on this phone won’t come with you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/welcome') },
      ],
    );
  };

  const link = async (provider: OAuthProviderId) => {
    try {
      assertOAuthProviderAvailable(provider, Platform.OS);
      await linkProvider(provider);
      await init();
      useToast.getState().show('Account saved');
    } catch (e) {
      if (e instanceof AuthCancelledError) return;
      if (e instanceof ProviderUnavailableError) {
        useToast.getState().show(e.message);
        return;
      }
      if (isIdentityConflict(e)) {
        confirmConflict();
        return;
      }
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const signOutHere = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving('signout');
    try {
      await signOut();
      await init();
      router.replace('/');
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    } finally {
      leavingRef.current = false;
      setLeaving(null);
    }
  };

  const confirmSignOut = () => {
    if (leaving) return;
    // A guest identity is deleted on sign-out (there is no sign-in to come
    // back to); a saved account just ends the session.
    Alert.alert(
      'Sign out?',
      isGuest
        ? 'Signing out deletes this guest account and removes you from every fridge you’re on. This can’t be undone. Save your account first to keep them.'
        : 'You’ll be signed out. Sign back in to get your fridges again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOutHere(),
        },
      ],
    );
  };

  const confirmDelete = () => {
    if (leaving) return;
    Alert.alert(
      'Delete your account?',
      'Your posts stay on shared fridges, shown as “Former member”. Fridges where you are the only person are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            if (leavingRef.current) return;
            leavingRef.current = true;
            setLeaving('delete');
            try {
              await deleteAccount();
              await init();
              router.replace('/');
            } catch (e) {
              useToast.getState().show(friendlyMessage(e));
            } finally {
              leavingRef.current = false;
              setLeaving(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScreenHeader title="You" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
          <MemberDot seed={user?.id ?? 'me'} name={user?.displayName ?? 'Someone'} size={56} />
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.displayName ?? 'Someone'}
            </Text>
            <Text style={styles.role}>
              {isGuest ? 'Guest on this phone' : account?.email ?? 'Signed in'}
            </Text>
          </View>
        </View>

        {isGuest ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Save your account</Text>
            <Text style={styles.cardHint}>
              {boards.length > 0
                ? `Keep your ${boards.length} ${boards.length === 1 ? 'fridge' : 'fridges'} if you change phones.`
                : 'Keep your fridges if you change phones.'}
            </Text>
            {googleAvailable ? (
              <Pressable style={styles.saveBtnRow} onPress={() => void link('google')}>
                <MaterialCommunityIcons name="google" size={20} color={colors.pine} />
                <Text style={styles.saveRowText}>Save with Google</Text>
              </Pressable>
            ) : null}
            {savingEmail ? (
              <EmailCode
                mode="link"
                tone="cream"
                onSend={(address) => requestEmailChange(address)}
                onVerify={(address, code) => confirmEmailChange(address, code)}
                onDone={() => {
                  setSavingEmail(false);
                  useToast.getState().show('Account saved');
                }}
                onConflict={confirmConflict}
                onBack={() => setSavingEmail(false)}
              />
            ) : (
              <Pressable style={styles.saveBtnRow} onPress={() => setSavingEmail(true)}>
                <MaterialCommunityIcons name="email-outline" size={20} color={colors.pine} />
                <Text style={styles.saveRowText}>Save with email</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <Pressable
          style={[styles.signOutRow, leaving !== null && styles.rowBusy]}
          onPress={confirmSignOut}
          disabled={leaving !== null}
          accessibilityRole="button"
          accessibilityLabel={leaving === 'signout' ? 'Signing out' : 'Sign out'}
        >
          {leaving === 'signout' ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <MaterialCommunityIcons name="logout" size={20} color={colors.ink} />
          )}
          <Text style={styles.signOutText}>{leaving === 'signout' ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>

        <Pressable
          style={[styles.dangerRow, leaving !== null && styles.rowBusy]}
          onPress={confirmDelete}
          disabled={leaving !== null}
          accessibilityRole="button"
          accessibilityLabel={leaving === 'delete' ? 'Deleting account' : 'Delete account'}
        >
          {leaving === 'delete' ? (
            <View style={styles.dangerBusy}>
              <ActivityIndicator size="small" color={colors.danger} />
              <Text style={styles.dangerText}>Deleting account…</Text>
            </View>
          ) : (
            <Text style={styles.dangerText}>Delete account</Text>
          )}
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => void openLegal('privacy.html')}>
            <Text style={styles.legalText}>Privacy</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => void openLegal('terms.html')}>
            <Text style={styles.legalText}>Terms</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => void openLegal('contact.html')}>
            <Text style={styles.legalText}>Contact</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  identityText: { flex: 1 },
  name: { fontFamily: fonts.ui.bold, fontSize: 22, color: colors.pine },
  role: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  card: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
  },
  cardTitle: { fontFamily: fonts.ui.bold, fontSize: 18, color: colors.pine },
  cardHint: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 4,
    marginBottom: 14,
  },
  saveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.leaf,
    marginTop: 10,
  },
  saveRowText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.pine },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  signOutText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  dangerRow: { marginTop: 6, paddingVertical: 12 },
  dangerText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.danger },
  dangerBusy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBusy: { opacity: 0.6 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 28,
    paddingBottom: 8,
  },
  legalText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.inkSoft },
  legalDot: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkFaint },
});
