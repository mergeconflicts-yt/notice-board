import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts } from '../../theme';
import { ShopArt } from './ShopArt';
import type { PackPricing } from './pricing';
import type { ShopPack } from '../../types';
import { endDateBadge } from '../../lib/shop';

export type ShopCardState = 'locked' | 'sale' | 'owned' | 'in-use';

type Props = {
  pack: ShopPack;
  state: ShopCardState;
  pricing: PackPricing;
  disabled: boolean;
  buying: boolean;
  width: number;
  onOpen: () => void;
  onAction: () => void;
};

function Shimmer({ text }: { text: string }) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[styles.actionText, { opacity }]}>{text}</Animated.Text>;
}

function badgeFor(pack: ShopPack, pricing: PackPricing, state: ShopCardState): string | null {
  if (pack.badgeText) return pack.badgeText;
  if (state === 'sale') {
    if (pack.saleLabel) return pack.saleLabel;
    if (pricing.salePercent !== null) return `${pricing.salePercent}% off`;
  }
  return endDateBadge(pack.availableUntil);
}

export function ShopPackCard({
  pack,
  state,
  pricing,
  disabled,
  buying,
  width,
  onOpen,
  onAction,
}: Props) {
  const badge = badgeFor(pack, pricing, state);
  const priceText =
    state === 'in-use' ? 'In use' : state === 'owned' ? 'Owned' : pricing.label;
  const label = `${pack.name}, ${pack.itemCount} ${pack.itemCount === 1 ? 'item' : 'items'}, ${priceText}`;
  const actionDisabled = disabled || buying;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.art, { backgroundColor: pack.cardBg ?? colors.paperEdge }]}>
        <ShopArt art={pack.cardArt} size={76} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {pack.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {pack.itemCount} {pack.itemCount === 1 ? 'item' : 'items'}
        {pack.cardTag ? ` · ${pack.cardTag}` : ''}
      </Text>

      <Pressable
        onPress={onAction}
        disabled={actionDisabled}
        style={({ pressed }) => [
          styles.action,
          state === 'in-use'
            ? styles.actionInUse
            : state === 'owned'
              ? styles.actionUse
              : styles.actionOutline,
          actionDisabled && styles.actionDisabled,
          pressed && !actionDisabled && styles.actionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'in-use'
            ? `In use, open ${pack.name}`
            : state === 'owned'
              ? `Use ${pack.name}`
              : `Buy ${pack.name} for ${pricing.label}`
        }
        accessibilityState={{ disabled: actionDisabled }}
      >
        {buying ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : state === 'in-use' || state === 'owned' ? (
          <Text style={[styles.actionText, state === 'in-use' && styles.actionTextInUse]}>
            {state === 'in-use' ? 'In use' : 'Use'}
          </Text>
        ) : pricing.loading ? (
          <Shimmer text={pricing.label} />
        ) : pricing.sale && pricing.normalLabel ? (
          <View style={styles.priceRow}>
            <Text style={styles.actionText}>{pricing.label}</Text>
            <Text style={styles.strike}>{pricing.normalLabel}</Text>
          </View>
        ) : (
          <Text style={styles.actionText}>{pricing.label}</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  art: {
    height: 108,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '92%',
    backgroundColor: colors.brandYellow,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 11,
    color: colors.ink,
  },
  name: {
    marginTop: 10,
    fontFamily: fonts.ui.extraBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
  },
  meta: {
    marginTop: 2,
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
  },
  action: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionOutline: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  actionUse: { backgroundColor: colors.brandYellow },
  actionInUse: { backgroundColor: colors.leaf },
  actionDisabled: { opacity: 0.45 },
  actionPressed: { opacity: 0.75 },
  actionText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  actionTextInUse: { color: colors.pine },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  strike: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
});
