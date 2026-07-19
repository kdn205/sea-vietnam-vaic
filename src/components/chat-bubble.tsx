import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export type ChatBubbleEntry = {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  translated: string;
  speaker?: string;
  time?: string;
};

type Props = {
  entry: ChatBubbleEntry;
  onExplain?: (selectedText: string, contextText: string) => void;
};

// Both lines used to go through SelectableTextView (from @rob117/react-native-selectable-text)
// for a custom Copy/Explain selection menu, but that native component intermittently rendered
// blank (while still taking up full layout height) under this screen's rapid live updates -
// for both the source and translated line, not just one. Plain selectable Text has no such
// issue (this matches what History already used, unaffected). Native OS text selection/copy
// still works via `selectable`; Explain moved from a selection menu to its own small button
// below the entry, explaining the translated line with the source line as context.
export function ChatBubble({ entry, onExplain }: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  const speakerColor = entry.speaker === 'Host' ? theme.speakerHost : theme.speakerGuest;

  return (
    <View style={styles.entry}>
      {entry.speaker ? (
        <Text style={[styles.speaker, { color: speakerColor }]}>{entry.speaker}</Text>
      ) : null}
      <Text selectable style={[styles.source, { color: theme.text }]}>
        {entry.sourceLang}: {entry.source}
      </Text>
      <Text selectable style={[styles.translated, { color: theme.primary }]}>
        {entry.targetLang}: {entry.translated}
      </Text>
      {onExplain && (
        <Pressable
          style={styles.explainButton}
          hitSlop={6}
          onPress={() => onExplain(entry.translated, entry.source)}
        >
          <SymbolView
            name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            tintColor={theme.textSecondary}
            size={13}
          />
          <Text style={[styles.explainLabel, { color: theme.textSecondary }]}>{t('explain')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    marginBottom: 16,
    gap: 2,
  },
  speaker: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  source: {
    fontSize: 16,
    lineHeight: 22,
  },
  translated: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    paddingVertical: 2,
  },
  explainLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
