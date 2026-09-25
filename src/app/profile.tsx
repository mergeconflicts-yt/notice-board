import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const signOut = useSession((s) => s.signOut);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const init = useSession((s) => s.init);
  const { boards } = useMyBoards();
  const [name, setName] = useState(user?.displayName ?? '');
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [account, setAccount] = useState<{ email: string | null; provider: string | null } | null>(
    null,
  );
  const isGuest = !user || user.isAnonymous;

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

  const saveName = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await setDisplayName(name.trim());
      setEditingName(false);
      useToast.getState().show('Name saved');
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmConflict = () => {
    Alert.alert(
      'That account already exists',
      'Sign in to it instead? Boards you made as a guest on this phone won’t come with you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/welcome') },
      ],
    );
  };

  const link = async (provider: 'apple' | 'google') => {
    try {
      await linkProvider(provider);
      await init();
      useToast.getState().show('Account saved');
    } catch (e) {
      if (e instanceof AuthCancelledError) return;
      if (isIdentityConflict(e)) {
        confirmConflict();
        return;
      }
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const signOutHere = async () => {
    try {
      await signOut();
      await init();
      router.replace('/');
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'Your posts stay on shared boards, shown as “Former member”. Boards where you are the only person are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await init();
              router.replace('/');
            } catch (e) {
              useToast.getState().show(friendlyMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
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

        {editingName ? (
          <View style={styles.nameRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.inkFaint}
              autoFocus
            />
            <Pressable onPress={saveName} disabled={busy || !name.trim()} style={styles.saveBtn}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        ) : null}

        {isGuest ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Save your account</Text>
            <Text style={styles.cardHint}>
              {boards.length > 0
                ? `Keep your ${boards.length} ${boards.length === 1 ? 'board' : 'boards'} if you change phones.`
                : 'Keep your boards if you change phones.'}
            </Text>
            {Platform.OS === 'ios' ? (
              <Pressable style={[styles.saveBtnRow, styles.darkRow]} onPress={() => void link('apple')}>
                <MaterialCommunityIcons name="apple" size={20} color={colors.white} />
                <Text style={styles.darkRowText}>Save with Apple</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.saveBtnRow} onPress={() => void link('google')}>
              <MaterialCommunityIcons name="google" size={20} color={colors.ink} />
              <Text style={styles.saveRowText}>Save with Google</Text>
            </Pressable>
            {savingEmail ? (
              <EmailCode
                mode="link"
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
                <MaterialCommunityIcons name="email-outline" size={20} color={colors.ink} />
                <Text style={styles.saveRowText}>Save with email</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable style={styles.darkRow} onPress={() => void signOutHere()}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.white} />
            <Text style={styles.darkRowText}>Sign out</Text>
          </Pressable>
        )}

        <Pressable style={styles.nameLink} onPress={() => setEditingName((v) => !v)}>
          <Text style={styles.nameLinkText}>Your name</Text>
        </Pressable>

        <Pressable style={styles.dangerRow} onPress={confirmDelete}>
          <Text style={styles.dangerText}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  identityText: { flex: 1 },
  name: { fontFamily: fonts.ui.bold, fontSize: 22, color: colors.ink },
  role: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  saveBtn: {
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.background },
  card: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: { fontFamily: fonts.ui.bold, fontSize: 18, color: colors.ink },
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginTop: 10,
  },
  saveRowText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 999,
    backgroundColor: colors.ink,
    marginTop: 22,
  },
  darkRowText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.white },
  nameLink: { marginTop: 24, paddingVertical: 10 },
  nameLinkText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  dangerRow: { marginTop: 6, paddingVertical: 12 },
  dangerText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.danger },
});
