import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: SymbolViewProps['name'];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  const theme = useTheme();
  return (
    <View style={[disabled ? null : styles.shadowWrap, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: disabled ? theme.border : pressed ? theme.primaryPressed : theme.primary,
          },
        ]}
      >
        {!disabled && <View pointerEvents="none" style={[styles.highlight, { backgroundColor: theme.highlight }]} />}
        {icon ? <SymbolView name={icon} tintColor="#FFFFFF" size={18} /> : null}
        <Text style={[styles.label, { color: '#FFFFFF' }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

/** iOS "tinted" button - a soft accent-colored fill instead of an outline, the way iOS system
 * buttons pair a filled primary action with a tinted secondary one. */
export function SecondaryButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.primarySoft,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon ? <SymbolView name={icon} tintColor={theme.primary} size={18} /> : null}
      <Text style={[styles.label, { color: theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

/** Plain, neutral text button - the low-emphasis "Cancel"-tier option in a group of actions. */
export function GhostButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.4 : pressed ? 0.5 : 1 }, style]}
    >
      {icon ? <SymbolView name={icon} tintColor={theme.textSecondary} size={18} /> : null}
      <Text style={[styles.label, { color: theme.textSecondary, fontWeight: '500' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...Shadow.small,
    borderRadius: Radius.medium,
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
});
