import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import type { PaperVariant } from '../utils/note';
import { seeded } from '../utils/id';
import { colors, fastenerColors } from '../theme';

type PinAlign = 'left' | 'center' | 'right';

type FastenerKind = 'pin' | 'tape' | 'scotch' | 'clip' | 'sticker' | 'tack';

type Fastener = {
  kind: FastenerKind;
  color: string;
  align: PinAlign;
  rotate: number;
  emoji?: string;
};

const STICKER_EMOJI = ['❤️', '⭐', '🌸', '🔥', '🎈', '🍀'];

/** Which fasteners each paper type can wear. */
const SETS: Record<PaperVariant, FastenerKind[]> = {
  note: ['pin', 'tape', 'scotch', 'clip', 'sticker', 'tack'],
  photo: ['pin', 'clip', 'sticker', 'tack'],
  list: ['pin', 'clip', 'tack', 'sticker'],
  appointment: ['pin', 'sticker', 'clip', 'tack', 'tape'],
};

const ALIGNS: PinAlign[] = ['left', 'center', 'right'];

/** Deal a random-but-stable fastener per item, like a real junk-drawer board. */
export function fastenerForItem(seed: string, variant: PaperVariant): Fastener {
  const rand = seeded(seed);
  const set = SETS[variant] ?? SETS.note;
  const kind = set[Math.floor(rand() * set.length)];
  const pick = (n: number) => Math.floor(rand() * n);
  const palette =
    kind === 'pin'
      ? fastenerColors.pins
      : kind === 'tape'
        ? fastenerColors.tapes
        : kind === 'sticker'
          ? fastenerColors.stickers
          : null;

  const color =
    palette?.[pick(palette.length)] ??
    (kind === 'clip'
      ? fastenerColors.clip
      : kind === 'tack'
        ? fastenerColors.metal
        : fastenerColors.scotch);

  return {
    kind,
    color,
    align: ALIGNS[pick(ALIGNS.length)],
    rotate: (rand() * 7 - 3.5) * (kind === 'tape' || kind === 'scotch' ? 2 : 1),
    emoji:
      kind === 'sticker' && rand() < 0.5
        ? STICKER_EMOJI[pick(STICKER_EMOJI.length)]
        : undefined,
  };
}

function alignPos(align: PinAlign): ViewStyle {
  return align === 'left'
    ? { left: '14%' }
    : align === 'right'
      ? { right: '14%' }
      : { left: '50%', marginLeft: -11 };
}

export function FastenerView({ fastener }: { fastener: Fastener }) {
  switch (fastener.kind) {
    case 'tape':
      return <WashiTape color={fastener.color} rotate={fastener.rotate} />;
    case 'scotch':
      return <ScotchTape rotate={fastener.rotate} align={fastener.align} />;
    case 'clip':
      return <BinderClip color={fastener.color} align={fastener.align} />;
    case 'sticker':
      return (
        <StickerDot color={fastener.color} emoji={fastener.emoji} align={fastener.align} rotate={fastener.rotate} />
      );
    case 'tack':
      return <Thumbtack align={fastener.align} />;
    default:
      return <Pushpin color={fastener.color} align={fastener.align} />;
  }
}

/** A chunky 3D pushpin like the ones holding real fridge notes. */
function Pushpin({ color, align = 'center' }: { color: string; align?: PinAlign }) {
  return (
    <View style={[styles.pinWrap, alignPos(align)]} pointerEvents="none">
      <View style={styles.pinShadow} />
      <View style={[styles.pinHead, { backgroundColor: color }]}>
        <View style={styles.pinGlint} />
      </View>
    </View>
  );
}

/** A translucent washi-tape strip. */
function WashiTape({
  color,
  rotate = 0,
  width = 64,
}: {
  color: string;
  rotate?: number;
  width?: number;
}) {
  return (
    <View
      style={[styles.tape, { backgroundColor: color, width, transform: [{ rotate: `${rotate}deg` }] }]}
      pointerEvents="none"
    >
      <View style={styles.tapeEdge} />
    </View>
  );
}

/** Clear office tape — wider, glossier, barely there. */
function ScotchTape({ rotate = 0, align = 'center' }: { rotate?: number; align?: PinAlign }) {
  return (
    <View
      style={[
        styles.tape,
        styles.scotch,
        alignPos(align),
        { transform: [{ rotate: `${rotate}deg` }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.scotchSheen} />
    </View>
  );
}

/** A little black binder clip pinching the top edge. */
function BinderClip({ color, align = 'center' }: { color: string; align?: PinAlign }) {
  return (
    <View style={[styles.clipWrap, alignPos(align)]} pointerEvents="none">
      <View style={styles.clipLever} />
      <View style={[styles.clipBody, { backgroundColor: color }]} />
    </View>
  );
}

/** A round sticker, sometimes with a tiny emoji. */
function StickerDot({
  color,
  emoji,
  align = 'center',
  rotate = 0,
}: {
  color: string;
  emoji?: string;
  align?: PinAlign;
  rotate?: number;
}) {
  return (
    <View
      style={[styles.stickerWrap, alignPos(align), { transform: [{ rotate: `${rotate}deg` }] }]}
      pointerEvents="none"
    >
      <View style={[styles.sticker, { backgroundColor: color }]}>
        {emoji ? <Text style={styles.stickerEmoji}>{emoji}</Text> : null}
      </View>
    </View>
  );
}

/** A flat silver thumbtack. */
function Thumbtack({ align = 'center' }: { align?: PinAlign }) {
  return (
    <View style={[styles.tackWrap, alignPos(align)]} pointerEvents="none">
      <View style={styles.tackShadow} />
      <View style={styles.tackHead}>
        <View style={styles.tackDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
    top: -12,
    width: 22,
    height: 22,
    zIndex: 2,
  },
  pinShadow: {
    position: 'absolute',
    bottom: -4,
    left: 1,
    width: 20,
    height: 9,
    borderRadius: 5,
    backgroundColor: fastenerColors.shadow,
  },
  pinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: fastenerColors.outline,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  pinGlint: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: fastenerColors.glint,
  },
  tape: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    height: 22,
    borderRadius: 2,
    opacity: 0.95,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    overflow: 'hidden',
  },
  tapeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: fastenerColors.tapeEdge,
    borderRadius: 2,
  },
  scotch: {
    width: 78,
    height: 24,
    backgroundColor: fastenerColors.scotchBody,
    borderWidth: 1,
    borderColor: fastenerColors.scotchEdge,
    opacity: 1,
  },
  scotchSheen: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: fastenerColors.sheen,
  },
  clipWrap: {
    position: 'absolute',
    top: -11,
    width: 30,
    alignItems: 'center',
    zIndex: 2,
  },
  clipLever: {
    width: 20,
    height: 6,
    borderRadius: 2,
    backgroundColor: fastenerColors.metal,
    borderWidth: 1,
    borderColor: fastenerColors.metalEdge,
    marginBottom: -3,
    zIndex: 1,
  },
  clipBody: {
    width: 30,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: fastenerColors.outlineStrong,
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stickerWrap: {
    position: 'absolute',
    top: -12,
    width: 26,
    height: 26,
    zIndex: 2,
  },
  sticker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: fastenerColors.outlineFaint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stickerEmoji: {
    fontSize: 14,
  },
  tackWrap: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 20,
    zIndex: 2,
  },
  tackShadow: {
    position: 'absolute',
    bottom: -3,
    left: 2,
    width: 16,
    height: 7,
    borderRadius: 4,
    backgroundColor: fastenerColors.shadowSoft,
  },
  tackHead: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: fastenerColors.metal,
    borderWidth: 1,
    borderColor: fastenerColors.metalEdge,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  tackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: fastenerColors.metalDark,
  },
});
