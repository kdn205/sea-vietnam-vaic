import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { ChatBubble } from '@/components/chat-bubble';
import { SensitivitySlider } from '@/components/sensitivity-slider';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Waveform } from '@/components/waveform';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export type ChatLogEntry = {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  translated: string;
  speaker?: string;
  isHost?: boolean;
};

type Props = {
  sessionTab: 'chat' | 'participants';
  onChangeSessionTab: (tab: 'chat' | 'participants') => void;
  log: ChatLogEntry[];
  partialText: string;
  draftTranslated: string;
  status: string;
  isRunning: boolean;
  volumeLevel: SharedValue<number>;
  micSensitivity: number;
  onMicSensitivityChange: (value: number) => void;
  onExplain?: (selectedText: string, contextText: string) => void;
};

export function SessionChatScreen({
  sessionTab,
  onChangeSessionTab,
  log,
  partialText,
  draftTranslated,
  status,
  isRunning,
  volumeLevel,
  micSensitivity,
  onMicSensitivityChange,
  onExplain,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.container}>
      <SegmentedTabs
        options={[
          { value: 'chat', label: t('chat') },
          { value: 'participants', label: t('participants') },
        ]}
        value={sessionTab}
        onChange={onChangeSessionTab}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {log.map((entry) => (
          <ChatBubble key={entry.id} entry={entry} onExplain={onExplain} />
        ))}
        {partialText.length > 0 && (
          <View style={styles.partialBlock}>
            <Text style={[styles.partialText, { color: theme.textSecondary }]}>{partialText}</Text>
            {draftTranslated.length > 0 && (
              <Text style={[styles.draftText, { color: theme.primary }]}>{draftTranslated}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <Text style={[styles.status, { color: theme.textSecondary }]}>{status}</Text>
      <Waveform volume={volumeLevel} isRunning={isRunning} />

      <Text style={[styles.sensitivityLabel, { color: theme.textSecondary }]}>
        {t('micSensitivity')} {Math.round(micSensitivity * 100)}%
      </Text>
      <SensitivitySlider value={micSensitivity} onValueChange={onMicSensitivityChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  scrollView: {
    flex: 1,
  },
  partialBlock: {
    gap: 4,
    marginBottom: 12,
  },
  partialText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  draftText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  status: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  sensitivityLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
