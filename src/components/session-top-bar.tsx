import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderControls } from '@/components/ui/header-controls';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Whether to show the session id / people-count / Leave button (host & join only). */
  showSessionInfo: boolean;
  sessionId: string;
  peopleCount: number;
  leaveLabel: string;
  onBack: () => void;
  onLeave: () => void;
  onOpenHistory: () => void;
  /** Explains the latest transcript entry - omitted (hides the button) when there's nothing yet. */
  onExplain?: () => void;
};

export function SessionTopBar({
  showSessionInfo,
  sessionId,
  peopleCount,
  leaveLabel,
  onBack,
  onLeave,
  onOpenHistory,
  onExplain,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.shadowWrap}>
      <GlassView
        glassEffectStyle="regular"
        style={[
          styles.bar,
          Platform.OS !== 'ios' && { backgroundColor: theme.glassBackground, borderColor: theme.glassBorder, borderWidth: 1 },
        ]}
      >
      <View style={styles.left}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: theme.primarySoft }]}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor={theme.primary}
            size={16}
          />
        </Pressable>
        <Pressable
          onPress={onOpenHistory}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: theme.primarySoft }]}
        >
          <SymbolView
            name={{ ios: 'sidebar.left', android: 'view_sidebar', web: 'view_sidebar' }}
            tintColor={theme.primary}
            size={16}
          />
        </Pressable>
        {showSessionInfo && (
          <View>
            <Text style={[styles.sessionId, { color: theme.text }]}>Session {sessionId}</Text>
            <View style={styles.peopleChip}>
              <SymbolView
                name={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
                tintColor={theme.textSecondary}
                size={11}
              />
              <Text style={[styles.peopleCount, { color: theme.textSecondary }]}>{peopleCount}</Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <HeaderControls onExplain={onExplain} />
        {showSessionInfo && (
          <Pressable onPress={onLeave} hitSlop={8} style={styles.leaveButton}>
            <Text style={[styles.leaveLabel, { color: theme.danger }]}>{leaveLabel}</Text>
          </Pressable>
        )}
      </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...Shadow.medium,
    borderRadius: Radius.large,
    marginBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.large,
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionId: {
    fontSize: 14,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peopleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  peopleCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  leaveButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  leaveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
