import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * Cambio BTC/EUR per mostrare il saldo in euro.
 * Fonte: mempool.space (nessun account, riceve solo la richiesta del prezzo, mai il saldo).
 * L'ultimo prezzo resta salvato: offline si usa quello, indicandone l'ora.
 */
const PRICE_KEY = 'btc_eur_v1';
const UNIT_KEY = 'balance_unit_v1';
const PRICE_URL = 'https://mempool.space/api/v1/prices';
/** Sotto questa età il prezzo non viene richiesto di nuovo. */
const FRESH_MS = 60_000;

export type Unit = 'sat' | 'eur';
export type Price = {eur: number; at: number};

let memo: Price | null = null;
let inFlight: Promise<Price | null> | null = null;

export async function readCachedPrice(): Promise<Price | null> {
  if (memo) return memo;
  try {
    const raw = await EncryptedStorage.getItem(PRICE_KEY);
    memo = raw ? JSON.parse(raw) : null;
  } catch {
    memo = null;
  }
  return memo;
}

/** Prezzo aggiornato, oppure l'ultimo salvato se la rete non risponde. Una sola richiesta alla volta. */
export function fetchPrice(): Promise<Price | null> {
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function load(): Promise<Price | null> {
  const cached = await readCachedPrice();
  if (cached && Date.now() - cached.at < FRESH_MS) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(PRICE_URL, {signal: controller.signal, headers: {Accept: 'application/json'}});
    const eur = Number((await res.json())?.EUR);
    if (!res.ok || !(eur > 0)) return cached;
    memo = {eur, at: Date.now()};
    EncryptedStorage.setItem(PRICE_KEY, JSON.stringify(memo)).catch(() => {});
    return memo;
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

export async function readUnit(): Promise<Unit> {
  try {
    return (await EncryptedStorage.getItem(UNIT_KEY)) === 'eur' ? 'eur' : 'sat';
  } catch {
    return 'sat';
  }
}

export function writeUnit(unit: Unit) {
  EncryptedStorage.setItem(UNIT_KEY, unit).catch(() => {});
}

export function satToEur(sat: number, price: Price): number {
  return (sat / 1e8) * price.eur;
}

/** 1234.5 -> "1.234,50" senza dipendere da Intl (Hermes). */
export function formatEur(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
