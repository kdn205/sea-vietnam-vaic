import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/ui/buttons';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  visible: boolean;
  /** 'self' - the user tapped back/leave themselves. 'disconnected' - the host ended the
   * meeting (or the connection dropped) and this device is being kicked out. */
  reason: 'self' | 'disconnected';
  saveAsSummary: boolean;
  onToggleSaveAsSummary: (value: boolean) => void;
  summaryAvailable: boolean;
  /** Gemini isn't configured yet - tapping the summary option should open its setup popup
   * instead of toggling the (still off) checkbox. */
  onRequestGeminiSetup: () => void;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function EndSessionModal({
  visible,
  reason,
  saveAsSummary,
  onToggleSaveAsSummary,
  summaryAvailable,
  onRequestGeminiSetup,
  saving,
  onDiscard,
  onSave,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  const handleToggleSummary = () => {
    if (!summaryAvailable) {
      onRequestGeminiSetup();
      return;
    }
    onToggleSaveAsSummary(!saveAsSummary);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.scrim}>
        <View style={[styles.box, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            {reason === 'self' ? t('endSessionTitleSelf') : t('endSessionTitleDisconnected')}
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {reason === 'self' ? t('endSessionBodySelf') : t('endSessionBodyDisconnected')}
          </Text>

          <Pressable
            style={[styles.summaryRow, { backgroundColor: theme.groupedBackground }]}
            onPress={handleToggleSummary}
            disabled={saving}
          >
            <Switch
              value={saveAsSummary && summaryAvailable}
              onValueChange={handleToggleSummary}
              disabled={saving}
            />
            <Text
              style={[
                styles.summaryLabel,
                { color: summaryAvailable ? theme.text : theme.textSecondary },
              ]}
            >
              {t('saveAsSummaryOption')}
            </Text>
          </Pressable>
          {!summaryAvailable && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>{t('saveAsSummaryDisabledHint')}</Text>
          )}

          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.savingText, { color: theme.textSecondary }]}>{t('savingSummary')}</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <GhostButton label={t('discardHistory')} onPress={onDiscard} style={{ flex: 1 }} />
              <PrimaryButton label={t('save')} onPress={onSave} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    borderRadius: Radius.large,
    padding: 20,
    ...Shadow.large,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    borderRadius: Radius.medium,
    padding: 10,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: -6,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  savingText: {
    fontSize: 13.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
