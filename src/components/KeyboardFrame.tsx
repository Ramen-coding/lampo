import React, {useEffect, useState} from 'react';
import {Keyboard, KeyboardAvoidingView, Platform, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

/** Il tastierino numerico e la tastiera di testo possono avere altezze diverse. */
export type KeyboardKind = 'number' | 'text';

const KEY = 'keyboard_heights_v1';

/** Altezze già viste, in punti: in memoria per l'uso, salvate per la prossima apertura. */
const known: Partial<Record<KeyboardKind, number>> = {};

/** Da chiamare all'avvio: così Invia e Ricevi sanno già quanto è alta la tastiera. */
export async function loadKeyboardHeights() {
  try {
    const raw = await EncryptedStorage.getItem(KEY);
    if (raw) Object.assign(known, JSON.parse(raw));
  } catch {
    // si parte dalla stima
  }
}

function remember(kind: KeyboardKind, height: number) {
  if (known[kind] === height) return;
  known[kind] = height;
  EncryptedStorage.setItem(KEY, JSON.stringify(known)).catch(() => {});
}

/** Prima apertura in assoluto: altezza tipica della tastiera per questo telefono. */
function estimate(bottomInset: number, width: number): number {
  if (bottomInset === 0) return 216; // iPhone con tasto Home
  return width >= 428 ? 301 : 291;
}

/**
 * Contenitore di Invia e Ricevi che lascia libero lo spazio della tastiera.
 *
 * Su iOS lo spazio è fisso: si riserva subito l'altezza della tastiera (quella vista
 * l'ultima volta), senza seguirla mentre sale. Così il contenuto compare già al suo
 * posto e resta fermo, invece di salire insieme ai tasti.
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
  if (Platform.OS === 'android') {
    // Android ridimensiona da sé la finestra: resta il comportamento di sempre.
    return (
      <KeyboardAvoidingView style={style} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <FixedFrame kind={kind} style={style}>
      {children}
    </FixedFrame>
  );
}

function FixedFrame({kind, style, children}: React.ComponentProps<typeof KeyboardFrame>) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  // Cambia solo se la tastiera vera risulta diversa da quella attesa.
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (!kind) return;
    // "WillShow" arriva appena la tastiera parte, con l'altezza finale: lo spazio si
    // corregge subito, senza animazione, mentre la schermata sta ancora comparendo.
    const sub = Keyboard.addListener('keyboardWillShow', e => {
      const height = Math.round(e.endCoordinates.height);
      if (height < 120) return; // tastiera esterna: resta solo la barra degli accessori
      remember(kind, height);
      setSeen(height);
    });
    return () => sub.remove();
  }, [kind]);

  // Lo spazio riservato parte da sopra la barra home, che la tastiera invece copre.
  const height = kind ? known[kind] ?? (seen || estimate(insets.bottom, width)) : 0;
  const space = Math.max(0, height - insets.bottom);

  return (
    <View style={[s.fill, {paddingBottom: space}]}>
      <View style={style}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: {flex: 1},
});
