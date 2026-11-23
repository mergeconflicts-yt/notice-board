import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../theme';
import { artSources } from '../../lib/packAssets';
import type { ShopCardArt } from '../../types';

type Props = {
  art: ShopCardArt[];
  size: number;
  /** Degrees per tile; omitted for the collection offer. */
  tilt?: boolean;
};

function sourceFor(art: ShopCardArt) {
  return artSources({
    artId: art.artId,
    packId: art.packId,
    kind: art.kind,
    label: art.label,
    path: art.path,
    w: null,
    h: null,
  })?.body;
}

/** One or two pack-art tiles, drawn from data (never a pack id switch). */
export function ShopArt({ art, size, tilt = true }: Props) {
  const tiles = art.slice(0, 2);
  if (tiles.length === 0) {
    return <View style={[styles.missing, { width: size, height: size, borderRadius: size * 0.28 }]} />;
  }
  return (
    <View style={styles.row}>
      {tiles.map((tile, index) => {
        const source = sourceFor(tile);
        const rotation = tilt ? (index === 0 ? -5 : 5) : 0;
        return source ? (
          <Image
            key={tile.artId}
            source={source}
            style={[
              { width: size, height: size, transform: [{ rotate: `${rotation}deg` }] },
              index > 0 && { marginLeft: -size * 0.22 },
            ]}
            contentFit="contain"
            cachePolicy="disk"
            accessible={false}
          />
        ) : (
          <View
            key={tile.artId}
            style={[
              styles.missing,
              {
                width: size,
                height: size,
                borderRadius: size * 0.28,
                transform: [{ rotate: `${rotation}deg` }],
              },
              index > 0 && { marginLeft: -size * 0.22 },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  missing: {
    backgroundColor: colors.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inkFaint,
  },
});
