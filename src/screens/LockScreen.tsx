import React from 'react';
import {StyleSheet, View} from 'react-native';
import {BrandMark, Button, LinkState, StatusLine, colors} from '../components/ui';
import type {BiometryKind} from 'telecomando-biometrics';

type Props = {
  /** true mentre è aperto il riquadro di Face ID: niente pulsante, solo attesa. */
  prompting: boolean;
  kind: BiometryKind;
  link: LinkState;
  onUnlock: () => void;
};

const LABEL: Record<BiometryKind, string> = {
  faceID: 'Sblocca con Face ID',
  touchID: 'Sblocca con Touch ID',
  opticID: 'Sblocca con Optic ID',
  biometric: 'Sblocca',
  passcode: 'Sblocca con il codice',
  none: 'Sblocca',
};

/**
 * Copre l'app finché il volto non è riconosciuto. Intanto il collegamento al
 * nodo prosegue sotto: la riga di stato mostra che sta già lavorando.
 */
export function LockScreen({prompting, kind, link, onUnlock}: Props) {
  return (
    <View style={s.root}>
      {/* Stesso logo dell'avvio di iOS, nello stesso punto: il passaggio non si vede. */}
      <BrandMark />
      <View style={s.center}>{prompting ? null : <StatusLine state={link} />}</View>
      {/* Con il riquadro aperto resta solo lo spazio del pulsante: il vetro non si rende trasparente, si toglie. */}
      <View style={s.row}>{prompting ? null : <Button label={LABEL[kind]} variant="secondary" onPress={onUnlock} />}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {...StyleSheet.absoluteFill, backgroundColor: colors.bg, padding: 24, paddingBottom: 56},
  center: {flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24},
  row: {flexDirection: 'row', height: 58},
});
