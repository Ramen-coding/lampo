import {NativeModules} from 'react-native';

export type BiometryKind = 'faceID' | 'touchID' | 'opticID' | 'passcode' | 'none';
export type AuthResult = 'ok' | 'cancel' | 'unavailable' | 'failed';

const native = NativeModules.Biometrics as
  | {kind(): Promise<BiometryKind>; authenticate(reason: string): Promise<AuthResult>}
  | undefined;

export function biometryKind(): Promise<BiometryKind> {
  return native ? native.kind() : Promise.resolve('none');
}

export function authenticate(reason: string): Promise<AuthResult> {
  return native ? native.authenticate(reason) : Promise.resolve('unavailable');
}
