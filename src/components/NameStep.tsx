import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { IdentitySheet } from './IdentitySheet';
import { friendlyMessage } from '../lib/api';
import { useSession } from '../store/session';

/** One-time "what's your name?" after an email sign-up (no provider name). */
export function NameStep() {
  const completeName = useSession((s) => s.completeName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      await completeName(name);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fill}>
      <IdentitySheet visible submitting={busy} error={error} onDone={(n) => void done(n)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 100,
    elevation: 100,
  },
});
