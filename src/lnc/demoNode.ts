/**
 * Nodo fittizio per vedere l'app senza un nodo vero (solo in sviluppo).
 * Stessa forma delle funzioni di node.ts; i dati sono inventati e restano in memoria.
 */
import type {CreatedInvoice, DecodedInvoice, PayResult} from './node';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

let balanceSat = 1_234_567;

export async function connect() {
  await wait(1500); // simula l'handshake LNC
}

export async function getBalanceSat() {
  await wait(300);
  return balanceSat;
}

export async function decodeInvoice(paymentRequest: string): Promise<DecodedInvoice> {
  await wait(400);
  // "lnbc0…" = fattura senza importo, così si vede anche il campo importo libero;
  // "lnbc<n>n1…" = fattura da n sat (usata dalla demo dei Lightning Address).
  const free = paymentRequest.startsWith('lnbc0');
  const fixed = paymentRequest.match(/^lnbc(\d+)n1/);
  return {
    paymentRequest,
    paymentHash: 'demo',
    amountSat: fixed ? Number(fixed[1]) : free ? 0 : 21_000,
    description: fixed ? '' : free ? '' : 'Caffè e cornetto',
    expiresAt: Date.now() + 3600_000,
  };
}

export async function payInvoice(_inv: DecodedInvoice, amountSat: number): Promise<PayResult> {
  await wait(2000);
  const feeSat = Math.max(1, Math.round(amountSat * 0.0003));
  if (amountSat + feeSat > balanceSat) {
    throw new Error('Saldo insufficiente nei canali.');
  }
  balanceSat -= amountSat + feeSat;
  return {feeSat};
}

export async function createInvoice(amountSat: number): Promise<CreatedInvoice> {
  await wait(500);
  const filler = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(8);
  return {
    paymentRequest: `lnbc${amountSat}n1pdemo${filler}`,
    rHash: 'demo',
  };
}

/** Nella demo la fattura risulta pagata dopo 6 secondi. */
export function watchInvoice(inv: CreatedInvoice, onSettled: (sat: number) => void): () => void {
  const amount = Number(inv.paymentRequest.match(/^lnbc(\d+)n/)?.[1] ?? 0);
  const timer = setTimeout(() => {
    balanceSat += amount;
    onSettled(amount);
  }, 6000);
  return () => clearTimeout(timer);
}
