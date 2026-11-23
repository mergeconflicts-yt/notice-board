import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { ShopArt } from './ShopArt';
import type { PackPricing } from './pricing';
import type { ShopCardArt, ShopPack } from '../../types';

type Props = {
  bundle: ShopPack;
  pricing: PackPricing;
  artTiles: ShopCardArt[];
  extraCount: number;
  savingPercent: number | null;
  ownedEvery: boolean;
  disabled: boolean;
  buying: boolean;
  onBuy: () => void;
};

function Shimmer({ text }: { text: string }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[styles.buyText, { opacity }]}>{text}</Animated.Text>;
}

export function CollectionOffer({
  bundle,
  pricing,
  artTiles,
  extraCount,
  savingPercent,
  ownedEvery,
  disabled,
  buying,
  onBuy,
}: Props) {
  const blocked = disabled || ownedEvery || buying;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>BEST VALUE</Text>
      <Text style={styles.title}>{bundle.name}</Text>
      {bundle.blurb ? <Text style={styles.blurb}>{bundle.blurb}</Text> : null}

      <View style={styles.tiles}>
        {artTiles.map((art) => (
          <View key={art.artId} style={styles.tile}>
            <ShopArt art={[art]} size={42} />
          </View>
        ))}
        {extraCount > 0 ? (
          <View style={[styles.tile, styles.moreTile]}>
            <Text style={styles.moreText}>+{extraCount}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onBuy}
        disabled={blocked}
        style={({ pressed }) => [
          styles.buy,
          blocked && styles.buyDisabled,
          pressed && !blocked && styles.buyPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          ownedEvery ? 'You own every pack' : `Get everything for ${pricing.label}`
        }
        accessibilityState={{ disabled: blocked }}
      >
        {buying ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : ownedEvery ? (
          <Text style={styles.buyText}>You own every pack</Text>
        ) : pricing.loading ? (
          <Shimmer text={`Get everything · ${pricing.label}`} />
        ) : (
          <Text style={styles.buyText}>Get everything · {pricing.label}</Text>
        )}
      </Pressable>

      {!ownedEvery && savingPercent !== null && savingPercent >= 5 ? (
        <Text style={styles.saving}>Save {savingPercent}% compared to single packs</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pineDeep,
    borderRadius: 22,
    padding: 18,
    gap: 6,
  },
  eyebrow: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.brandYellow,
  },
  title: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 26,
    lineHeight: 30,
    color: colors.onPine,
  },
  blurb: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.onPineSoft,
  },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTile: { backgroundColor: colors.onPine },
  moreText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  buy: {
    marginTop: 12,
    height: 54,
    borderRadius: 999,
    backgroundColor: colors.onPine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buyDisabled: { opacity: 0.55 },
  buyPressed: { opacity: 0.85 },
  buyText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
  },
  saving: {
    marginTop: 2,
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.onPineSoft,
    textAlign: 'center',
  },
});
