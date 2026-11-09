/**
 * Riconoscimento dell'input di Invia e pagamento a Lightning Address (LNURL-pay, LUD-16).
 *
 * Flusso Lightning Address (nome@dominio):
 *  1. GET https://dominio/.well-known/lnurlp/nome  -> limiti min/max e callback
 *  2. GET callback?amount=<msat>                     -> fattura BOLT11 ("pr")
 *  3. la fattura si paga come tutte le altre, dopo aver controllato l'importo.
 */
import {isDemo} from './node';

export type PaymentInput =
  | {kind: 'invoice'; invoice: string}
  | {kind: 'address'; address: string}
  | {kind: 'lnurl'; url: string}
  | {kind: 'unknown'};

// --- bech32 (BIP-173), solo decodifica: serve per i link "lnurl1…" ---
/* eslint-disable no-bitwise -- il checksum bech32 lavora sui bit */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

/** "lnurl1…" -> URL in chiaro; null se la stringa non è un bech32 valido. */
export function decodeLnurl(bech: string): string | null {
  const str = bech.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || str.slice(0, pos) !== 'lnurl') return null;
  const data: number[] = [];
  for (const ch of str.slice(pos + 1)) {
    const v = CHARSET.indexOf(ch);
    if (v < 0) return null;
    data.push(v);
  }
  const hrp = str.slice(0, pos);
  const expanded = [...[...hrp].map(c => c.charCodeAt(0) >> 5), 0, ...[...hrp].map(c => c.charCodeAt(0) & 31)];
  if (data.length < 6 || polymod([...expanded, ...data]) !== 1) return null;
  // da gruppi di 5 bit a byte
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const v of data.slice(0, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(bytes.map(b => '%' + b.toString(16).padStart(2, '0')).join(''));
  } catch {
    return null;
  }
}
/* eslint-enable no-bitwise */

const ADDRESS_RE = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** Capisce cosa ha incollato/scansionato l'utente. */
export function classifyInput(raw: string): PaymentInput {
  let text = raw.trim();

  // QR "bitcoin:...?lightning=lnbc..." (BIP21 unificato): si usa la fattura Lightning.
  if (/^bitcoin:/i.test(text)) {
    const m = text.match(/[?&]lightning=([^&]+)/i);
    if (m) return {kind: 'invoice', invoice: decodeURIComponent(m[1]).toLowerCase()};
    return {kind: 'unknown'};
  }

  text = text.replace(/^lightning:/i, '');

  // LNURL: "lnurl1…" (bech32) oppure "lnurlp://dominio/…" (LUD-17).
  if (/^lnurl1/i.test(text)) {
    const url = decodeLnurl(text);
    return url ? {kind: 'lnurl', url} : {kind: 'unknown'};
  }
  if (/^lnurlp:\/\//i.test(text)) {
    const host = text.slice('lnurlp://'.length);
    const scheme = /\.onion(\/|$)/i.test(host) ? 'http' : 'https';
    return {kind: 'lnurl', url: `${scheme}://${host}`};
  }

  if (ADDRESS_RE.test(text)) return {kind: 'address', address: text.toLowerCase()};
  if (/^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(text)) return {kind: 'invoice', invoice: text.toLowerCase()};
  return {kind: 'unknown'};
}

export type PayRequest = {
  address: string;
  callback: string;
  minSat: number;
  maxSat: number;
  description: string;
};

async function getJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {signal: controller.signal, headers: {Accept: 'application/json'}});
    const json = await res.json();
    if (json?.status === 'ERROR') {
      throw new Error(json.reason || 'Il servizio ha rifiutato la richiesta.');
    }
    if (!res.ok) throw new Error(`Errore del servizio (${res.status}).`);
    return json;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Il servizio dell’indirizzo non risponde.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function descriptionFromMetadata(metadata: string): string {
  try {
    const entries: [string, string][] = JSON.parse(metadata);
    return entries.find(([type]) => type === 'text/plain')?.[1] ?? '';
  } catch {
    return '';
  }
}

/** Passo 1: legge i limiti e la descrizione dell'indirizzo. */
export async function resolveAddress(address: string): Promise<PayRequest> {
  if (isDemo()) {
    await new Promise<void>(r => setTimeout(r, 600));
    return {address, callback: 'demo', minSat: 1, maxSat: 1_000_000, description: `Pagamento a ${address}`};
  }
  const [name, domain] = address.split('@');
  return resolvePayUrl(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`, address);
}

/** Passo 1 per un link LNURL: il destinatario mostrato è il dominio. */
export async function resolveLnurl(url: string): Promise<PayRequest> {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // URL non standard: si mostra così com'è
  }
  if (isDemo()) {
    await new Promise<void>(r => setTimeout(r, 600));
    return {address: host, callback: 'demo', minSat: 1, maxSat: 1_000_000, description: ''};
  }
  if (!/^https:\/\//i.test(url) && !/^http:\/\/[^/]+\.onion(\/|$)/i.test(url)) {
    throw new Error('Link LNURL non sicuro (serve https).');
  }
  return resolvePayUrl(url, host);
}

async function resolvePayUrl(url: string, label: string): Promise<PayRequest> {
  const json = await getJson(url);
  if (json.tag === 'withdrawRequest') {
    throw new Error('Questo QR serve a prelevare, non a pagare: non ancora supportato.');
  }
  if (json.tag !== 'payRequest' || !json.callback) {
    throw new Error('Questo destinatario non accetta pagamenti Lightning.');
  }
  return {
    address: label,
    callback: json.callback,
    minSat: Math.ceil(Number(json.minSendable) / 1000),
    maxSat: Math.floor(Number(json.maxSendable) / 1000),
    description: descriptionFromMetadata(json.metadata ?? ''),
  };
}

/** Passo 2: chiede al servizio una fattura per l'importo scelto. */
export async function fetchInvoice(req: PayRequest, amountSat: number): Promise<string> {
  if (amountSat < req.minSat || amountSat > req.maxSat) {
    throw new Error(`Importo fuori dai limiti: da ${req.minSat} a ${req.maxSat} sat.`);
  }
  if (isDemo()) {
    await new Promise<void>(r => setTimeout(r, 600));
    return `lnbc${amountSat}n1pdemoaddress`;
  }
  const sep = req.callback.includes('?') ? '&' : '?';
  const json = await getJson(`${req.callback}${sep}amount=${amountSat * 1000}`);
  if (!json.pr) throw new Error('Il servizio non ha restituito una fattura.');
  return String(json.pr).toLowerCase();
}
