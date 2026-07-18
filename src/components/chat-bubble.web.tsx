import { StyleSheet, Text, View } from 'react-native';

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
  isHost?: boolean;
};

// @rob117/react-native-selectable-text is a native-only Fabric component (no react-native-web
// implementation - it throws "codegenNativeComponent is not a function" if imported at all on
// web) so the "select text -> Copy/Explain" menu from chat-bubble.tsx is mobile-only. This web
// variant keeps the same plain-stacked look with natively-selectable text instead.
type Props = {
  entry: ChatBubbleEntry;
  onExplain?: (selectedText: string, contextText: string) => void;
};

export function ChatBubble({ entry }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const speakerName = entry.speaker ?? t('you');
  const speakerColor = entry.isHost ? theme.hostName : theme.participantName;

  return (
    <View style={styles.entry}>
      <View style={styles.metaRow}>
        <Text style={[styles.speaker, { color: speakerColor }]} numberOfLines={1}>
          {speakerName}
        </Text>
        {entry.time ? <Text style={[styles.time, { color: theme.textSecondary }]}>{entry.time}</Text> : null}
      </View>
      <Text selectable style={[styles.sourceText, { color: theme.text }]}>
        {entry.source}
      </Text>
      <Text selectable style={[styles.translatedText, { color: theme.primary }]}>
        {entry.translated}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    marginBottom: 18,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  speaker: {
    fontSize: 13,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
  },
  sourceText: {
    fontSize: 16,
    lineHeight: 23,
  },
  translatedText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
});
