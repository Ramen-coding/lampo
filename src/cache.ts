import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * Il saldo dell'ultima sessione viene mostrato subito all'apertura,
 * mentre LNC si ricollega in background: niente schermata d'attesa.
 */
const KEY = 'cached_balance_v1';

export type CachedBalance = {sat: number; at: number};

export async function readCachedBalance(): Promise<CachedBalance | null> {
  try {
    const raw = await EncryptedStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCachedBalance(sat: number) {
  const value: CachedBalance = {sat, at: Date.now()};
  EncryptedStorage.setItem(KEY, JSON.stringify(value)).catch(() => {});
}

export function clearCache() {
  return EncryptedStorage.removeItem(KEY).catch(() => {});
}

/** 1234567 -> "1.234.567" senza dipendere da Intl (Hermes). */
export function formatSat(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
