import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { useSession } from '../store/session';
import { useToast } from '../store/toast';
import { deleteAccount, friendlyMessage, linkEmail, linkProvider } from '../lib/api';

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await setDisplayName(name.trim());
      useToast.getState().show('Name saved');
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const link = async (provider: 'apple' | 'google') => {
    try {
      await linkProvider(provider);
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const addEmail = async () => {
    if (!email.trim()) return;
    try {
      await linkEmail(email.trim());
      useToast.getState().show('Check your email to confirm');
      setEmail('');
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
              // deleteAccount signs out; start a fresh anonymous session so
              // the app isn't left as the deleted user.
              await useSession.getState().init();
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
        <View style={styles.card}>
          <Avatar name={user?.displayName ?? 'Someone'} size={56} />
          <Text style={styles.name}>{user?.displayName ?? 'Someone'}</Text>
        </View>

        <Text style={styles.sectionLabel}>Your name</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.inkFaint}
          />
          <Pressable onPress={saveName} disabled={busy || !name.trim()} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Save your account</Text>
        <Text style={styles.hint}>
          Add a sign-in so you keep your boards if you change phones.
        </Text>
        {Platform.OS === 'ios' ? (
          <Pressable style={styles.linkBtn} onPress={() => link('apple')}>
            <MaterialCommunityIcons name="apple" size={20} color={colors.ink} />
            <Text style={styles.linkText}>Continue with Apple</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.linkBtn} onPress={() => link('google')}>
          <MaterialCommunityIcons name="google" size={20} color={colors.ink} />
          <Text style={styles.linkText}>Continue with Google</Text>
        </Pressable>
        <View style={styles.emailRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable onPress={addEmail} disabled={!email.trim()} style={styles.saveBtn}>
            <Text style={styles.saveText}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.finePrint}>
          Your boards stay on the same account — nothing moves.
        </Text>

        <Text style={styles.sectionLabel}>Danger zone</Text>
        <Pressable style={styles.dangerRow} onPress={confirmDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} />
          <Text style={styles.dangerText}>Delete my account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  card: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  name: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  sectionLabel: { fontFamily: fonts.ui.regular, fontSize: 17, color: colors.ink, marginTop: 22, marginBottom: 10, paddingLeft: 4 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emailRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },
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
  saveBtn: { paddingHorizontal: 20, height: 52, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.background },
  hint: { fontFamily: fonts.ui.regular, fontSize: 13, color: colors.inkSoft, paddingLeft: 4, marginBottom: 10 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  linkText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.ink },
  finePrint: { fontFamily: fonts.ui.regular, fontSize: 12, color: colors.inkFaint, paddingLeft: 4, marginTop: 6 },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  dangerText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.danger },
});
