import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePopup } from './DateTimePopup';
import { boardColors, colors, doorInk, doorSoft, doorTints, fonts, noteColors, noteColorKeys, onTint } from '../theme';
import { BoardColor, ItemColor, ItemType, ItemWithAuthor } from '../types';
import { colorForItem, parseListItems } from '../utils/note';
import { randomId } from '../hooks/useBoard';

type ComposerTab = 'note' | 'photo' | 'list' | 'date';

const TABS: { id: ComposerTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'note', label: 'Note', icon: 'note-text-outline' },
  { id: 'photo', label: 'Photo', icon: 'image-outline' },
  { id: 'list', label: 'List', icon: 'format-list-bulleted' },
  { id: 'date', label: 'Date', icon: 'calendar-month-outline' },
];

/** Mirrors the server's per-list entry cap. */
const MAX_ROWS = 500;

export type NoteDraft = {
  type: ItemType;
  color: ItemColor;
  body: string;
  title: string;
  eventAt: string | null;
  place: string;
  entries: { id: string; text: string }[];
  /** A freshly picked local image, or null. */
  photoUri: string | null;
  /** Pin at creation ("Keep at top"). */
  pinned: boolean;
  /** Extra keep_longer applications after posting (each +7 days). */
  keepExtra: number;
};

/** Keep-duration stops: 0 = standard lifetime, then +7/+14/+21 days. */
const KEEP_STOPS = 4;

type ListRow = { id: string; text: string };

function defaultEventAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function tabForItem(item: ItemWithAuthor): ComposerTab {
  if (item.type === 'photo') return 'photo';
  if (item.type === 'list') return 'list';
  if (item.type === 'date') return 'date';
  return 'note';
}

type Props = {
  visible: boolean;
  submitting?: boolean;
  submitLabel?: string;
  /** Fridge door colour: the sheet frame follows it (all 4 post types). */
  doorColor: BoardColor;
  /** Present when editing; drives the initial tab and fields. */
  initial?: ItemWithAuthor | null;
  entries?: { id: string; text: string }[];
  /** Signed URL of the existing photo when editing a photo post. */
  photoUrl?: string | null;
  onClose: () => void;
  onSubmit: (draft: NoteDraft) => void;
};

export function AddNoteSheet({
  visible,
  submitting,
  submitLabel = 'Post',
  doorColor,
  initial = null,
  entries = [],
  photoUrl = null,
  onClose,
  onSubmit,
}: Props) {
  const editing = initial !== null;
  const [tab, setTab] = useState<ComposerTab>('note');
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [color, setColor] = useState<ItemColor>('butter');
  const [listTitle, setListTitle] = useState('');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [eventAt, setEventAt] = useState<Date>(() => defaultEventAt());
  const [pinned, setPinned] = useState(false);
  const [keepExtra, setKeepExtra] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [picking, setPicking] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const rowInputRefs = useRef(new Map<string, TextInput | null>());
  const pendingFocusRowId = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      if (initial) {
        const nextTab = tabForItem(initial);
        setTab(nextTab);
        setColor(initial.color);
        // The text box is the body for notes/photos and the title for dates.
        setText(
          initial.type === 'date'
            ? (initial.title ?? '')
            : initial.type === 'note' || initial.type === 'photo'
              ? (initial.body ?? '')
              : '',
        );
        setListTitle(initial.type === 'list' ? (initial.title ?? '') : '');
        setRows(initial.type === 'list' ? entries.map((e) => ({ id: e.id, text: e.text })) : []);
        setEventAt(initial.eventAt ? new Date(initial.eventAt) : defaultEventAt());
      } else {
        setTab('note');
        setColor(colorForItem(randomId()));
        setText('');
        setListTitle('');
        setRows([]);
        setEventAt(defaultEventAt());
      }
      setPhotoUri(null);
      setPickerOpen(false);
      setPinned(false);
      setKeepExtra(0);
    }
  }

  const cycleKeep = () => setKeepExtra((e) => (e + 1) % KEEP_STOPS);

  const openDatePicker = () => {
    setPickerMode('date');
    setPickerOpen(true);
  };

  const openTimePicker = () => {
    setPickerMode('time');
    setPickerOpen(true);
  };

  const confirmPickedDate = (selected: Date) => {
    setEventAt((prev) => {
      const next = new Date(prev);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
    setPickerOpen(false);
  };

  const confirmPickedTime = (selected: Date) => {
    setEventAt((prev) => {
      const next = new Date(prev);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
    setPickerOpen(false);
  };

  // Focus a freshly added row once it has mounted, and keep it in view.
  useEffect(() => {
    const id = pendingFocusRowId.current;
    if (!id) return;
    pendingFocusRowId.current = null;
    const t = setTimeout(() => {
      rowInputRefs.current.get(id)?.focus();
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [rows]);

  const filledRows = rows.filter((r) => r.text.trim().length > 0);
  const canPost = !submitting && (
    tab === 'note'
      // A note edit must not save empty text.
      ? text.trim().length > 0
      : tab === 'photo'
        ? photoUri != null || (editing && initial?.photoPath != null)
        : tab === 'list'
          ? filledRows.length > 0
          : text.trim().length > 0
  );

  const pickImage = async () => {
    setPicking(true);
    try {
      // Request the original (quality: 1 = no pre-compress) so the single
      // client-side lossy encode happens in preparePhoto (2048px / JPEG
      // 0.8), keeping maximum fidelity into the upload pipeline.
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setTab('photo');
      }
    } finally {
      setPicking(false);
    }
  };

  const updateRow = (id: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, text: value } : r)));

  const focusRow = (id: string) => rowInputRefs.current.get(id)?.focus();

  const addRowAndFocus = () => {
    if (filledRows.length >= MAX_ROWS) return;
    const row = { id: randomId(), text: '' };
    pendingFocusRowId.current = row.id;
    setRows((prev) => [...prev, row]);
  };

  // Enter: jump to the next row when there is one, otherwise add a fresh row
  // (but never stack a second empty row).
  const submitRow = (index: number) => {
    if (index < rows.length - 1) {
      focusRow(rows[index + 1].id);
      return;
    }
    if (!rows[index]?.text.trim()) return;
    addRowAndFocus();
  };

  const selectTab = (next: ComposerTab) => {
    if (next === 'list' && rows.length === 0) {
      const parsed = parseListItems(text);
      if (parsed.items.length > 0) {
        setListTitle(parsed.title ?? '');
        setRows(parsed.items.map((it) => ({ id: randomId(), text: it.text })).slice(0, MAX_ROWS));
      } else {
        setRows([{ id: randomId(), text: '' }, { id: randomId(), text: '' }, { id: randomId(), text: '' }]);
      }
    }
    setTab(next);
  };

  const submit = () => {
    if (tab === 'list') {
      onSubmit({
        type: 'list',
        color,
        body: '',
        title: listTitle.trim(),
        eventAt: null,
        place: '',
        entries: filledRows.slice(0, MAX_ROWS).map((r) => ({ id: r.id, text: r.text.trim() })),
        photoUri: null,
        pinned,
        keepExtra: 0,
      });
      return;
    }
    if (tab === 'date') {
      onSubmit({
        type: 'date',
        color,
        body: '',
        title: text.trim(),
        eventAt: eventAt.toISOString(),
        place: '',
        entries: [],
        photoUri: null,
        pinned,
        keepExtra,
      });
      return;
    }
    if (tab === 'photo') {
      onSubmit({
        type: 'photo',
        color,
        body: text.trim(),
        title: '',
        eventAt: null,
        place: '',
        entries: [],
        photoUri,
        pinned,
        keepExtra,
      });
      return;
    }
    onSubmit({
      type: 'note',
      color,
      body: text.trim(),
      title: '',
      eventAt: null,
      place: '',
      entries: [],
      photoUri: null,
      pinned,
      keepExtra,
    });
  };

  const palette = noteColors[color];
  // Sheet chrome follows the fridge door (all 4 post types); paper content
  // and pills keep stationery colors.
  const ink = doorInk(doorColor);
  const soft = doorSoft(doorColor);
  const doorBg = boardColors[doorColor];
  // Option pills follow the door: light tint at rest, shade when selected.
  const tint = doorTints[doorColor];
  const tintInk = onTint(tint.light);
  const shadeInk = onTint(tint.shade);
  const tintRest = { backgroundColor: tint.light, borderColor: tint.light };
  const tintActive = { backgroundColor: tint.shade, borderColor: tint.shade };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        // iOS shifts the sheet above the keyboard; Android must shrink it
        // instead (a Modal window doesn't resize), or the lower fields sit
        // behind the keyboard with nowhere to scroll.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: doorBg }]}>
          <View style={styles.header}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: ink }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: ink }]}>{editing ? 'Edit' : 'Add to fridge'}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {!editing ? (
            <View style={styles.tabs}>
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => selectTab(t.id)}
                    style={[styles.tab, tintRest, active && tintActive]}
                  >
                    <MaterialCommunityIcons
                      name={t.icon}
                      size={20}
                      color={active ? shadeInk : tintInk}
                    />
                    <Text style={[styles.tabLabel, { color: active ? shadeInk : tintInk }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {(tab === 'note' || (editing && initial?.type === 'note')) ? (
              <View style={[styles.sticky, { backgroundColor: palette.bg }]}>
                <TextInput
                  style={[styles.stickyInput, { color: palette.ink }]}
                  placeholder="Write something..."
                  placeholderTextColor={colors.inkFaint}
                  value={text}
                  onChangeText={setText}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  maxLength={2000}
                  selectionColor={palette.ink}
                />
              </View>
            ) : null}

            {tab === 'photo' ? (
              <View>
                {photoUri || initial?.photoPath ? (
                  <View style={styles.previewWrap}>
                    <Image
                      source={{ uri: photoUri ?? photoUrl ?? undefined }}
                      style={styles.preview}
                      contentFit="cover"
                    />
                    {photoUri ? (
                      <Pressable style={styles.remove} onPress={() => setPhotoUri(null)}>
                        <Text style={styles.removeText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Pressable
                    style={[styles.photoDrop, { backgroundColor: tint.light, borderColor: tintInk }]}
                    onPress={pickImage}
                    disabled={picking}
                  >
                    {picking ? (
                      <ActivityIndicator color={tintInk} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="image-outline" size={36} color={tintInk} />
                        <Text style={[styles.photoDropText, { color: tintInk }]}>Choose a photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
                <TextInput
                  style={[styles.input, styles.captionInput, { backgroundColor: tint.light, color: tintInk }]}
                  placeholder="Add a caption (optional)..."
                  placeholderTextColor={tintInk}
                  selectionColor={tintInk}
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
              </View>
            ) : null}

            {tab === 'list' ? (
              <View style={[styles.notepad, { backgroundColor: palette.bg, borderColor: palette.edge }]}>
                <View style={styles.npHoles} pointerEvents="none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.npTornHole}>
                      <View style={styles.npSlit} />
                      <View style={styles.npHole} />
                    </View>
                  ))}
                </View>
                <TextInput
                  style={[styles.npTitle, { color: palette.ink }]}
                  placeholder="List title..."
                  placeholderTextColor={palette.ink}
                  value={listTitle}
                  onChangeText={setListTitle}
                  maxLength={120}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (rows.length > 0) focusRow(rows[0].id);
                    else addRowAndFocus();
                  }}
                />
                <View style={styles.rows}>
                  {rows.map((row, index) => (
                    <View key={row.id} style={[styles.npRow, { borderColor: palette.edge }]}>
                      <View style={[styles.rowBullet, { borderColor: palette.ink }]} />
                      <TextInput
                        style={[styles.rowInput, { color: palette.ink }]}
                        placeholder="List item..."
                        placeholderTextColor={palette.ink}
                        value={row.text}
                        onChangeText={(v) => updateRow(row.id, v)}
                        maxLength={200}
                        onSubmitEditing={() => submitRow(index)}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        ref={(el) => {
                          if (el) rowInputRefs.current.set(row.id, el);
                          else rowInputRefs.current.delete(row.id);
                        }}
                      />
                      <Pressable
                        hitSlop={8}
                        onPress={() => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== row.id)))}
                        accessibilityLabel={`Remove item ${index + 1}`}
                      >
                        <Text style={[styles.rowRemove, { color: palette.ink }]}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable onPress={addRowAndFocus} style={[styles.addRow, { borderColor: palette.ink }]}>
                  <Text style={[styles.addRowText, { color: palette.ink }]}>＋ Add item</Text>
                </Pressable>
              </View>
            ) : null}

            {tab === 'date' ? (
              <View>
                <View style={[styles.sticky, styles.dateSticky, { backgroundColor: palette.bg }]}>
                  <TextInput
                    style={[styles.stickyInput, styles.dateInput, { color: palette.ink }]}
                    placeholder="What's happening?"
                    placeholderTextColor={colors.inkFaint}
                    value={text}
                    onChangeText={setText}
                    multiline
                    autoFocus
                    textAlignVertical="top"
                    maxLength={120}
                    selectionColor={palette.ink}
                  />
                </View>
                <View style={styles.dtRow}>
                  <Pressable
                    style={[styles.dtTrigger, tintRest, pickerOpen && pickerMode === 'date' && tintActive]}
                    onPress={openDatePicker}
                    accessibilityRole="button"
                    accessibilityLabel="Pick a date"
                  >
                    <MaterialCommunityIcons name="calendar-month-outline" size={20} color={tintInk} />
                    <Text style={[styles.dtTriggerText, { color: tintInk }]}>
                      {eventAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dtTrigger, tintRest, pickerOpen && pickerMode === 'time' && tintActive]}
                    onPress={openTimePicker}
                    accessibilityRole="button"
                    accessibilityLabel="Pick a time"
                  >
                    <MaterialCommunityIcons name="clock-outline" size={20} color={tintInk} />
                    <Text style={[styles.dtTriggerText, { color: tintInk }]}>
                      {eventAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                </View>
                <DateTimePopup
                  visible={pickerOpen}
                  mode={pickerMode}
                  onModeChange={setPickerMode}
                  doorColor={doorColor}
                  value={eventAt}
                  minimumDate={todayStart}
                  onConfirmDate={confirmPickedDate}
                  onConfirmTime={confirmPickedTime}
                  onClose={() => setPickerOpen(false)}
                />
              </View>
            ) : null}
          </ScrollView>

          <ColorDots color={color} onPick={setColor} doorColor={doorColor} />

          <View style={[styles.footerDivider, { backgroundColor: soft }]} />

          {!editing ? (
            <View style={styles.createRow}>
              {tab !== 'list' ? (
                <Pressable
                  onPress={cycleKeep}
                  disabled={pinned}
                  hitSlop={8}
                  style={[
                    styles.keepBtn,
                    keepExtra > 0 && !pinned && styles.keepBtnActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Keep for longer"
                  accessibilityState={{ selected: keepExtra > 0 }}
                >
                  <MaterialCommunityIcons
                    name={keepExtra > 0 ? 'clock-plus' : 'clock-outline'}
                    size={20}
                    color={pinned ? soft : keepExtra > 0 ? colors.accentDeep : ink}
                  />
                  <Text
                    style={[
                      styles.keepText,
                      { color: ink },
                      pinned && { color: soft },
                      keepExtra > 0 && !pinned && styles.keepTextActive,
                    ]}
                  >
                    {keepExtra > 0 ? `Keep +${keepExtra * 7}d` : 'Keep'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setPinned((p) => !p)}
                hitSlop={8}
                style={styles.keepBtn}
                accessibilityRole="button"
                accessibilityState={{ selected: pinned }}
              >
                <MaterialCommunityIcons
                  name={pinned ? 'pin' : 'pin-outline'}
                  size={20}
                    color={pinned ? colors.accentDeep : ink}
                  />
                  <Text style={[styles.keepText, { color: ink }]}>Keep at top</Text>
              </Pressable>
              <View style={styles.createSpacer} />
              <Pressable onPress={submit} disabled={!canPost} style={[styles.postBtn, tintActive, !canPost && styles.postDisabled]}>
                <Text style={[styles.postText, { color: shadeInk }]}>Post</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: ink }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={!canPost} style={[styles.postBtn, tintActive, !canPost && styles.postDisabled]}>
                <Text style={[styles.postText, { color: shadeInk }]}>{submitLabel}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ColorDots({ color, onPick, doorColor }: { color: ItemColor; onPick: (c: ItemColor) => void; doorColor: BoardColor }) {
  return (
    <View style={styles.dots}>
      {noteColorKeys.map((k) => {
        const p = noteColors[k];
        const selected = k === color;
        return (
          <Pressable
            key={k}
            hitSlop={8}
            onPress={() => onPick(k)}
            accessibilityLabel={`${k} colour`}
            accessibilityState={{ selected }}
            style={[
              styles.dot,
              { backgroundColor: p.bg, borderColor: p.edge },
              selected && { borderColor: doorInk(doorColor), borderWidth: 2.5 },
            ]}
          />
        );
      })}
    </View>
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
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.pine,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cancelBtn: { minWidth: 64 },
  cancelText: { fontFamily: fonts.ui.regular, fontSize: 17, color: colors.onPine },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.extraBold,
    fontSize: 20,
    color: colors.onPine,
  },
  headerSpacer: { width: 64 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.leaf,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabLabel: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.pine },
  tabLabelActive: { color: colors.background },
  // Takes the space left by the header/tabs/dots/actions inside the
  // maxHeight-capped sheet and scrolls, so no field can end up underneath the
  // colour row or keyboard.
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  sticky: { borderRadius: 8, padding: 16, minHeight: 300 },
  stickyInput: {
    minHeight: 110,
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    lineHeight: 32,
    textAlignVertical: 'top',
  },
  dateSticky: { minHeight: 130 },
  dateInput: { minHeight: 64, fontSize: 24 },
  dots: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1 },
  footerDivider: {
    height: 1,
    backgroundColor: colors.onPineFaint,
    marginTop: 10,
  },
  previewWrap: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  preview: { width: '100%', aspectRatio: 16 / 9 },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  photoDrop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.pine,
    borderRadius: 18,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.leaf,
  },
  photoDropText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.pine },
  input: {
    minHeight: 96,
    backgroundColor: colors.leaf,
    borderRadius: 18,
    padding: 16,
    fontFamily: fonts.hand.semibold,
    fontSize: 20,
    color: colors.pine,
  },
  captionInput: {
    minHeight: 60,
    marginTop: 12,
    fontSize: 18,
    // Caption follows the door tint like the other composer fields.
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  notepad: {
    backgroundColor: colors.paper,
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.paperEdge,
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  npHoles: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  npTornHole: { alignItems: 'center', width: 12 },
  npSlit: { width: 5, height: 9, backgroundColor: colors.background, marginBottom: -3 },
  npHole: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  npTitle: {
    minHeight: 48,
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    lineHeight: 30,
    color: colors.ink,
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  npRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: colors.hairline, paddingBottom: 4 },
  rowBullet: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.ink },
  rows: { gap: 4, marginTop: 6 },
  rowInput: { flex: 1, minHeight: 44, fontFamily: fonts.hand.regular, fontSize: 22, lineHeight: 24, color: colors.ink },
  rowRemove: { fontSize: 14, color: colors.inkFaint, padding: 6 },
  addRow: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.onPineFaint,
    alignItems: 'center',
  },
  addRowText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.onPineSoft },
  dtRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dtTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.leaf,
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  dtTriggerActive: { borderColor: colors.accentDeep, backgroundColor: colors.accentWash },
  dtTriggerText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.pine },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  keepBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keepBtnActive: {
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: -10,
    marginVertical: -5,
  },
  keepText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.onPine },
  keepTextActive: { color: colors.accentDeep, fontFamily: fonts.ui.bold },
  createSpacer: { flex: 1 },
  postBtn: { backgroundColor: colors.leaf, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 9 },
  postDisabled: { backgroundColor: colors.inkFaint },
  postText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.pine },
});
