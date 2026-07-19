import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ChatBubble } from '@/components/chat-bubble';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Radius, Shadow } from '@/constants/theme';
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
  /** Pending speak requests waiting on this (host) device - shown as a badge on the Participants tab. */
  pendingRequestCount?: number;
};

// How close to the bottom (px) still counts as "at the bottom" for auto-scroll purposes.
const BOTTOM_THRESHOLD = 48;

export function SessionChatScreen({
  sessionTab,
  onChangeSessionTab,
  log,
  partialText,
  draftTranslated,
  status,
  pendingRequestCount = 0,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevLogLengthRef = useRef(log.length);
  const isAtBottomRef = useRef(true);
  isAtBottomRef.current = isAtBottom;

  // Only counts newly-finalized entries (not partial/draft updates) toward the "N new
  // messages" pill, and only while the user has scrolled away from the live position.
  useEffect(() => {
    const grew = log.length - prevLogLengthRef.current;
    prevLogLengthRef.current = log.length;
    if (grew > 0 && !isAtBottomRef.current) {
      setNewMessageCount((c) => c + grew);
    }
  }, [log.length]);

  const scrollToLatest = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setIsAtBottom(true);
    setNewMessageCount(0);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distanceFromBottom < BOTTOM_THRESHOLD;
    setIsAtBottom(atBottom);
    if (atBottom) setNewMessageCount(0);
  };

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

      <View style={styles.scrollWrap}>
        <ScrollView
          ref={scrollRef}
          style={[styles.scrollView, { backgroundColor: theme.card }]}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            // Only chases new content while the user is already at the live position - once
            // they've scrolled up to read back, stop yanking the view out from under them.
            if (isAtBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {log.map((entry) => (
            <ChatBubble key={entry.id} entry={entry} />
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

        {!isAtBottom && (
          <View style={styles.jumpToLatestWrap}>
            <Pressable
              style={[styles.jumpToLatestButton, { backgroundColor: theme.primaryPressed }]}
              onPress={scrollToLatest}
              accessibilityLabel={t('scrollToLatest')}
            >
              <SymbolView
                name={{ ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }}
                tintColor="#FFFFFF"
                size={13}
              />
              {newMessageCount > 0 && (
                <Text style={styles.jumpToLatestLabel}>{t('newMessages', newMessageCount)}</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

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
  scrollWrap: {
    flex: 1,
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
  jumpToLatestWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  jumpToLatestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    ...Shadow.medium,
  },
  jumpToLatestLabel: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
