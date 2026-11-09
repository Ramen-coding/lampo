import {ScannedObjectType, isScannedCode, useObjectOutput} from 'react-native-vision-camera';
import type {QrOutputHook} from './useQrOutput';

// Costante fuori dal hook: useObjectOutput ricrea l'output se cambia l'array.
const QR_TYPES: ScannedObjectType[] = ['qr'];

/** iOS: lettura QR nativa di AVFoundation (veloce, nessuna libreria in più). */
export const useQrOutput: QrOutputHook = onScanned =>
  useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: objects => {
      const code = objects.find(isScannedCode);
      if (code?.value) onScanned(code.value);
    },
  });
