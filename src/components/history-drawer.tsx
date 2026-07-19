import { useEffect, useState } from 'react';
import { Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { SessionCard, type HistorySession } from '@/components/session-card';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import type { StoredSession } from '@/lib/history-storage';

type HistoryTab = 'saved' | 'summary';

type Props = {
  visible: boolean;
  sessions: StoredSession[];
  onClose: () => void;
  onDelete: (sessionId: string) => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${period}`;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDuration(ms: number, inProgressLabel: string) {
  if (ms <= 0) return inProgressLabel;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function toHistorySession(s: StoredSession, inProgressLabel: string, untitledLabel: string): HistorySession {
  const first = s.entries[0];
  const langPair = first ? `${first.sourceLang.toUpperCase()} → ${first.targetLang.toUpperCase()}` : '—';
  const speakerCount = new Set(s.entries.map((e) => e.speaker)).size;
  const duration = s.endedAt ? formatDuration(s.endedAt - s.startedAt, inProgressLabel) : inProgressLabel;
  const now = new Date();
  const startedAt = new Date(s.startedAt);
  const time = isSameDay(now, startedAt) ? formatTime(s.startedAt) : formatDate(s.startedAt);
  return {
    id: s.id,
    title: first?.source.slice(0, 60) || untitledLabel,
    time,
    langPair,
    peopleCount: Math.max(1, speakerCount),
    duration,
  };
}

/** ChatGPT-style left drawer: list of past sessions, tap one to view its transcript + summary. */
export function HistoryDrawer({ visible, sessions, onClose, onDelete }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const [translateX] = useState(() => new Animated.Value(-DRAWER_WIDTH));
  const [selected, setSelected] = useState<StoredSession | null>(null);
  const [tab, setTab] = useState<HistoryTab>('saved');

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (!visible) setSelected(null);
  }, [visible]);

  const visibleSessions = sessions.filter((s) => (tab === 'summary' ? !!s.summary : !s.summary));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {visible && <TouchableOpacity style={styles.scrim} onPress={onClose} activeOpacity={1} />}
      <Animated.View style={[styles.drawer, { backgroundColor: theme.groupedBackground, transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: theme.text }]}>{t('history')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.card }]}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.textSecondary} size={15} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabsWrap}>
          <SegmentedTabs
            options={[
              { value: 'saved', label: t('historyTabSaved') },
              { value: 'summary', label: t('historyTabSummary') },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {visibleSessions.length === 0 && (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {tab === 'summary' ? t('noSummarySessionsYet') : t('noSessionsYet')}
          </Text>
        )}

        <ScrollView style={styles.body}>
          {visibleSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={toHistorySession(s, t('inProgress'), t('untitledSession'))}
              onPress={() => setSelected(s)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailScrim}>
          <View style={[styles.detailBox, { backgroundColor: theme.card }]}>
            <View style={styles.detailHandle}>
              <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
            </View>
            <View style={styles.detailHeader}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>
                {selected ? formatDate(selected.startedAt) : ''}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.groupedBackground }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.textSecondary} size={15} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {selected?.summary ? (
                <View style={[styles.summaryBox, { backgroundColor: theme.primarySoft }]}>
                  <Text style={{ color: theme.primary, fontWeight: '700', marginBottom: 4 }}>{t('summary')}</Text>
                  <Text style={{ color: theme.text, fontSize: 13.5, lineHeight: 20 }}>{selected.summary}</Text>
                </View>
              ) : null}
              {selected?.entries.map((e) => (
                <View key={e.id} style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: e.speaker === 'Host' ? theme.speakerHost : theme.speakerGuest,
                      marginBottom: 2,
                    }}
                  >
                    {e.speaker}
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.text }}>
                    {e.sourceLang.toUpperCase()}: {e.source}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>
                    {e.targetLang.toUpperCase()}: {e.translated}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  body: {
    flex: 1,
    padding: 16,
    paddingTop: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  detailScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailBox: {
    maxHeight: '80%',
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    padding: 20,
  },
  detailHandle: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryBox: {
    borderRadius: Radius.medium,
    padding: 14,
    marginBottom: 16,
  },
});
