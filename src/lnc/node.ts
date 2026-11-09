import {EmitterSubscription, NativeEventEmitter, NativeModules} from 'react-native';
import LNC, {snakeKeysToCamel} from '@lightninglabs/lnc-rn';
import {SecureCredentialStore} from './credentialStore';
import * as demo from './demoNode';

/**
 * Unico punto di contatto con il nodo. Le schermate non conoscono LNC:
 * se un domani si aggiunge NWC come alternativa, si cambia solo questo file.
 *
 * Come funziona lnc-rn (verificato sul sorgente 0.3.2-alpha):
 * - connect() non lancia: restituisce una stringa d'errore ('' se ok);
 * - gli stream NON usano callback: subscribe() restituisce il nome del metodo
 *   e i messaggi arrivano come eventi NativeEventEmitter con quel nome,
 *   con il JSON grezzo in event.result (un testo non-JSON è un errore);
 * - le risposte usano camelCase e gli int64 sono stringhe.
 */

let lnc: LNC | null = null;

/** Modalità demo: nodo fittizio, per vedere l'app senza un nodo vero. */
let demoMode = false;
export function startDemo() {
  disconnect();
  demoMode = true;
}
export function isDemo() {
  return demoMode;
}
let emitter: NativeEventEmitter | null = null;

const CONNECT_TIMEOUT_MS = 45_000;

function events(): NativeEventEmitter {
  if (!emitter) {
    emitter = new NativeEventEmitter(NativeModules.LncModule);
  }
  return emitter;
}

async function isUp(client: LNC): Promise<boolean> {
  try {
    return !!(await client.isConnected());
  } catch {
    return false;
  }
}

export async function connect(store: SecureCredentialStore): Promise<void> {
  if (demoMode) return demo.connect();
  if (lnc && (await isUp(lnc))) {
    return;
  }
  // Con un credentialStore personalizzato lnc-rn ignora serverHost del config:
  // il default lo garantisce lo store stesso.
  if (lnc && lnc.credentials === store) {
    // Connessione caduta (es. iOS l'ha chiusa in background): chiusura pulita
    // prima di riaprirla, così il client Go non resta a metà handshake.
    try {
      lnc.disconnect();
    } catch {
      // già chiusa
    }
  } else {
    lnc = new LNC({credentialStore: store});
  }

  const error = await lnc.connect();
  if (error) {
    throw new Error(connectErrorText(String(error)));
  }

  const start = Date.now();
  let lastStatus = '';
  while (!(await isUp(lnc))) {
    lastStatus = await statusOf(lnc);
    // Il client Go riporta subito errori definitivi (sessione inesistente o
    // scaduta): inutile aspettare tutto il timeout.
    if (/not found|expired|revoked/i.test(lastStatus)) {
      throw new Error(connectErrorText(lastStatus));
    }
    if (Date.now() - start > CONNECT_TIMEOUT_MS) {
      throw new Error(
        'Il nodo non risponde. Controlla che Lightning Terminal sia attivo' +
          (lastStatus ? ` (stato: ${lastStatus}).` : '.'),
      );
    }
    await new Promise<void>(r => setTimeout(r, 300));
  }
}

async function statusOf(client: LNC): Promise<string> {
  try {
    return String((await client.status()) ?? '');
  } catch {
    return '';
  }
}

function connectErrorText(raw: string): string {
  if (/expired/i.test(raw)) {
    return 'La sessione LNC è scaduta. Creane una nuova in Lightning Terminal.';
  }
  if (/not found|revoked/i.test(raw)) {
    return `Sessione non trovata: la frase è già stata usata o la sessione è stata revocata. Creane una nuova. (${raw})`;
  }
  if (/pairing|phrase|mnemonic/i.test(raw)) {
    return `Frase di abbinamento non valida o già usata. (${raw})`;
  }
  return `Collegamento non riuscito: ${raw}`;
}

export async function isConnected(): Promise<boolean> {
  return demoMode || (!!lnc && (await isUp(lnc)));
}

export function disconnect() {
  demoMode = false;
  try {
    lnc?.disconnect();
  } finally {
    lnc = null;
  }
}

function api() {
  if (!lnc) {
    throw new Error('Nodo non collegato');
  }
  return lnc.lnd;
}

/** Saldo spendibile in Lightning (lato locale dei canali), in sat. */
export async function getBalanceSat(): Promise<number> {
  if (demoMode) return demo.getBalanceSat();
  const res: any = await api().lightning.channelBalance({});
  return Number(res?.localBalance?.sat ?? 0);
}

export type DecodedInvoice = {
  paymentRequest: string;
  paymentHash: string; // hex
  amountSat: number; // 0 = importo libero
  description: string;
  expiresAt: number; // ms epoch
};

export function normalizeInvoice(input: string): string {
  return input.trim().replace(/^lightning:/i, '').toLowerCase();
}

/** Legge un importo digitato: tiene solo le cifre. */
export function parseAmount(text: string): number {
  return Number(text.replace(/\D/g, '')) || 0;
}

export async function decodeInvoice(raw: string): Promise<DecodedInvoice> {
  const paymentRequest = normalizeInvoice(raw);
  if (!paymentRequest.startsWith('ln')) {
    throw new Error('Questo non è una fattura Lightning.');
  }
  if (demoMode) return demo.decodeInvoice(paymentRequest);
  const res: any = await api().lightning.decodePayReq({payReq: paymentRequest});
  return {
    paymentRequest,
    paymentHash: String(res.paymentHash ?? ''),
    amountSat: Number(res.numSatoshis ?? 0),
    description: res.description ?? '',
    expiresAt: (Number(res.timestamp) + Number(res.expiry)) * 1000,
  };
}

/**
 * Politica di invio: commissioni libere e massima frammentazione (MPP),
 * per avere la massima probabilità che il pagamento vada a buon fine.
 *
 * Attenzione: in LND feeLimitSat = 0 significa "solo route a commissione zero",
 * quindi "fee libere" si ottiene con un tetto molto alto, non con 0.
 */
const FEE_LIMIT_SAT = '100000000'; // 1 BTC: in pratica nessun limite
const MAX_PARTS = 128; // frammenti massimi per pagamento (default RPC di LND: 1)
/**
 * Tempo massimo in cui LND continua a provare strade e frazionamenti.
 * Per i pagamenti grossi serve più tempo: più parti, più tentativi.
 */
export type PayMode = 'normal' | 'big';
export const PAYMENT_TIMEOUT_S: Record<PayMode, number> = {normal: 60, big: 300};

const SEND_EVENT = 'routerrpc.Router.SendPaymentV2';

export type PayResult = {feeSat: number};

let paying = false;

export function payInvoice(
  inv: DecodedInvoice,
  amountSat: number,
  mode: PayMode = 'normal',
): Promise<PayResult> {
  if (demoMode) return demo.payInvoice(inv, amountSat);
  const timeoutS = PAYMENT_TIMEOUT_S[mode];
  if (paying) {
    return Promise.reject(new Error('C’è già un pagamento in corso.'));
  }
  return new Promise((resolve, reject) => {
    const request: any = {
      paymentRequest: inv.paymentRequest,
      timeoutSeconds: timeoutS,
      feeLimitSat: FEE_LIMIT_SAT,
      maxParts: MAX_PARTS,
      noInflightUpdates: true,
    };
    if (inv.amountSat === 0) {
      request.amt = String(amountSat);
    }

    let sub: EmitterSubscription | null = null;
    let done = false;
    paying = true;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      sub?.remove();
      sub = null;
      paying = false;
      fn();
    };

    // Se la connessione cade a metà (es. app in background) lo stream non risponde più:
    // non diciamo "fallito", perché il pagamento potrebbe essere andato a buon fine.
    // Riprovare è sicuro: LND non paga due volte la stessa fattura.
    const guard = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            'Nessuna risposta dal nodo: il pagamento potrebbe essere andato a buon fine. Controlla il saldo prima di riprovare.',
          ),
        ),
      );
    }, (timeoutS + 30) * 1000);

    // Tutti gli eventi SendPaymentV2 arrivano con lo stesso nome:
    // filtriamo per paymentHash.
    sub = events().addListener(SEND_EVENT, (event: any) => {
      let p: any;
      try {
        p = snakeKeysToCamel(JSON.parse(event.result));
      } catch {
        finish(() => reject(new Error(String(event.result || 'Pagamento non riuscito.'))));
        return;
      }
      if (inv.paymentHash && p.paymentHash && p.paymentHash !== inv.paymentHash) {
        return;
      }
      if (p.status === 'SUCCEEDED') {
        finish(() => resolve({feeSat: Number(p.feeSat ?? 0)}));
      } else if (p.status === 'FAILED') {
        finish(() => reject(new Error(failureText(p.failureReason))));
      }
    });

    try {
      api().router.sendPaymentV2(request);
    } catch (e: any) {
      finish(() => reject(e));
    }
  });
}

function failureText(reason: string): string {
  switch (reason) {
    case 'FAILURE_REASON_NO_ROUTE':
      return 'Nessun percorso trovato. Riprova tra poco.';
    case 'FAILURE_REASON_INSUFFICIENT_BALANCE':
      return 'Saldo insufficiente nei canali.';
    case 'FAILURE_REASON_TIMEOUT':
      return 'Tempo scaduto: il pagamento non è partito, puoi riprovare.';
    case 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS':
      return 'Fattura non valida o già pagata.';
    default:
      return 'Pagamento non riuscito.';
  }
}

export type CreatedInvoice = {paymentRequest: string; rHash: string};

export async function createInvoice(amountSat: number, memo: string): Promise<CreatedInvoice> {
  if (demoMode) return demo.createInvoice(amountSat);
  const res: any = await api().lightning.addInvoice({
    value: String(amountSat),
    memo,
    expiry: '3600',
  });
  return {paymentRequest: res.paymentRequest, rHash: res.rHash};
}

/**
 * Chiama onSettled quando la fattura viene pagata. Usa il polling di
 * lookupInvoice invece di uno stream: gli stream di lnc-rn non si possono
 * chiudere singolarmente e muoiono quando iOS sospende la connessione.
 * Restituisce la funzione per smettere di controllare.
 */
export function watchInvoice(inv: CreatedInvoice, onSettled: (sat: number) => void): () => void {
  if (demoMode) return demo.watchInvoice(inv, onSettled);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const res: any = await api().lightning.lookupInvoice({rHash: inv.rHash} as any);
      if (!stopped && res?.state === 'SETTLED') {
        stopped = true;
        onSettled(Number(res.amtPaidSat ?? res.value ?? 0));
        return;
      }
    } catch {
      // nodo momentaneamente irraggiungibile: si riprova al giro dopo
    }
    if (!stopped) timer = setTimeout(tick, 2000);
  };
  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
