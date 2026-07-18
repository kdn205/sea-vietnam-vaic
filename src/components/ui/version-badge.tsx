import { StyleSheet, Text } from 'react-native';

import { UI_VERSION } from '@/constants/ui-version';
import { useTheme } from '@/hooks/use-theme';

/** Small always-on-top corner label so a reload/rebuild is visually confirmable. */
export function VersionBadge() {
  const theme = useTheme();
  return (
    <Text
      pointerEvents="none"
      style={[styles.text, { color: theme.textSecondary, backgroundColor: theme.card, borderColor: theme.border }]}
    >
      {UI_VERSION}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 999,
  },
});
