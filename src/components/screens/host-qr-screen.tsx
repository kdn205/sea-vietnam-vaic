import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PrimaryButton, GhostButton } from '@/components/ui/buttons';
import { HeaderControls } from '@/components/ui/header-controls';
import { HintBanner } from '@/components/ui/hint-banner';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  host: string;
  port: number;
  peerCount: number;
  onStart: () => void;
  onCancel: () => void;
};

export function HostQrScreen({ host, port, peerCount, onStart, onCancel }: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.container, { backgroundColor: theme.groupedBackground }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onCancel} style={styles.backButton} hitSlop={8}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              tintColor={theme.primary}
              size={22}
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('shareQrTitle')}</Text>
        </View>
        <HeaderControls />
      </View>

      <Text style={[styles.instruction, { color: theme.textSecondary }]}>{t('shareQrInstruction')}</Text>

      <HintBanner icon={{ ios: 'wifi', android: 'wifi', web: 'wifi' }} body={t('makeSureSameWifi')} />

      <View style={[styles.qrCard, { backgroundColor: theme.card }]}>
        <View style={styles.qrBox}>
          <QRCode value={JSON.stringify({ host, port })} size={200} />
        </View>
        <Text style={[styles.address, { color: theme.textSecondary }]}>
          {host}:{port}
        </Text>
        <View style={styles.lockRow}>
          <SymbolView
            name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            tintColor={theme.textSecondary}
            size={13}
          />
          <Text style={[styles.lockText, { color: theme.textSecondary }]}>{t('onlyDiscoverableLan')}</Text>
        </View>
      </View>

      <Text style={[styles.peopleJoined, { color: theme.text }]}>{t('peopleJoined', peerCount)}</Text>

      <View style={styles.buttonGroup}>
        <PrimaryButton label={t('startSession')} onPress={onStart} />
        <GhostButton label={t('cancel')} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  backButton: {
    width: 24,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  qrCard: {
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.large,
    paddingVertical: 20,
    paddingHorizontal: 16,
    ...Shadow.medium,
  },
  qrBox: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  address: {
    fontSize: 13,
    fontWeight: '600',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lockText: {
    fontSize: 12.5,
  },
  peopleJoined: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 10,
    marginTop: 'auto',
  },
});
