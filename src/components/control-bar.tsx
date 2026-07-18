import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  isRunning: boolean;
  onToggleRunning: () => void;
  onMore: () => void;
  moreLabel: string;
};

export function ControlBar({ isRunning, onToggleRunning, onMore, moreLabel }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.card }]}>
      <View style={styles.spacer} />
      <Pressable
        onPress={onToggleRunning}
        style={[styles.mainButton, { backgroundColor: theme.primary }]}
      >
        <SymbolView
          name={{ ios: isRunning ? 'pause.fill' : 'play.fill', android: isRunning ? 'pause' : 'play_arrow', web: isRunning ? 'pause' : 'play_arrow' }}
          tintColor="#FFFFFF"
          size={26}
        />
      </Pressable>
      <Pressable onPress={onMore} style={styles.moreButton} hitSlop={10} accessibilityLabel={moreLabel}>
        <SymbolView
          name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
          tintColor={theme.textSecondary}
          size={22}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  spacer: {
    width: 32,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
