import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { HintBanner } from '@/components/ui/hint-banner';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { GradientSpark } from '@/components/ui/gradient-spark';
import { HeaderControls } from '@/components/ui/header-controls';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  nameInput: string;
  onNameChange: (name: string) => void;
  onJoinQr: () => void;
  onPresenter: () => void;
  onSolo: () => void;
  statusMessage?: string;
};

export function WelcomeScreen({
  nameInput,
  onNameChange,
  onJoinQr,
  onPresenter,
  onSolo,
  statusMessage,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <HeaderControls style={styles.headerControls} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.hero}>
        <View style={styles.logoStack}>
          <View style={[styles.logoHalo, { backgroundColor: theme.primarySoft }]} />
          <GradientSpark size={48} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{t('welcomeTitle')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('welcomeSubtitle')}</Text>
      </View>

      <HintBanner
        icon={{ ios: 'wifi', android: 'wifi', web: 'wifi' }}
        title={t('sameWifiTitle')}
        body={t('sameWifiBody')}
        trailingIcon={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
      />

      <TextInput
        style={[styles.nameInput, { backgroundColor: theme.card, color: theme.text }]}
        value={nameInput}
        onChangeText={onNameChange}
        placeholder={t('displayName')}
        placeholderTextColor={theme.textSecondary}
      />

      <View style={styles.buttonGroup}>
        <PrimaryButton
          label={t('joinWithQr')}
          onPress={onJoinQr}
          icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>{t('or')}</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <SecondaryButton
          label={t('imPresenter')}
          onPress={onPresenter}
          icon={{ ios: 'person.wave.2.fill', android: 'record_voice_over', web: 'record_voice_over' }}
        />
      </View>

      <GhostButton label={t('soloMode')} onPress={onSolo} style={styles.soloButton} />

      {statusMessage ? (
        <Text style={[styles.status, { color: theme.textSecondary }]}>{statusMessage}</Text>
      ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  logoStack: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  nameInput: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 15,
  },
  buttonGroup: {
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
  },
  soloButton: {
    alignSelf: 'center',
  },
  status: {
    fontSize: 13,
    textAlign: 'center',
  },
  headerControls: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
  },
});
