import * as Clipboard from 'expo-clipboard';
import { SelectableTextView } from '@rob117/react-native-selectable-text';
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

type Props = {
  entry: ChatBubbleEntry;
  /** Selecting text and choosing "Explain" from the native text-selection menu. */
  onExplain?: (selectedText: string, contextText: string) => void;
};

/** Transcript entry styled like a meeting-notes card: avatar + speaker/time header, then the
 * original and translated lines as stacked bubbles. */
export function ChatBubble({ entry, onExplain }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const menuOptions = [t('copy'), t('explain')];
  const speakerName = entry.speaker ?? t('you');

  const handleSelection = (contextText: string) => ({ chosenOption, highlightedText }: { chosenOption: string; highlightedText: string }) => {
    if (!highlightedText?.trim()) return;
    if (chosenOption === t('copy')) {
      Clipboard.setStringAsync(highlightedText);
    } else if (chosenOption === t('explain')) {
      onExplain?.(highlightedText, contextText);
    }
  };

  return (
    <View style={styles.entry}>
      <View style={styles.header}>
        <Avatar name={speakerName} size={28} />
        <Text style={[styles.speaker, { color: theme.text }]} numberOfLines={1}>
          {speakerName}
        </Text>
        {entry.time ? <Text style={[styles.time, { color: theme.textSecondary }]}>{entry.time}</Text> : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.chatBubbleTheirs, borderColor: theme.border }]}>
        <Text style={[styles.langLabel, { color: theme.textSecondary }]}>{entry.sourceLang}</Text>
        <SelectableTextView menuOptions={menuOptions} onSelection={handleSelection(entry.source)}>
          <Text style={[styles.text, { color: theme.text }]}>{entry.source}</Text>
        </SelectableTextView>
      </View>

      <View style={[styles.card, { backgroundColor: theme.chatBubbleMine, borderColor: theme.primarySoftBorder }]}>
        <Text style={[styles.langLabel, { color: theme.primary }]}>{entry.targetLang}</Text>
        <SelectableTextView menuOptions={menuOptions} onSelection={handleSelection(entry.translated)}>
          <Text style={[styles.text, { color: theme.text, fontWeight: '600' }]}>{entry.translated}</Text>
        </SelectableTextView>
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
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
    marginLeft: 36,
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
