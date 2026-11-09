import EncryptedStorage from 'react-native-encrypted-storage';
import type {CredentialStore} from '@lightninglabs/lnc-rn';

/**
 * Store delle credenziali LNC.
 *
 * lnc-rn NON salva le credenziali da solo: dopo il primo pairing servono
 * localKey e remoteKey per ricollegarsi senza rifare l'abbinamento.
 * Qui le teniamo in memoria (lnc-rn legge i campi in modo sincrono) e le
 * persistiamo in EncryptedStorage (Keychain su iOS).
 *
 * Durante il primo abbinamento non si salva nulla: si scrive su disco solo
 * dopo commit(), cioè quando il nodo ha risposto. Così, se l'app viene chiusa
 * a metà, al riavvio non risulta "abbinata" con dati che non funzionano.
 */
const KEY = 'lnc_credentials_v1';

export const DEFAULT_SERVER_HOST = 'mailbox.terminal.lightning.today:443';

type Persisted = {
  pairingPhrase: string;
  serverHost: string;
  localKey: string;
  remoteKey: string;
};

const EMPTY: Persisted = {pairingPhrase: '', serverHost: '', localKey: '', remoteKey: ''};

export class SecureCredentialStore implements CredentialStore {
  private data: Persisted = {...EMPTY};
  private committed = false;

  static async load(): Promise<SecureCredentialStore> {
    const store = new SecureCredentialStore();
    try {
      const raw = await EncryptedStorage.getItem(KEY);
      if (raw) {
        store.data = {...EMPTY, ...JSON.parse(raw)};
        // su disco c'è solo ciò che è stato salvato dopo un abbinamento riuscito
        store.committed = true;
      }
    } catch {
      // storage illeggibile: si riparte da zero e si rifà il pairing
    }
    return store;
  }

  /** Prepara un nuovo abbinamento (solo in memoria finché non si chiama commit). */
  beginPairing(pairingPhrase: string, serverHost: string) {
    this.committed = false;
    this.data = {...EMPTY, pairingPhrase, serverHost};
  }

  /** Il nodo ha risposto: da qui in poi ogni modifica viene salvata. */
  async commit() {
    this.committed = true;
    await this.persist();
  }

  get pairingPhrase() { return this.data.pairingPhrase; }
  set pairingPhrase(v: string) { this.data.pairingPhrase = v; this.persist(); }

  get serverHost() { return this.data.serverHost || DEFAULT_SERVER_HOST; }
  set serverHost(v: string) { this.data.serverHost = v; this.persist(); }

  get localKey() { return this.data.localKey; }
  set localKey(v: string) { this.data.localKey = v; this.persist(); }

  get remoteKey() { return this.data.remoteKey; }
  set remoteKey(v: string) { this.data.remoteKey = v; this.persist(); }

  get isPaired() {
    return this.committed && (!!this.data.remoteKey || !!this.data.pairingPhrase);
  }

  clear() {
    this.committed = false;
    this.data = {...EMPTY};
    EncryptedStorage.removeItem(KEY).catch(() => {});
  }

  private persist(): Promise<void> {
    if (!this.committed) return Promise.resolve();
    return EncryptedStorage.setItem(KEY, JSON.stringify(this.data)).catch(() => {});
  }
}
