import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { HeaderControls } from '@/components/ui/header-controls';
import { HintBanner } from '@/components/ui/hint-banner';
import { Radius, Shadow } from '@/constants/theme';
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
    <View style={{ flex: 1, backgroundColor: theme.groupedBackground }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.toolbar}>
          <HeaderControls />
        </View>

        <View style={styles.hero}>
          <Text style={[styles.title, { color: theme.text }]}>{t('welcomeTitle')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('welcomeSubtitle')}</Text>
        </View>

        <HintBanner
          icon={{ ios: 'wifi', android: 'wifi', web: 'wifi' }}
          title={t('sameWifiTitle')}
          body={t('sameWifiBody')}
          trailingIcon={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
        />

        <View style={[styles.inputRow, { backgroundColor: theme.card }]}>
          <SymbolView
            name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            tintColor={theme.textSecondary}
            size={20}
          />
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            value={nameInput}
            onChangeText={onNameChange}
            placeholder={t('displayName')}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.buttonGroup}>
          <PrimaryButton
            label={t('joinWithQr')}
            onPress={onJoinQr}
            icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
          />
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
    paddingTop: 8,
    gap: 14,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  hero: {
    gap: 4,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.36,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 21,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.medium,
    paddingHorizontal: 14,
    height: 50,
    ...Shadow.small,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  buttonGroup: {
    gap: 10,
    marginTop: 4,
  },
  soloButton: {
    alignSelf: 'center',
    marginTop: 2,
  },
  status: {
    fontSize: 13,
    textAlign: 'center',
  },
});
