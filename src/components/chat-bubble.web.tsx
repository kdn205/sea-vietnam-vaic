import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
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

// @rob117/react-native-selectable-text is a native-only Fabric component (no react-native-web
// implementation - it throws "codegenNativeComponent is not a function" if imported at all on
// web) so the "select text -> Copy/Explain" menu from chat-bubble.tsx is mobile-only. This web
// variant keeps the same look with plain, natively-selectable text instead.
function Line({
  langLabel,
  text,
  tinted,
}: {
  langLabel: string;
  text: string;
  tinted: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.line,
        { backgroundColor: tinted ? theme.chatBubbleMine : theme.chatBubbleTheirs, borderColor: tinted ? theme.primarySoftBorder : theme.border },
      ]}
    >
      <Text style={[styles.langLabel, { color: tinted ? theme.primary : theme.textSecondary }]}>{langLabel}</Text>
      <Text selectable style={[styles.text, { color: theme.text, fontWeight: tinted ? '600' : '400' }]}>
        {text}
      </Text>
    </View>
  );
}

type Props = {
  entry: ChatBubbleEntry;
  onExplain?: (selectedText: string, contextText: string) => void;
};

export function ChatBubble({ entry }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const speakerName = entry.speaker ?? t('you');

  return (
    <View style={styles.entry}>
      <View style={styles.header}>
        <Avatar name={speakerName} size={28} />
        <Text style={[styles.speaker, { color: theme.text }]} numberOfLines={1}>
          {speakerName}
        </Text>
        {entry.time ? <Text style={[styles.time, { color: theme.textSecondary }]}>{entry.time}</Text> : null}
      </View>
      <View style={styles.pair}>
        <Line langLabel={entry.sourceLang} text={entry.source} tinted={false} />
        <Line langLabel={entry.targetLang} text={entry.translated} tinted />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    marginBottom: 14,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speaker: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  time: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  pair: {
    gap: 6,
    marginLeft: 36,
  },
  line: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  langLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
});
