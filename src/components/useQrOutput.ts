import type {CameraOutput} from 'react-native-vision-camera';

/**
 * Output della fotocamera che legge i QR. Metro sceglie la versione per piattaforma
 * (useQrOutput.ios.ts / useQrOutput.android.ts); questo file dà solo il tipo a TypeScript.
 */
export type QrOutputHook = (onScanned: (value: string) => void) => CameraOutput;

export declare const useQrOutput: QrOutputHook;
