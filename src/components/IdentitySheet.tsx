import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { AVATAR_EMOJIS } from '../utils/note';

type Props = {
  visible: boolean;
  onDone: (name: string, avatar: string) => void;
  submitting?: boolean;
  error?: string | null;
};

export function IdentitySheet({ visible, onDone, submitting = false, error = null }: Props) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_EMOJIS[0]);
  const [wasOpen, setWasOpen] = useState(false);

  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) setName('');
  }

  const canSubmit = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.scrim} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.subtitle}>Your notes will show this name on the board.</Text>

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.inkFaint}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.pickLabel}>Pick a little face</Text>
          <View style={styles.emojiGrid}>
            {AVATAR_EMOJIS.slice(0, 12).map((e) => (
              <Pressable
                key={e}
                onPress={() => setAvatar(e)}
                style={[styles.emoji, e === avatar && styles.emojiActive]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={submitting ? 'Joining…' : "Let's go"}
            onPress={() => onDone(name.trim(), avatar)}
            disabled={!canSubmit || submitting}
            style={styles.done}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(62,54,46,0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.hand.bold,
    fontSize: 30,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    height: 54,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  pickLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: 12,
    color: colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiActive: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: '#FFF7EC',
  },
  emojiText: { fontSize: 22 },
  error: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.danger,
    marginBottom: 10,
  },
  done: { marginTop: 4 },
});
