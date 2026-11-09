import {TargetBarcodeFormat, useBarcodeScannerOutput} from 'react-native-vision-camera-barcode-scanner';
import type {QrOutputHook} from './useQrOutput';

// Costante fuori dal hook: l'output viene ricreato se cambia l'array.
const QR_FORMATS: TargetBarcodeFormat[] = ['qr-code'];

/** Android: VisionCamera non ha un lettore nativo, si usa Google ML Kit. */
export const useQrOutput: QrOutputHook = onScanned =>
  useBarcodeScannerOutput({
    barcodeFormats: QR_FORMATS,
    onBarcodeScanned: barcodes => {
      const value = barcodes.find(b => b.rawValue)?.rawValue;
      if (value) onScanned(value);
    },
    onError: () => {
      // un fotogramma non letto: si riprova con il successivo
    },
  });
