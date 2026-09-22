import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, noteColors, noteColorKeys } from '../theme';
import { NoteColor, NoteKind } from '../types';
import { colorForNote, parseListItems } from '../utils/note';
import { randomId } from '../utils/id';
import { formatEventAt } from '../utils/time';

type ComposerTab = 'note' | 'photo' | 'list' | 'date';

const TABS: { id: ComposerTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'note', label: 'Note', icon: 'note-text-outline' },
  { id: 'photo', label: 'Photo', icon: 'image-outline' },
  { id: 'list', label: 'List', icon: 'format-list-bulleted' },
  { id: 'date', label: 'Date', icon: 'calendar-month-outline' },
];

type ExpiryKind = 'none' | 'today' | 'tomorrow' | 'week';

const EXPIRY_OPTIONS: { label: string; kind: ExpiryKind }[] = [
  { label: 'Keep forever', kind: 'none' },
  { label: 'Today', kind: 'today' },
  { label: 'Tomorrow', kind: 'tomorrow' },
  { label: 'This week', kind: 'week' },
];

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function endOfTomorrow(): Date {
  const d = endOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}
function endOfWeek(): Date {
  const d = endOfToday();
  d.setDate(d.getDate() + 7);
  return d;
}

function expiryDateFor(kind: ExpiryKind): Date | null {
  switch (kind) {
    case 'today':
      return endOfToday();
    case 'tomorrow':
      return endOfTomorrow();
    case 'week':
      return endOfWeek();
    default:
      return null;
  }
}

function expiryIndexFor(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  const target = new Date(expiresAt).getTime();
  const idx = EXPIRY_OPTIONS.findIndex((o) => {
    const at = expiryDateFor(o.kind);
    if (!at) return false;
    return Math.abs(at.getTime() - target) < 12 * 3600000;
  });
  return idx >= 0 ? idx : 0;
}

function expiryRowLabel(idx: number): string {
  if (idx === 0) return 'Keep forever';
  return `Expires ${EXPIRY_OPTIONS[idx].label.toLowerCase()}`;
}

function defaultEventAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function eventAtFrom(data: Record<string, unknown> | null | undefined): Date {
  const raw = data?.eventAt;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return defaultEventAt();
}

type ListRow = { id: string; text: string; done: boolean };

function rowsFromInitial(
  text: string,
  data: Record<string, unknown> | null | undefined,
): { title: string; rows: ListRow[] } {
  const rawItems = data?.items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const rows = rawItems
      .filter((it): it is { text: unknown; done?: unknown } => typeof it === 'object' && it !== null)
      .map((it) => ({
        id: randomId(),
        text: typeof it.text === 'string' ? it.text : '',
        done: it.done === true,
      }))
      .filter((r) => r.text.trim());
    if (rows.length > 0) {
      const parsed = parseListItems(text);
      return { title: parsed.title ?? '', rows };
    }
  }
  const parsed = parseListItems(text);
  if (parsed.items.length > 0) {
    return {
      title: parsed.title ?? '',
      rows: parsed.items.map((it) => ({ id: randomId(), text: it.text, done: it.done })),
    };
  }
  return { title: text.trim(), rows: [{ id: randomId(), text: '', done: false }] };
}

function tabForInitial(initial: NoteSheetInitial | undefined): ComposerTab {
  if (!initial) return 'note';
  if (initial.imageUrl) return 'photo';
  if (initial.kind === 'photo') return 'photo';
  if (initial.kind === 'list') return 'list';
  if (initial.kind === 'appointment') return 'date';
  return 'note';
}

export type NoteSheetInput = {
  text: string;
  imageUrl: string | null;
  expiresAt: string | null;
  kind: NoteKind;
  data: Record<string, unknown> | null;
  color: NoteColor;
};

export type NoteSheetInitial = {
  text: string;
  imageUrl: string | null;
  expiresAt: string | null;
  kind?: NoteKind;
  data?: Record<string, unknown> | null;
  color?: NoteColor;
};

type Props = {
  visible: boolean;
  submitting?: boolean;
  submitLabel?: string;
  initial?: NoteSheetInitial;
  onClose: () => void;
  onSubmit: (input: NoteSheetInput) => void;
};

export function AddNoteSheet({
  visible,
  submitting,
  submitLabel = 'Post note',
  initial,
  onClose,
  onSubmit,
}: Props) {
  const [tab, setTab] = useState<ComposerTab>('note');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [color, setColor] = useState<NoteColor>('yellow');
  const [listTitle, setListTitle] = useState('');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [eventAt, setEventAt] = useState<Date>(() => defaultEventAt());
  const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);
  const [dtKey, setDtKey] = useState(0);
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [expiryIdx, setExpiryIdx] = useState(0);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      const nextTab = tabForInitial(initial);
      setTab(nextTab);
      setText(initial?.text ?? '');
      setImage(initial?.imageUrl ?? null);
      setColor(initial?.color ?? colorForNote(randomId()));
      setExpiryIdx(expiryIndexFor(initial?.expiresAt));
      setExpiryOpen(false);
      if (nextTab === 'list') {
        const seed = rowsFromInitial(initial?.text ?? '', initial?.data ?? null);
        setListTitle(seed.title);
        setRows(seed.rows);
      } else {
        setListTitle('');
        setRows([]);
      }
      setEventAt(eventAtFrom(initial?.data ?? null));
    }
  }

  const filledRows = rows.filter((r) => r.text.trim().length > 0);
  const canPost =
    !submitting &&
    (tab === 'note'
      ? text.trim().length > 0
      : tab === 'photo'
        ? image != null
        : tab === 'list'
          ? filledRows.length > 0
          : text.trim().length > 0);

  const pickImage = async () => {
    setPicking(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) setImage(res.assets[0].uri);
    } finally {
      setPicking(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ListRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const newRow = (): ListRow => ({ id: randomId(), text: '', done: false });

  const selectTab = (next: ComposerTab) => {
    setTab(next);
    if (next === 'list') {
      setRows((prev) => (prev.length === 0 ? [newRow(), newRow(), newRow()] : prev));
    }
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const mergeEventDate = (_event: DateTimePickerChangeEvent, selected: Date) => {
    setEventAt((prev) => {
      const next = new Date(selected);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
    // A calendar tap is a definitive pick — close it.
    setOpenPicker(null);
    if (Platform.OS === 'ios') setDtKey((k) => k + 1);
  };

  const mergeEventTime = (_event: DateTimePickerChangeEvent, selected: Date) => {
    setEventAt((prev) => {
      const next = new Date(prev);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
    if (Platform.OS === 'android') setOpenPicker(null);
    // iOS time wheels fire on every scroll tick — no auto-dismiss here,
    // the wheels close when tapping the Time button again.
  };

  const togglePicker = (which: 'date' | 'time') => {
    setOpenPicker((prev) => (prev === which ? null : which));
  };

  const submit = () => {
    const expiry = expiryDateFor(EXPIRY_OPTIONS[expiryIdx].kind);
    const expiresAt = expiry ? expiry.toISOString() : null;
    if (tab === 'list') {
      const items = filledRows.map((r) => ({ text: r.text.trim(), done: r.done }));
      const lines = [
        ...(listTitle.trim() ? [listTitle.trim()] : []),
        ...items.map((it) => `${it.done ? '☑' : '☐'} ${it.text}`),
      ];
      onSubmit({
        text: lines.join('\n'),
        imageUrl: null,
        expiresAt,
        kind: 'list',
        data: { items },
        color,
      });
      return;
    }
    if (tab === 'date') {
      onSubmit({
        text: text.trim(),
        imageUrl: null,
        expiresAt: initial?.expiresAt ?? null,
        kind: 'appointment',
        data: { eventAt: eventAt.toISOString() },
        color,
      });
      return;
    }
    onSubmit({
      text: text.trim(),
      imageUrl: image,
      expiresAt,
      kind: tab === 'photo' ? 'photo' : 'note',
      data: null,
      color,
    });
  };

  const palette = noteColors[color];
  const showExpiry = tab !== 'date';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{initial ? 'Edit note' : 'Add to board'}</Text>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color={colors.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => selectTab(t.id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={28}
                    color={active ? colors.ink : colors.inkFaint}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {tab === 'note' ? (
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
                  selectionColor={palette.ink}
                />
                <View style={styles.stickyFooter}>
                  <Pressable style={styles.attachBtn} onPress={pickImage} disabled={picking}>
                    {picking ? (
                      <ActivityIndicator size="small" color={colors.inkSoft} />
                    ) : (
                      <MaterialCommunityIcons
                        name={image ? 'check-circle' : 'image-outline'}
                        size={24}
                        color={image ? colors.accentDeep : colors.inkSoft}
                      />
                    )}
                  </Pressable>
                  <View style={styles.dots}>
                    {noteColorKeys.map((k) => {
                      const p = noteColors[k];
                      const selected = k === color;
                      return (
                        <Pressable
                          key={k}
                          hitSlop={6}
                          onPress={() => setColor(k)}
                          style={[
                            styles.dot,
                            { backgroundColor: p.bg, borderColor: p.edge },
                            selected && styles.dotSelected,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                <View style={styles.stickyCurlShadow} />
                <View style={[styles.stickyCurl, { borderBottomColor: palette.bg }]} />
              </View>
            ) : null}

            {image && tab === 'note' ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: image }} style={styles.preview} resizeMode="cover" />
                <Pressable style={styles.remove} onPress={() => setImage(null)}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ) : null}

            {tab === 'photo' ? (
              <View>
                {image ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: image }} style={styles.preview} resizeMode="cover" />
                    <Pressable style={styles.remove} onPress={() => setImage(null)}>
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.photoDrop} onPress={pickImage} disabled={picking}>
                    {picking ? (
                      <ActivityIndicator size="small" color={colors.inkSoft} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="image-outline"
                          size={36}
                          color={colors.inkFaint}
                        />
                        <Text style={styles.photoDropText}>Choose a photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder="Add a caption (optional)..."
                  placeholderTextColor={colors.inkFaint}
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            ) : null}

            {tab === 'list' ? (
              <View style={styles.notepad}>
                <View style={styles.npHoles} pointerEvents="none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.npTornHole}>
                      <View style={styles.npSlit} />
                      <View style={styles.npHole} />
                    </View>
                  ))}
                </View>
                <TextInput
                  style={styles.npTitle}
                  placeholder="List title..."
                  placeholderTextColor={colors.inkFaint}
                  value={listTitle}
                  onChangeText={setListTitle}
                />
                <View style={styles.rows}>
                  {rows.map((row) => (
                    <View key={row.id} style={styles.npRow}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => updateRow(row.id, { done: !row.done })}
                        style={[styles.rowCheck, row.done && styles.rowCheckDone]}
                      >
                        {row.done ? <Text style={styles.rowCheckMark}>✓</Text> : null}
                      </Pressable>
                      <TextInput
                        style={styles.rowInput}
                        placeholder="List item..."
                        placeholderTextColor={colors.inkFaint}
                        value={row.text}
                        onChangeText={(v) => updateRow(row.id, { text: v })}
                        onSubmitEditing={() => setRows((prev) => [...prev, newRow()])}
                        blurOnSubmit={false}
                      />
                      <Pressable hitSlop={8} onPress={() => removeRow(row.id)}>
                        <Text style={styles.rowRemove}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => setRows((prev) => [...prev, newRow()])} style={styles.addRow}>
                  <Text style={styles.addRowText}>＋ Add item</Text>
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
                    selectionColor={palette.ink}
                  />
                  <View style={styles.dots}>
                    {noteColorKeys.map((k) => {
                      const p = noteColors[k];
                      const selected = k === color;
                      return (
                        <Pressable
                          key={k}
                          hitSlop={6}
                          onPress={() => setColor(k)}
                          style={[
                            styles.dot,
                            { backgroundColor: p.bg, borderColor: p.edge },
                            selected && styles.dotSelected,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.stickyCurlShadow} />
                  <View style={[styles.stickyCurl, { borderBottomColor: palette.bg }]} />
                </View>
                <View style={styles.dtRow}>
                  <Pressable
                    style={[
                      styles.dtTrigger,
                      styles.dtHalf,
                      openPicker === 'date' && styles.dtTriggerActive,
                    ]}
                    onPress={() => togglePicker('date')}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={20}
                      color={colors.accentDeep}
                    />
                    <Text style={styles.dtTriggerText}>
                      {eventAt.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dtTrigger,
                      styles.dtHalf,
                      openPicker === 'time' && styles.dtTriggerActive,
                    ]}
                    onPress={() => togglePicker('time')}
                  >
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={20}
                      color={colors.accentDeep}
                    />
                    <Text style={styles.dtTriggerText}>
                      {eventAt.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                </View>
                {Platform.OS === 'ios' && openPicker === 'date' ? (
                  <DateTimePicker
                    key={`date-${dtKey}`}
                    value={eventAt}
                    mode="date"
                    display="inline"
                    minimumDate={todayStart}
                    onValueChange={mergeEventDate}
                    themeVariant="light"
                    accentColor={colors.accent}
                    style={styles.iosCalPicker}
                  />
                ) : null}
                {Platform.OS === 'ios' && openPicker === 'time' ? (
                  <DateTimePicker
                    value={eventAt}
                    mode="time"
                    display="spinner"
                    onValueChange={mergeEventTime}
                    themeVariant="light"
                    style={styles.iosTimePicker}
                  />
                ) : null}
                {Platform.OS === 'android' && openPicker ? (
                  <DateTimePicker
                    value={eventAt}
                    mode={openPicker}
                    display="default"
                    minimumDate={todayStart}
                    onValueChange={
                      openPicker === 'date' ? mergeEventDate : mergeEventTime
                    }
                    onDismiss={() => setOpenPicker(null)}
                  />
                ) : null}
                <Text style={styles.whenSummary}>📌 {formatEventAt(eventAt.toISOString())}</Text>
              </View>
            ) : null}

            {showExpiry ? (
              <View style={styles.expiryCard}>
                <Pressable style={styles.expiryRow} onPress={() => setExpiryOpen((v) => !v)}>
                  <MaterialCommunityIcons name="clock-outline" size={22} color={colors.inkSoft} />
                  <Text style={styles.expiryText}>{expiryRowLabel(expiryIdx)}</Text>
                  <View style={styles.expirySpacer} />
                  <MaterialCommunityIcons
                    name={expiryOpen ? 'chevron-down' : 'chevron-right'}
                    size={22}
                    color={colors.inkFaint}
                  />
                </Pressable>
                {expiryOpen
                  ? EXPIRY_OPTIONS.map((opt, i) => (
                      <Pressable
                        key={opt.label}
                        style={styles.expiryOption}
                        onPress={() => {
                          setExpiryIdx(i);
                          setExpiryOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.expiryOptionText,
                            i === expiryIdx && styles.expiryOptionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {i === expiryIdx ? (
                          <MaterialCommunityIcons
                            name="check"
                            size={20}
                            color={colors.accentDeep}
                          />
                        ) : null}
                      </Pressable>
                    ))
                  : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!canPost}
              style={[styles.postBtn, !canPost && styles.postDisabled]}
            >
              <Text style={styles.postText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(62, 54, 46, 0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 26,
    color: colors.ink,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#FBEFC3',
  },
  tabLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkFaint,
  },
  tabLabelActive: {
    color: colors.ink,
  },
  sticky: {
    borderRadius: 8,
    padding: 16,
    minHeight: 190,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  stickyInput: {
    flex: 1,
    minHeight: 110,
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    lineHeight: 32,
    textAlignVertical: 'top',
  },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  dotSelected: {
    borderColor: colors.ink,
    borderWidth: 2,
  },
  stickyCurlShadow: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 30,
    borderBottomWidth: 30,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(62, 54, 46, 0.18)',
  },
  stickyCurl: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 24,
    borderBottomWidth: 24,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dateSticky: {
    minHeight: 150,
  },
  dateInput: {
    minHeight: 64,
    fontSize: 24,
  },
  previewWrap: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  photoDrop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    borderRadius: 18,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
  },
  photoDropText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    color: colors.inkSoft,
  },
  input: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    fontFamily: fonts.hand.semibold,
    fontSize: 22,
    color: colors.ink,
  },
  captionInput: {
    minHeight: 64,
    marginTop: 12,
    fontSize: 20,
  },
  notepad: {
    backgroundColor: '#FFFDF7',
    borderRadius: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    paddingTop: 30,
    paddingHorizontal: 14,
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
  npTornHole: {
    alignItems: 'center',
    width: 12,
  },
  npSlit: {
    width: 5,
    height: 9,
    backgroundColor: colors.background,
    marginBottom: -3,
  },
  npHole: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(62, 54, 46, 0.28)',
  },
  npTitle: {
    minHeight: 48,
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    color: colors.ink,
    borderBottomWidth: 1,
    borderColor: 'rgba(62, 54, 46, 0.14)',
    marginBottom: 6,
    paddingVertical: 4,
  },
  npRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(62, 54, 46, 0.14)',
    paddingVertical: 4,
  },
  rows: {
    gap: 8,
  },
  rowCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCheckDone: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  rowCheckMark: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  rowInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: fonts.hand.semibold,
    fontSize: 20,
    color: colors.ink,
  },
  rowRemove: {
    fontSize: 14,
    color: colors.inkFaint,
    padding: 6,
  },
  addRow: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    alignItems: 'center',
  },
  addRowText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.inkSoft,
  },
  dtRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dtHalf: {
    flex: 1,
  },
  iosCalPicker: {
    height: 360,
    backgroundColor: 'transparent',
  },
  iosTimePicker: {
    height: 216,
    backgroundColor: 'transparent',
  },
  dtTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  dtTriggerActive: {
    borderColor: colors.accentDeep,
    backgroundColor: '#FFF7EC',
  },
  dtTriggerText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.ink,
  },
  whenSummary: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 10,
  },
  expiryCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  expiryText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  expirySpacer: {
    flex: 1,
  },
  expiryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  expiryOptionText: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
  },
  expiryOptionTextActive: {
    fontFamily: fonts.ui.bold,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingRight: 16,
  },
  cancelText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.inkSoft,
  },
  postBtn: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  postDisabled: {
    opacity: 0.5,
  },
  postText: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.background,
  },
});
