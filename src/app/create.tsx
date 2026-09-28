import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { offeredBoardColors, boardColors, colors, doorInk, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { FridgeDoor } from '../components/FridgeDoor';
import { NotePaper } from '../components/NotePaper';
import { createBoard, friendlyMessage } from '../lib/api';
import { BoardColor, ItemWithAuthor, ListEntry } from '../types';

// Sample posts for the live fridge preview: a note and a list, like the
// website hero. Static (no ticking, no dragging) — just what the door
// will look like in the picked colour.
const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const PREVIEW_AUTHOR = {
  id: 'preview',
  displayName: 'Mum',
  avatarPath: null,
  createdAt: hoursAgoIso(3),
};

const PREVIEW_NOTE: ItemWithAuthor = {
  id: 'preview-note',
  boardId: 'preview',
  type: 'note',
  color: 'butter',
  body: 'Wi-Fi: HomeNet\nsunflower22',
  title: null,
  eventAt: null,
  place: null,
  photoPath: null,
  layout: null,
  pinned: false,
  keepUntil: null,
  doneAt: null,
  doneBy: null,
  createdBy: 'preview',
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  version: 1,
  createdAt: hoursAgoIso(2),
  updatedAt: hoursAgoIso(2),
  author: PREVIEW_AUTHOR,
};

const PREVIEW_LIST: ItemWithAuthor = {
  id: 'preview-list',
  boardId: 'preview',
  type: 'list',
  color: 'paper',
  body: null,
  title: 'Groceries',
  eventAt: null,
  place: null,
  photoPath: null,
  layout: null,
  pinned: false,
  keepUntil: null,
  doneAt: null,
  doneBy: null,
  createdBy: 'preview',
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  version: 1,
  createdAt: hoursAgoIso(1),
  updatedAt: hoursAgoIso(1),
  author: { ...PREVIEW_AUTHOR, displayName: 'Dad' },
};

const PREVIEW_ENTRIES: ListEntry[] = [
  { id: 'e1', itemId: 'preview-list', boardId: 'preview', text: 'Milk', position: 0, checkedAt: hoursAgoIso(1), checkedBy: 'preview', createdBy: 'preview', createdAt: hoursAgoIso(1), updatedAt: hoursAgoIso(1) },
  { id: 'e2', itemId: 'preview-list', boardId: 'preview', text: 'Bread', position: 1, checkedAt: null, checkedBy: null, createdBy: 'preview', createdAt: hoursAgoIso(1), updatedAt: hoursAgoIso(1) },
  { id: 'e3', itemId: 'preview-list', boardId: 'preview', text: 'Eggs', position: 2, checkedAt: null, checkedBy: null, createdBy: 'preview', createdAt: hoursAgoIso(1), updatedAt: hoursAgoIso(1) },
];

export default function CreateBoardScreen() {
  const [name, setName] = useState('');
  const [color, setColor] = useState<BoardColor>('sage');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      // The board's time zone drives date expiry (day after the event).
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const board = await createBoard(name.trim(), color, timeZone);
      router.replace(`/board/${board.id}`);
    } catch (e) {
      setError(friendlyMessage(e));
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader title="Create a fridge" tone="pine" />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Fridge name</Text>
          <TextInput
            style={styles.input}
            placeholder="Kranti Family"
            placeholderTextColor={colors.inkFaint}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />
          <Text style={[styles.label, styles.colorLabel]}>Colour</Text>
          <View
            style={styles.swatchesWrap}
          >
              {offeredBoardColors.map((k) => (
              <Pressable
                key={k}
                onPress={() => setColor(k)}
                accessibilityLabel={`${k} board colour`}
                accessibilityState={{ selected: k === color }}
                style={[
                  styles.swatch,
                  { backgroundColor: boardColors[k] },
                  k === color && styles.swatchActive,
                ]}
              />
            ))}
          </View>
          <Text style={[styles.label, styles.previewLabel]}>Preview</Text>
          <View style={styles.preview}>
            <FridgeDoor color={color} placement="top">
              <Text style={[styles.previewName, { color: doorInk(color) }]} numberOfLines={1}>
                {name.trim() || 'Your fridge'}
              </Text>
              <View style={styles.previewStack}>
                <NotePaper item={PREVIEW_NOTE} compact />
                <NotePaper item={PREVIEW_LIST} entries={PREVIEW_ENTRIES} compact />
              </View>
            </FridgeDoor>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="Create"
            onPress={create}
            disabled={!name.trim() || creating}
            style={styles.create}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  flex: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.onPineSoft, marginBottom: 10 },
  colorLabel: { marginTop: 24 },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  swatches: { flexDirection: 'row', gap: 12 },
  swatchesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  previewLabel: { marginTop: 24 },
  preview: { height: 340, marginTop: 10 },
  previewName: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
  },
  previewStack: { gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.accent },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  create: { marginTop: 28 },
});
