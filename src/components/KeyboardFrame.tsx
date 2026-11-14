import React, {useEffect, useRef, useState} from 'react';
import {Keyboard, Platform, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

/** Il tastierino numerico e la tastiera di testo possono avere altezze diverse. */
export type KeyboardKind = 'number' | 'text';

const KEY = 'keyboard_space_v1';

/**
 * Spazio da lasciare libero in fondo alla schermata per ogni tastiera già vista, in punti:
 * in memoria per l'uso, salvato per la prossima apertura.
 */
const known: Partial<Record<KeyboardKind, number>> = {};

/** Da chiamare all'avvio: così Invia e Ricevi sanno già quanto posto serve alla tastiera. */
export async function loadKeyboardSpace() {
  try {
    const raw = await EncryptedStorage.getItem(KEY);
    if (raw) Object.assign(known, JSON.parse(raw));
  } catch {
    // si parte dalla stima
  }
}

function remember(kind: KeyboardKind, space: number) {
  if (known[kind] === space) return;
  known[kind] = space;
  EncryptedStorage.setItem(KEY, JSON.stringify(known)).catch(() => {});
}

/** Prima apertura in assoluto: spazio tipico della tastiera su questo telefono. */
function estimate(bottomInset: number, width: number): number {
  if (Platform.OS === 'android') return 280;
  if (bottomInset === 0) return 216; // iPhone con tasto Home
  return (width >= 428 ? 301 : 291) - bottomInset;
}

/** Sotto questa altezza non è una tastiera a schermo (tastiera esterna, sola barra degli accessori). */
const MIN_KEYBOARD = 120;

/**
 * Contenitore di Invia e Ricevi che lascia libero lo spazio della tastiera.
 *
 * Lo spazio è fisso: si riserva subito quello che la tastiera ha occupato l'ultima volta,
 * senza seguirla mentre sale. Così il contenuto compare già al suo posto e resta fermo,
 * invece di salire insieme ai tasti. Vale per iOS e per Android.
 * `kind` dice quale tastiera usa il passo corrente; null se non ne usa.
 */
export function KeyboardFrame({
  kind,
  style,
  children,
}: {
  kind: KeyboardKind | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const outer = useRef<React.ComponentRef<typeof View>>(null);
  // Serve solo a ridisegnare quando la tastiera vera risulta diversa da quella attesa.
  const [, setSeen] = useState(0);

  useEffect(() => {
    if (!kind) return;
    const apply = (space: number) => {
      remember(kind, Math.max(0, Math.round(space)));
      setSeen(n => n + 1);
    };

    if (Platform.OS === 'android') {
      // Android avvisa a tastiera già aperta. Lo spazio si misura come parte del contenitore
      // coperta dai tasti: se è il sistema a restringere la finestra risulta zero, e non si
      // lascia spazio due volte.
      const sub = Keyboard.addListener('keyboardDidShow', e => {
        const {height, screenY} = e.endCoordinates;
        if (height < MIN_KEYBOARD) return;
        const view = outer.current;
        if (!view) return apply(height);
        view.measureInWindow((_x, y, _w, h) => {
          const covered = y + h - screenY;
          apply(Number.isFinite(covered) ? covered : height);
        });
      });
      return () => sub.remove();
    }

    // iOS avvisa appena la tastiera parte, con l'altezza finale: lo spazio si corregge
    // subito, senza animazione, mentre la schermata sta ancora comparendo.
    // La tastiera copre anche la barra home, il contenitore finisce sopra: si toglie.
    const sub = Keyboard.addListener('keyboardWillShow', e => {
      const {height} = e.endCoordinates;
      if (height < MIN_KEYBOARD) return;
      apply(height - insets.bottom);
    });
    return () => sub.remove();
  }, [kind, insets.bottom]);

  const space = kind ? known[kind] ?? estimate(insets.bottom, width) : 0;

  return (
    <View ref={outer} collapsable={false} style={[s.fill, {paddingBottom: space}]}>
      <View style={style}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: {flex: 1},
});
