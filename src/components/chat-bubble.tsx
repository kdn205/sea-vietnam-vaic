import * as Clipboard from 'expo-clipboard';
import { SelectableTextView } from '@rob117/react-native-selectable-text';
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

type Props = {
  entry: ChatBubbleEntry;
  /** Selecting text and choosing "Explain" from the native text-selection menu. */
  onExplain?: (selectedText: string, contextText: string) => void;
};

/** Plain transcript row: speaker + time, then the source line and its translation
 * stacked directly underneath - same alignment, no bubble, no left/right split. */
export function ChatBubble({ entry, onExplain }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const menuOptions = [t('copy'), t('explain')];
  const speakerName = entry.speaker ?? t('you');
  const speakerColor = entry.isHost ? theme.hostName : theme.participantName;

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
      <View style={styles.metaRow}>
        <Text style={[styles.speaker, { color: speakerColor }]} numberOfLines={1}>
          {speakerName}
        </Text>
        {entry.time ? <Text style={[styles.time, { color: theme.textSecondary }]}>{entry.time}</Text> : null}
      </View>
      <SelectableTextView menuOptions={menuOptions} onSelection={handleSelection(entry.source)}>
        <Text style={[styles.sourceText, { color: theme.text }]}>{entry.source}</Text>
      </SelectableTextView>
      <SelectableTextView menuOptions={menuOptions} onSelection={handleSelection(entry.translated)}>
        <Text style={[styles.translatedText, { color: theme.primary }]}>{entry.translated}</Text>
      </SelectableTextView>
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
