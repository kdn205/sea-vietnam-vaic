import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChatBubble } from '@/components/chat-bubble';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export type ChatLogEntry = {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  translated: string;
  speaker?: string;
};

type Props = {
  sessionTab: 'chat' | 'participants';
  onChangeSessionTab: (tab: 'chat' | 'participants') => void;
  log: ChatLogEntry[];
  partialText: string;
  draftTranslated: string;
  status: string;
  onExplain?: (selectedText: string, contextText: string) => void;
  /** Pending speak requests waiting on this (host) device - shown as a badge on the Participants tab. */
  pendingRequestCount?: number;
};

export function SessionChatScreen({
  sessionTab,
  onChangeSessionTab,
  log,
  partialText,
  draftTranslated,
  status,
  onExplain,
  pendingRequestCount = 0,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.container}>
      <SegmentedTabs
        options={[
          { value: 'chat', label: t('chat') },
          {
            value: 'participants',
            label: pendingRequestCount > 0 ? `${t('participants')} (${pendingRequestCount})` : t('participants'),
          },
        ]}
        value={sessionTab}
        onChange={onChangeSessionTab}
      />

      <ScrollView
        ref={scrollRef}
        style={[styles.scrollView, { backgroundColor: theme.card }]}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {log.map((entry) => (
          <ChatBubble key={entry.id} entry={entry} onExplain={onExplain} />
        ))}
        {partialText.length > 0 && (
          <View style={styles.partialCard}>
            <Text style={[styles.partialText, { color: theme.textSecondary }]}>{partialText}</Text>
            {draftTranslated.length > 0 && (
              <Text style={[styles.draftText, { color: theme.primary }]}>{draftTranslated}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {status.length > 0 && (
        <Text style={[styles.status, { color: theme.textSecondary }]}>{status}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  scrollView: {
    flex: 1,
    borderRadius: Radius.medium,
  },
  scrollContent: {
    padding: 14,
  },
  partialCard: {
    gap: 4,
  },
  partialText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  draftText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  status: {
    fontSize: 12.5,
    textAlign: 'center',
  },
});
