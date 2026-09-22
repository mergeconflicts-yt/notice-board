import { useEffect, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { NoteWithAuthor } from '../types';
import { NotePaper } from './NotePaper';

type Props = {
  note: NoteWithAuthor;
  left: number;
  top: number;
  width: number;
  rotation: number;
  /** Play the "settling onto the board" entrance (only for freshly added notes). */
  animateIn?: boolean;
  onPress: (note: NoteWithAuthor) => void;
};

/**
 * A read-only pin on the board. Placement comes entirely from the
 * deterministic layout, so this component never moves a note itself — it
 * only animates the spot it is handed. New papers drop in; notes that get
 * pushed down by a newer arrival slide to their new spot.
 */
export function BoardNote({
  note,
  left,
  top,
  width,
  rotation,
  animateIn = false,
  onPress,
}: Props) {
  const [topAnim] = useState(() => new Animated.Value(top));
  const [enter] = useState(() => new Animated.Value(animateIn ? 0 : 1));

  useEffect(() => {
    Animated.timing(topAnim, {
      toValue: top,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [top, topAnim]);

  useEffect(() => {
    if (!animateIn) return;
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [animateIn, enter]);

  const settleY = enter.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  const settleScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top: topAnim,
        width,
        opacity: enter,
        transform: [{ translateY: settleY }, { scale: settleScale }, { rotate: `${rotation}deg` }],
      }}
    >
      <Pressable
        onPress={() => onPress(note)}
        style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <NotePaper note={note} />
      </Pressable>
    </Animated.View>
  );
}
