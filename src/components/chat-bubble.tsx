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

// Both lines used to go through SelectableTextView (from @rob117/react-native-selectable-text)
// for a custom Copy/Explain selection menu, but that native component intermittently rendered
// blank (while still taking up full layout height) under this screen's rapid live updates -
// for both the source and translated line, not just one. Plain selectable Text has no such
// issue (this matches what History already used, unaffected). Native OS text selection/copy
// still works via `selectable`; Explain now lives as a single button in the session top bar
// (see SessionTopBar/HeaderControls) that explains the latest entry, instead of per-message.
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
