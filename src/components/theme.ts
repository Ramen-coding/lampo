import {Platform} from 'react-native';

export const isAndroid = Platform.OS === 'android';

/** iOS: tema AMOLED con il vetro di sistema (nero puro, superfici traslucide). */
const ios = {
  bg: '#000000', // sfondo
  panel: '#0E0E0E', // superfici (campi, pulsanti secondari)
  surface: 'rgba(44,44,46,0.72)', // vetro finto (solo iPhone senza Liquid Glass)
  line: '#262626', // bordi
  fill: 'rgba(255,255,255,0.10)', // ovali dentro il vetro (Ricevi, QR)
  onFill: '#FFFFFF',
  field: 'rgba(255,255,255,0.06)', // campi di testo
  hairline: 'rgba(255,255,255,0.14)',
  ripple: 'transparent',
  text: '#FFFFFF',
  muted: '#8E8E93',
  amber: '#F7931A', // arancio bitcoin: solo per l'azione principale
  onAmber: '#000000',
  green: '#30D158',
  red: '#FF453A',
};

/**
 * Android: schema scuro Material 3 (Material You) generato dall'arancio bitcoin.
 * Lo sfondo resta nero AMOLED; le superfici sono tinte piene e calde, una sopra
 * l'altra per tono (surface container → high → tonal), senza trasparenze né bordi.
 */
const android: typeof ios = {
  bg: '#000000',
  panel: '#1C1713', // surfaceContainer
  surface: '#221C18', // surfaceContainerHigh: barra, bolla del saldo, chip
  line: '#3A302A', // outlineVariant
  fill: '#4A3A2E', // secondaryContainer: pulsanti tonali (Ricevi, QR, Chiudi)
  onFill: '#FFDCC5', // onSecondaryContainer
  field: '#2B241F', // surfaceContainerHighest: campi pieni
  hairline: 'transparent',
  ripple: 'rgba(255,220,197,0.16)',
  text: '#F0DFD5', // onSurface, bianco caldo
  muted: '#B8A598', // onSurfaceVariant
  amber: '#F7931A', // primary: l'azione principale resta arancio bitcoin
  onAmber: '#2E1500', // onPrimary
  green: '#7BD88F',
  red: '#FFB4AB', // error
};

export const colors = isAndroid ? android : ios;
