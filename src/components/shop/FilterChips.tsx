import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';

export type ShopFilter = { id: string; label: string };

type Props = {
  filters: ShopFilter[];
  selected: string;
  onSelect: (id: string) => void;
};

export function FilterChips({ filters, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {filters.map((filter) => {
        const active = filter.id === selected;
        return (
          <Pressable
            key={filter.id}
            onPress={() => onSelect(filter.id)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${filter.label} filter`}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: 10, paddingHorizontal: 20, paddingVertical: 4 },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.ink },
  labelActive: { color: colors.onPine },
  pressed: { opacity: 0.8 },
});
