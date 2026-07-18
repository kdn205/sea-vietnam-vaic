import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeaderControls } from '@/components/ui/header-controls';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Omit for solo mode - there's no multi-device session id/people count to show. */
  sessionId?: string;
  peopleCount?: number;
  /** "End meeting" for the host (broadcasts to peers), "Leave" for everyone else. */
  leaveLabel: string;
  onLeave: () => void;
  onOpenHistory: () => void;
};

export function SessionTopBar({ sessionId, peopleCount, leaveLabel, onLeave, onOpenHistory }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.card }]}>
      <View style={styles.left}>
        <Pressable
          onPress={onOpenHistory}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: theme.background }]}
          accessibilityLabel="Open history sidebar"
        >
          <SymbolView
            name={{ ios: 'sidebar.left', android: 'view_sidebar', web: 'view_sidebar' }}
            tintColor={theme.textSecondary}
            size={16}
          />
        </Pressable>
        {sessionId ? (
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
        ) : null}
      </View>
      <View style={styles.right}>
        <HeaderControls />
        <Pressable onPress={onLeave} style={[styles.leaveButton, { backgroundColor: theme.primary }]}>
          <Text style={styles.leaveLabel}>{leaveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  leaveLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
