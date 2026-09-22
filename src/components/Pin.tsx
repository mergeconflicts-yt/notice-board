import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import type { PinVariant } from '../utils/note';
import { seeded } from '../utils/id';

export type PinAlign = 'left' | 'center' | 'right';

export type FastenerKind = 'pin' | 'tape' | 'scotch' | 'clip' | 'sticker' | 'tack';

export type Fastener = {
  kind: FastenerKind;
  color: string;
  align: PinAlign;
  rotate: number;
  emoji?: string;
};

const PIN_COLORS = ['#E2574C', '#3E7CB1', '#F2B134', '#6AA84F', '#8E7CC3'];

const TAPE_COLORS = [
  'rgba(244, 227, 178, 0.92)',
  'rgba(238, 196, 205, 0.88)',
  'rgba(186, 212, 238, 0.88)',
  'rgba(201, 221, 190, 0.88)',
];

const STICKER_BG = ['#F6C445', '#F194B4', '#9CCB86', '#8FB8DE', '#C3B2E8', '#F49E4C'];

const STICKER_EMOJI = ['❤️', '⭐', '🌸', '🔥', '🎈', '🍀'];

/** Which fasteners each paper type can wear. */
const SETS: Record<PinVariant, FastenerKind[]> = {
  note: ['pin', 'tape', 'scotch', 'clip', 'sticker', 'tack'],
  mini: ['pin', 'tape', 'scotch', 'clip', 'sticker', 'tack'],
  announcement: ['pin', 'tape', 'scotch', 'clip', 'sticker', 'tack'],
  photo: ['pin', 'clip', 'sticker', 'tack'],
  list: ['pin', 'clip', 'tack', 'sticker'],
  appointment: ['pin', 'sticker', 'clip', 'tack', 'tape'],
  receipt: ['tape', 'scotch'],
};

const ALIGNS: PinAlign[] = ['left', 'center', 'right'];

/** Deal a random-but-stable fastener per note, like a real junk-drawer board. */
export function fastenerForNote(seed: string, variant: PinVariant): Fastener {
  const rand = seeded(seed);
  const set = SETS[variant] ?? SETS.note;
  const kind = set[Math.floor(rand() * set.length)];
  const pick = (n: number) => Math.floor(rand() * n);

  const color =
    kind === 'pin'
      ? PIN_COLORS[pick(PIN_COLORS.length)]
      : kind === 'tape'
        ? TAPE_COLORS[pick(TAPE_COLORS.length)]
        : kind === 'sticker'
          ? STICKER_BG[pick(STICKER_BG.length)]
          : kind === 'clip'
            ? '#3E362E'
            : kind === 'tack'
              ? '#C9CFD6'
              : 'rgba(238, 242, 246, 0.65)';

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
export function Pushpin({ color, align = 'center' }: { color: string; align?: PinAlign }) {
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
export function WashiTape({
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
    backgroundColor: 'rgba(62, 54, 46, 0.28)',
  },
  pinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.14)',
    shadowColor: '#000',
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
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  tape: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    height: 22,
    borderRadius: 2,
    opacity: 0.95,
    shadowColor: '#000',
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
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
  },
  scotch: {
    width: 78,
    height: 24,
    backgroundColor: 'rgba(238, 242, 246, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    opacity: 1,
  },
  scotchSheen: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
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
    backgroundColor: '#C9CFD6',
    borderWidth: 1,
    borderColor: '#9AA1A9',
    marginBottom: -3,
    zIndex: 1,
  },
  clipBody: {
    width: 30,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
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
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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
    backgroundColor: 'rgba(62, 54, 46, 0.25)',
  },
  tackHead: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#C9CFD6',
    borderWidth: 1,
    borderColor: '#9AA1A9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  tackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C838C',
  },
});
