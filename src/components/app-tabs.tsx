import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';

export default function AppTabs() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { t } = useI18n();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.primarySoft}
      tintColor={colors.primary}
      labelStyle={{ color: colors.textSecondary, selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
