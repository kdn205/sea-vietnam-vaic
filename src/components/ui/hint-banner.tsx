import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: SymbolViewProps['name'];
  title?: string;
  body: string;
  trailingIcon?: SymbolViewProps['name'];
};

export function HintBanner({ icon, title, body, trailingIcon }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.primarySoft }]}>
      <SymbolView name={icon} tintColor={theme.primary} size={20} style={styles.leadingIcon} />
      <View style={styles.textColumn}>
        {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
        <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
      </View>
      {trailingIcon ? <SymbolView name={trailingIcon} tintColor={theme.success} size={18} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.medium,
    padding: 13,
  },
  leadingIcon: {
    marginTop: 1,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
