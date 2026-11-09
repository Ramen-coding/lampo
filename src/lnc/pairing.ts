/**
 * Legge i dati di abbinamento LNC da testo incollato o da un QR.
 *
 * Accetta:
 * - la frase di 10 parole (con a capo, numeri d'elenco o punteggiatura);
 * - "frase||mailbox.host:443" (frase con mailbox server personalizzato);
 * - link di Lightning Terminal con la frase in base64 dopo "/pair/";
 * - JSON con pairingPhrase / mailboxServerAddr.
 */
// Hermes (React Native ≥ 0.74) espone atob, ma i tipi di RN non lo dichiarano.
declare function atob(data: string): string;

export type PairingData = {phrase: string; serverHost: string};

export const PHRASE_WORDS = 10;

/** Parole in minuscolo, senza numeri o punteggiatura. */
export function phraseWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function fromPlain(text: string): PairingData | null {
  const [phrasePart, hostPart = ''] = text.split('||');
  const words = phraseWords(phrasePart);
  if (words.length !== PHRASE_WORDS) return null;
  return {phrase: words.join(' '), serverHost: hostPart.trim()};
}

function decodeBase64(b64: string): string | null {
  try {
    const std = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

export function parsePairing(raw: string): PairingData | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const j = JSON.parse(text);
      const phrase = j.pairingPhrase ?? j.pairing_phrase ?? j.pairingSecretMnemonic ?? j.pairing_secret_mnemonic;
      if (typeof phrase === 'string') {
        const res = fromPlain(phrase);
        const host = j.mailboxServerAddr ?? j.mailbox_server_addr ?? j.serverHost ?? '';
        return res && {...res, serverHost: String(host).trim()};
      }
    } catch {
      // non è JSON: si prova sotto
    }
  }

  const pairAt = text.lastIndexOf('/pair/');
  if (pairAt >= 0) {
    const encoded = decodeURIComponent(text.slice(pairAt + 6).split(/[?#&]/)[0]);
    const decoded = decodeBase64(encoded);
    if (decoded) {
      const res = fromPlain(decoded);
      if (res) return res;
    }
    return fromPlain(encoded);
  }

  return fromPlain(text);
}
