import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Dark-mode toggle + VI/EN language switch, meant to sit together in a screen's top-right corner. */
export function HeaderControls({ style }: Props) {
  const theme = useTheme();
  const { scheme, toggleDarkMode } = useThemeMode();
  const { lang, setLang } = useI18n();
  const isDark = scheme === 'dark';

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={toggleDarkMode}
        hitSlop={8}
        style={[styles.iconButton, { backgroundColor: theme.primarySoft }]}
        accessibilityRole="button"
        accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <SymbolView
          name={{ ios: isDark ? 'moon.fill' : 'sun.max.fill', android: isDark ? 'dark_mode' : 'light_mode', web: isDark ? 'dark_mode' : 'light_mode' }}
          tintColor={theme.primary}
          size={16}
        />
      </Pressable>

      <Pressable
        onPress={() => setLang(lang === 'en' ? 'vi' : 'en')}
        hitSlop={8}
        style={[styles.langPill, { backgroundColor: theme.primarySoft }]}
        accessibilityRole="button"
        accessibilityLabel="Switch app language"
      >
        <Text style={[styles.langOption, { color: lang === 'vi' ? theme.primary : theme.textSecondary }]}>VI</Text>
        <View style={[styles.langDivider, { backgroundColor: theme.primarySoftBorder }]} />
        <Text style={[styles.langOption, { color: lang === 'en' ? theme.primary : theme.textSecondary }]}>EN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    gap: 6,
  },
  langOption: {
    fontSize: 12,
    fontWeight: '700',
  },
  langDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
  },
});
