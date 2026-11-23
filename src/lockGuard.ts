/**
 * Uscite "volute" dall'app: la galleria per scegliere il QR o il permesso della
 * fotocamera. Su Android aprono una schermata di sistema separata, l'app risulta
 * in background e senza questa eccezione al ritorno chiederebbe di nuovo l'impronta.
 * Su iOS la galleria resta dentro l'app: il comportamento diventa lo stesso.
 */
let open = 0;

/** true mentre l'app ha aperto di proposito una schermata di sistema. */
export function isExpectedExit(): boolean {
  return open > 0;
}

/** Esegue `fn` (che apre una schermata di sistema) senza far scattare il blocco. */
export async function withoutLock<T>(fn: () => Promise<T>): Promise<T> {
  open++;
  try {
    return await fn();
  } finally {
    // Il ritorno in primo piano può arrivare un attimo dopo la risposta della galleria.
    setTimeout(() => {
      open--;
    }, 1000);
  }
}
