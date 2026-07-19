import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: [Option<T>, Option<T>];
  value: T;
  onChange: (value: T) => void;
};

/** iOS UISegmentedControl look: a recessed track with the selected segment riding a floating,
 * shadowed knob - not a filled "chip" pill. */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.groupedBackground }]}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              selected && [styles.segmentSelected, { backgroundColor: theme.card }],
            ]}
          >
            <Text
              style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.small,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.small - 2,
    alignItems: 'center',
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
