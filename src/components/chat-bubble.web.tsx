import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

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
};

/** Plain-text transcript line (web) - matches the native plain-text style, no bubble box. */
export function ChatBubble({ entry }: Props) {
  const theme = useTheme();

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
});
