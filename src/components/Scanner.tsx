import React, {useEffect} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {
  Camera,
  ScannedObjectType,
  isScannedCode,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
} from 'react-native-vision-camera';
import {Button, TextLink, colors, type} from './ui';

// Costante fuori dal componente: useObjectOutput ricrea l'output se cambia l'array.
const QR_TYPES: ScannedObjectType[] = ['qr'];

/** Fotocamera a tutto schermo per leggere un QR (fatture e abbinamento). */
export function Scanner({
  busy,
  hint = 'Inquadra il QR di una fattura o di un indirizzo',
  onScanned,
  onCancel,
}: {
  busy: boolean;
  hint?: string;
  onScanned: (value: string) => void;
  onCancel: () => void;
}) {
  const device = useCameraDevice('back');
  const {hasPermission, canRequestPermission, requestPermission} = useCameraPermission();

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const qrOutput = useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: objects => {
      const code = objects.find(isScannedCode);
      if (code?.value) onScanned(code.value);
    },
  });

  let message = '';
  if (!hasPermission) {
    message = canRequestPermission
      ? 'Consenti l’accesso alla fotocamera per leggere il QR.'
      : 'L’accesso alla fotocamera è disattivato. Abilitalo nelle Impostazioni.';
  } else if (!device) {
    message = 'Fotocamera non disponibile su questo dispositivo.';
  }

  return (
    <View style={s.fill}>
      <View style={s.camera}>
        {!message && device ? (
          <>
            <Camera style={StyleSheet.absoluteFill} device={device} isActive={!busy} outputs={[qrOutput]} />
            <View style={s.viewfinder} pointerEvents="none" />
          </>
        ) : (
          <View style={{alignItems: 'center', gap: 16, padding: 24}}>
            <Text style={[type.body, {color: colors.muted, textAlign: 'center'}]}>{message}</Text>
            {hasPermission || canRequestPermission ? null : (
              <TextLink label="Apri Impostazioni" onPress={() => Linking.openSettings()} />
            )}
          </View>
        )}
      </View>
      <Text style={[type.small, {color: colors.muted, textAlign: 'center'}]}>
        {busy ? 'Lettura in corso…' : hint}
      </Text>
      <View style={s.row}>
        <Button label="Annulla" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: {flex: 1, gap: 16},
  row: {flexDirection: 'row', gap: 12, alignSelf: 'stretch'},
  camera: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
});
