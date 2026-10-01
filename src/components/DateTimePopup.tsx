import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, boardColors, doorInk, doorSoft, doorTints, fonts, onTint } from '../theme';
import type { BoardColor } from '../types';

export type DateTimePopupMode = 'date' | 'time';

type Props = {
  visible: boolean;
  mode: DateTimePopupMode;
  onModeChange: (m: DateTimePopupMode) => void;
  /** Fridge door colour: the card follows it; pills and wells stay stationery. */
  doorColor: BoardColor;
  /** Current selection; the time part is preserved when picking a date and vice versa. */
  value: Date;
  minimumDate: Date;
  onConfirmDate: (d: Date) => void;
  onConfirmTime: (d: Date) => void;
  onClose: () => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ROW_H = 46;

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateTimePopup({
  visible,
  mode,
  onModeChange,
  doorColor,
  value,
  minimumDate,
  onConfirmDate,
  onConfirmTime,
  onClose,
}: Props) {
  const tint = doorTints[doorColor];
  const shadeInk = onTint(tint.shade);
  const tintInk = onTint(tint.light);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close picker" />
        <View style={[styles.card, { backgroundColor: boardColors[doorColor] }]}>
          <View style={styles.tabs}>
            {(['date', 'time'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => onModeChange(m)}
                  style={[styles.tab, { backgroundColor: tint.light, borderColor: tint.light }, active && { backgroundColor: tint.shade, borderColor: tint.shade }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={m === 'date' ? 'Pick a date' : 'Pick a time'}
                >
                  <MaterialCommunityIcons
                    name={m === 'date' ? 'calendar-month-outline' : 'clock-outline'}
                    size={18}
                    color={active ? shadeInk : tintInk}
                  />
                  <Text style={[styles.tabText, { color: active ? shadeInk : tintInk }]}>
                    {m === 'date' ? 'Date' : 'Time'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {mode === 'date' ? (
            <DateGrid key={`date-${visible}`} value={value} minimumDate={minimumDate} onPick={onConfirmDate} doorColor={doorColor} />
          ) : (
            <TimeWheels key={`time-${visible}`} value={value} onDone={onConfirmTime} doorColor={doorColor} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function DateGrid({
  value,
  minimumDate,
  onPick,
  doorColor,
}: {
  value: Date;
  minimumDate: Date;
  onPick: (d: Date) => void;
  doorColor: BoardColor;
}) {
  const [cursor, setCursor] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const ink = doorInk(doorColor);
  const soft = doorSoft(doorColor);
  const tint = doorTints[doorColor];
  const shadeInk = onTint(tint.shade);
  const minDay = startOfDay(minimumDate);

  const cells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const out: (number | null)[] = [];
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) out.push(null);
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) out.push(d);
    return out;
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const pickDay = (day: number) => {
    const next = new Date(value);
    next.setFullYear(cursor.getFullYear(), cursor.getMonth(), day);
    onPick(next);
  };

  return (
    <View>
      <View style={styles.monthRow}>
        <Pressable
          hitSlop={12}
          onPress={() => shiftMonth(-1)}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={ink} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: ink }]}>
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          hitSlop={12}
          onPress={() => shiftMonth(1)}
          accessibilityLabel="Next month"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="chevron-right" size={28} color={ink} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`${w}-${i}`} style={[styles.weekLabel, { color: soft }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`blank-${i}`} style={styles.day} />;
          const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
          const disabled = date < minDay;
          const selected = sameDay(date, value);
          const isToday = sameDay(date, new Date());
          return (
              <Pressable
                key={`day-${day}`}
                disabled={disabled}
                onPress={() => pickDay(day)}
                style={styles.day}
              accessibilityRole="button"
              accessibilityLabel={date.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              accessibilityState={{ selected, disabled }}
            >
              <View style={[styles.dayCircle, selected && { backgroundColor: tint.shade }]}>
                <Text
                  style={[
                    styles.dayText,
                    { color: ink },
                    disabled && styles.dayTextDisabled,
                    disabled && { color: soft },
                    selected && { color: shadeInk },
                    !selected && isToday && { color: ink, fontFamily: fonts.ui.bold },
                  ]}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          const today = new Date();
          setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
          const next = new Date(value);
          next.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
          if (startOfDay(next) >= minDay) onPick(next);
        }}
        style={styles.todayBtn}
        accessibilityRole="button"
        accessibilityLabel="Jump to today"
      >
        <Text style={[styles.todayText, { color: ink }]}>Today</Text>
      </Pressable>
    </View>
  );
}

function TimeWheels({
  value,
  onDone,
  doorColor,
}: {
  value: Date;
  onDone: (d: Date) => void;
  doorColor: BoardColor;
}) {
  const ink = doorInk(doorColor);
  const soft = doorSoft(doorColor);
  const [hour12, setHour12] = useState(() => value.getHours() % 12 || 12);
  const [minute, setMinute] = useState(() => value.getMinutes());
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => (value.getHours() < 12 ? 'AM' : 'PM'));
  const tint = doorTints[doorColor];
  const shadeInk = onTint(tint.shade);
  const tintInk = onTint(tint.light);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const done = () => {
    const next = new Date(value);
    next.setHours((hour12 % 12) + (period === 'PM' ? 12 : 0), minute, 0, 0);
    onDone(next);
  };

  return (
    <View>
      <View style={styles.wheels}>
        <Wheel
          label="Hour"
          data={hours}
          selected={hour12}
          onSelect={setHour12}
          format={(h) => String(h)}
          doorColor={doorColor}
        />
        <Text style={[styles.colon, { color: ink }]}>:</Text>
        <Wheel
          label="Minute"
          data={minutes}
          selected={minute}
          onSelect={setMinute}
          format={(m) => String(m).padStart(2, '0')}
          doorColor={doorColor}
        />
        <View style={styles.periodCol}>
          <Text style={[styles.wheelLabel, { color: soft }]}>AM/PM</Text>
          {(['AM', 'PM'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodBtn, { backgroundColor: tint.light, borderColor: tint.light }, period === p && { backgroundColor: tint.shade, borderColor: tint.shade }]}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
              accessibilityLabel={p}
            >
              <Text style={[styles.periodText, { color: period === p ? shadeInk : tintInk }]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        onPress={done}
        style={[styles.doneBtn, { backgroundColor: tint.shade }]}
        accessibilityRole="button"
        accessibilityLabel="Confirm time"
      >
        <Text style={[styles.doneText, { color: shadeInk }]}>
          {`Set ${hour12}:${String(minute).padStart(2, '0')} ${period}`}
        </Text>
      </Pressable>
    </View>
  );
}

function Wheel({
  label,
  data,
  selected,
  onSelect,
  format,
  doorColor,
}: {
  label: string;
  data: number[];
  selected: number;
  onSelect: (v: number) => void;
  format: (v: number) => string;
  doorColor: BoardColor;
}) {
  const soft = doorSoft(doorColor);
  const tint = doorTints[doorColor];
  const shadeInk = onTint(tint.shade);
  return (
    <View style={styles.wheelCol}>
      <Text style={[styles.wheelLabel, { color: soft }]}>{label}</Text>
      <FlatList
        data={data}
        keyExtractor={(v) => String(v)}
        style={[styles.wheel, { backgroundColor: tint.light }]}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        initialScrollIndex={Math.max(0, data.indexOf(selected))}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
              <Pressable
                onPress={() => onSelect(item)}
                style={[styles.wheelRow, active && { backgroundColor: doorTints[doorColor].shade }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} ${format(item)}`}
            >
              <Text
                style={[
                  styles.wheelText,
                  { color: soft },
                  active && { fontFamily: fonts.ui.bold, color: shadeInk },
                ]}
              >
                {format(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    // Unselected tabs stay white on every door.
    backgroundColor: colors.surface,
  },
  tabText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.ink },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthLabel: { fontFamily: fonts.ui.extraBold, fontSize: 18, color: colors.ink },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkFaint,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inset circle so the selected chip reads centered with breathing room
  // instead of bleeding edge to edge across the grid.
  dayCircle: {
    width: '84%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  dayTextDisabled: { color: colors.inkFaint },
  todayBtn: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  todayText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.ink },
  wheels: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  wheelCol: { flex: 1 },
  wheelLabel: {
    textAlign: 'center',
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkFaint,
    marginBottom: 4,
  },
  wheel: { height: ROW_H * 5, backgroundColor: colors.surface, borderRadius: 14 },
  wheelRow: { height: ROW_H, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  wheelText: { fontFamily: fonts.ui.semibold, fontSize: 17, color: colors.inkSoft },
  colon: {
    alignSelf: 'center',
    fontFamily: fonts.ui.bold,
    fontSize: 22,
    color: colors.ink,
    marginTop: 20,
  },
  periodCol: { flex: 0.9, gap: 8 },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    // Unselected AM/PM stays white on every door.
    backgroundColor: colors.surface,
    minHeight: ROW_H,
  },
  periodText: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink },
  doneBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.background },
});
