import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FridgeDoor } from '../../components/FridgeDoor';
import { Magnet, liftTo, useReduceMotion } from '../../components/Magnet';
import { artSources } from '../../lib/packAssets';
import { colors, fonts } from '../../theme';
import type { BoardColor, PackArt } from '../../types';

/**
 * Dev-only magnet preview (docs/plan-magnets.md §4.3). Not linked from any
 * production screen and redirects away when not in a dev build.
 */
export default function MagnetPreview() {
  const magnets: PackArt[] = useMemo(
    () => [
      art('st_fuji', 'Mt. Fuji'),
      art('st_boba', 'Bubble tea'),
      art('st_bus', 'City bus'),
      art('st_cat', 'Fridge cat'),
      art('st_shell', 'Seashell'),
    ],
    [],
  );

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Magnet preview</Text>
        <Text style={styles.sub}>Dev only. Rotations are random ±10°.</Text>

        <Text style={styles.h2}>Sage door — all Starter magnets</Text>
        <View style={styles.doorBox}>
          <FridgeDoor color="sage" placement="bottom">
            <View style={styles.grid}>
              {magnets.map((m, i) => (
                <StaticMagnet key={m.artId} art={m} rotation={((i * 37) % 21) - 10} />
              ))}
            </View>
          </FridgeDoor>
        </View>

        <Text style={styles.h2}>Drag to see the lift & drop</Text>
        <View style={styles.doorBox}>
          <FridgeDoor color="sage" placement="bottom">
            <DraggableMagnet />
          </FridgeDoor>
        </View>

        <Text style={styles.h2}>Contrast — charcoal & cream</Text>
        <View style={styles.row}>
          {(['charcoal', 'cream'] as BoardColor[]).map((c) => (
            <View key={c} style={styles.half}>
              <FridgeDoor color={c} placement="bottom">
                <View style={styles.grid}>
                  {magnets.slice(0, 3).map((m, i) => (
                    <StaticMagnet key={m.artId} art={m} rotation={((i * 23) % 17) - 8} />
                  ))}
                </View>
              </FridgeDoor>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function art(artId: string, label: string): PackArt {
  return { artId, packId: 'starter', kind: 'magnet', label, path: '', w: 64, h: 64 };
}

function StaticMagnet({ art: a, rotation }: { art: PackArt; rotation: number }) {
  const lift = useSharedValue(0);
  const src = artSources(a);
  if (!src?.shadow) return null;
  return (
    <Magnet body={src.body} shadow={src.shadow} size={56} rotation={rotation} lift={lift} accessibilityLabel={a.label} />
  );
}

function DraggableMagnet() {
  const lift = useSharedValue(0);
  const reduce = useReduceMotion();
  const [shake, setShake] = useState(0);
  const a = useMemo(() => art('st_fuji', 'Mt. Fuji'), []);
  const src = artSources(a);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          liftTo(lift, 1, reduce);
        })
        .onFinalize(() => {
          liftTo(lift, 0, reduce);
          setShake((n) => n + 1);
        }),
    [lift, reduce],
  );

  if (!src?.shadow) return null;
  return (
    <View style={styles.dragArea}>
      <GestureDetector gesture={gesture}>
        <Animated.View>
          <Magnet body={src.body} shadow={src.shadow} size={96} lift={lift} accessibilityLabel="Draggable Mt. Fuji" />
        </Animated.View>
      </GestureDetector>
      <Pressable onPress={() => setShake((n) => n + 1)} style={styles.pill}>
        <Text style={styles.pillText}>drop count {shake}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60, gap: 8 },
  title: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  sub: { fontFamily: fonts.ui.regular, fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
  h2: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.ink, marginTop: 12 },
  doorBox: { height: 190, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, height: 180, borderRadius: 20, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, alignItems: 'center' },
  dragArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.pineGhost,
  },
  pillText: { fontFamily: fonts.ui.semibold, fontSize: 12, color: colors.onPine },
});
