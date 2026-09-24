import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../theme';
import { Button } from '../../components/Button';
import { IdentitySheet } from '../../components/IdentitySheet';
import { Turnstile } from '../../components/Turnstile';
import { turnstileSiteKey } from '../../lib/supabase';
import { acceptInvite, friendlyMessage, previewInvite } from '../../lib/api';
import { useSession } from '../../store/session';
import { InvitePreview } from '../../types';

/**
 * Universal-link target: /j/<token>. Previews the board (no content), then
 * joins on tap. The short-code path lives in join.tsx and uses the same APIs.
 */
export default function JoinByLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const sessionError = useSession((s) => s.error);
  const init = useSession((s) => s.init);
  const signOut = useSession((s) => s.signOut);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // A brand-new anonymous user is "Someone"; ask for a real name before joining.
  const needsName = !!user && user.displayName === 'Someone';

  const handleName = async (name: string) => {
    setSavingName(true);
    setNameError(null);
    try {
      await setDisplayName(name);
    } catch (e) {
      setNameError(friendlyMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => {
    if (status !== 'ready' || !token) return;
    let alive = true;
    void (async () => {
      try {
        const info = await previewInvite(token);
        if (!alive) return;
        if (!info) setError('This invite isn’t working. Ask for a fresh link.');
        else setPreview(info);
      } catch (e) {
        if (alive) setError(friendlyMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, status]);

  const join = async () => {
    if (!token || joining) return;
    setJoining(true);
    setError(null);
    try {
      const boardId = await acceptInvite(token, user?.displayName ?? null);
      if (!boardId) {
        setError('This invite isn’t working. Ask for a fresh link.');
        setJoining(false);
        return;
      }
      router.replace(`/board/${boardId}`);
    } catch (e) {
      setError(friendlyMessage(e));
      setJoining(false);
    }
  };

  // A link opened on first launch must still get through session setup —
  // otherwise the invite spins forever.
  if (status === 'needsCaptcha' && turnstileSiteKey) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.title}>One quick check</Text>
        <Text style={styles.sub}>Confirm you’re human to join.</Text>
        <Turnstile
          siteKey={turnstileSiteKey}
          onToken={(t) => void init(t)}
          onError={() => void init()}
        />
      </SafeAreaView>
    );
  }

  if (status === 'offline') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.title}>Can’t reach the board</Text>
        <Text style={styles.sub}>{sessionError ?? 'Check your connection and try again.'}</Text>
        <Button label="Retry" onPress={() => void init()} style={styles.join} />
        <Button
          label="Sign out"
          variant="soft"
          onPress={() => void signOut().then(() => init())}
          style={styles.join}
        />
      </SafeAreaView>
    );
  }

  if (status === 'loading' || (!preview && !error)) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {preview ? (
          <>
            <Text style={styles.kicker}>{preview.invitedBy ? `${preview.invitedBy} invited you` : 'You’re invited'}</Text>
            <Text style={styles.title}>{preview.boardName}</Text>
            <Text style={styles.sub}>
              {preview.memberCount} {preview.memberCount === 1 ? 'person' : 'people'}
              {preview.memberFirstNames.length > 0
                ? ` · ${preview.memberFirstNames.slice(0, 3).join(', ')}`
                : ''}
            </Text>
            <Button
              label={joining ? 'Joining…' : 'Join board'}
              onPress={join}
              disabled={joining || needsName}
              style={styles.join}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Invite not found</Text>
            <Text style={styles.sub}>{error}</Text>
            <Button label="Go home" variant="soft" onPress={() => router.replace('/')} style={styles.join} />
          </>
        )}
      </View>

      <IdentitySheet
        visible={!!preview && needsName}
        onDone={handleName}
        submitting={savingName}
        error={nameError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  kicker: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentDeep,
    marginBottom: 10,
  },
  title: { fontFamily: fonts.hand.bold, fontSize: 40, color: colors.ink },
  sub: { fontFamily: fonts.ui.regular, fontSize: 16, color: colors.inkSoft, marginTop: 8 },
  join: { marginTop: 28 },
});
