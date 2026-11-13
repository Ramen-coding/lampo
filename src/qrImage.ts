import EncryptedStorage from 'react-native-encrypted-storage';
import {launchImageLibrary} from 'react-native-image-picker';

/**
 * Il QR personale mostrato dal tasto centrale della Home: un'immagine scelta
 * dalla galleria (es. il QR del proprio indirizzo Lightning).
 *
 * La galleria restituisce un file temporaneo che il sistema può cancellare:
 * per farla restare si salva l'immagine stessa, ridotta, come data URI.
 */
const KEY = 'home_qr_image_v1';
/** Lato massimo in pixel: abbastanza per un QR nitido, poco spazio occupato. */
const MAX_SIDE = 1000;

/** L'immagine salvata (data URI pronta per <Image>), oppure null. */
export async function readQrImage(): Promise<string | null> {
  try {
    return await EncryptedStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Apre la galleria e salva l'immagine scelta.
 * Risolve null se l'utente annulla; lancia un errore se l'immagine non si può leggere.
 */
export async function pickQrImage(): Promise<string | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: true,
    maxWidth: MAX_SIDE,
    maxHeight: MAX_SIDE,
    quality: 0.9,
  });
  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (result.errorCode || !asset?.base64) {
    throw new Error('Non è stato possibile leggere questa immagine. Provane un’altra.');
  }
  const uri = `data:${asset.type ?? 'image/jpeg'};base64,${asset.base64}`;
  await EncryptedStorage.setItem(KEY, uri);
  return uri;
}

export function clearQrImage() {
  return EncryptedStorage.removeItem(KEY).catch(() => {});
}
