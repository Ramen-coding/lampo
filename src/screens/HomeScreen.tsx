import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Button,
  IconButton,
  LinkState,
  QrIcon,
  StatusLine,
  TextLink,
  colors,
  type,
} from '../components/ui';
import { formatSat, formatTime } from '../cache';
import {
  Price,
  Unit,
  fetchPrice,
  formatEur,
  nextUnit,
  readCachedPrice,
  readUnit,
  satToEur,
  writeUnit,
} from '../price';

type Props = {
  link: LinkState;
  balanceSat: number | null;
  balanceIsCached: boolean;
  balanceAt: number | null;
  onRefresh: () => void;
  onSend: () => void;
  onScan: () => void;
  onReceive: () => void;
  onUnpair: () => void;
};

/** Saldo nascosto: sempre la stessa lunghezza, così non lascia intuire la cifra. */
const HIDDEN = '******';

/** Un "livello" del saldo: durante il cambio il vecchio sfuma mentre il nuovo entra. */
type Layer = { id: number; unit: Unit; leaving: boolean };

export function HomeScreen(p: Props) {
  // null finché non si sa la modalità salvata: niente cifra mostrata per errore
  // se l'utente aveva lasciato il saldo nascosto.
  const [unit, setUnit] = useState<Unit | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const nextId = useRef(1);
  const [price, setPrice] = useState<Price | null>(null);

  // All'apertura: sat, oppure nascosto se l'app era stata chiusa così.
  useEffect(() => {
    readUnit().then(u => {
      setUnit(u);
      setLayers([{ id: 0, unit: u, leaving: false }]);
    });
    readCachedPrice().then(setPrice);
  }, []);

  // Cambio aggiornato in anticipo (anche in sat, la modalità che precede gli euro):
  // al tocco la cifra in euro è già quella giusta e non "salta" dopo un istante.
  // La richiesta contiene solo il prezzo, mai il saldo.
  useEffect(() => {
    if (unit !== null && unit !== 'hidden' && p.balanceSat !== null) {
      fetchPrice().then(setPrice);
    }
  }, [unit, p.balanceSat]);

  function cycleUnit() {
    if (unit === null) return;
    const next = nextUnit(unit);
    setUnit(next);
    writeUnit(next);
    if (next === 'eur') fetchPrice().then(setPrice);
    p.onRefresh();
    const id = nextId.current++;
    setLayers(ls => [
      ...ls.map(l => ({ ...l, leaving: true })),
      { id, unit: next, leaving: false },
    ]);
  }

  function removeLayer(id: number) {
    setLayers(ls => ls.filter(l => l.id !== id));
  }

  // Font il più grande possibile perché "1.000.000" stia in una riga.
  const { width } = useWindowDimensions();
  const balanceSize = Math.min(88, Math.floor((width - 48) / 5));

  function renderAmount(u: Unit) {
    const isEur = u === 'eur';
    const priceIsOld =
      isEur && price !== null && Date.now() - price.at > 10 * 60_000;
    const amount =
      u === 'hidden'
        ? HIDDEN
        : p.balanceSat === null
        ? '—'
        : isEur
        ? price
          ? formatEur(satToEur(p.balanceSat, price))
          : '—'
        : formatSat(p.balanceSat);
    // Sotto la cifra: unità e, se serve, lo stato del cambio (sfumano insieme alla cifra).
    const caption =
      u === 'sat'
        ? 'sat'
        : u === 'hidden'
        ? ' '
        : !price
        ? '€ · cambio non disponibile'
        : priceIsOld
        ? `€ · cambio delle ${formatTime(price.at)}`
        : '€';
    return (
      <>
        <Text
          style={[
            type.balance,
            {
              fontSize: balanceSize,
              lineHeight: Math.round(balanceSize * 1.2),
              letterSpacing: -balanceSize * 0.03,
              color:
                p.balanceIsCached || priceIsOld ? colors.muted : colors.text,
            },
            // L'asterisco sta in alto sulla riga: lo si porta al centro delle cifre.
            u === 'hidden' && {
              transform: [{ translateY: balanceSize * 0.2 }],
            },
          ]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {amount}
        </Text>
        <Text style={[type.body, { color: colors.muted }]} numberOfLines={1}>
          {caption}
        </Text>
      </>
    );
  }

  const accessibilityLabel =
    unit === 'hidden'
      ? 'Saldo nascosto'
      : unit === 'eur'
      ? 'Saldo in euro'
      : 'Saldo in sat';
  const accessibilityHint =
    unit === 'sat'
      ? 'Mostra il saldo in euro'
      : unit === 'eur'
      ? 'Nasconde il saldo'
      : 'Mostra il saldo in sat';

  function confirmUnpair() {
    Alert.alert(
      'Scollegare il nodo?',
      'Dovrai creare una nuova sessione in Lightning Terminal per ricollegarti.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Scollega', style: 'destructive', onPress: p.onUnpair },
      ],
    );
  }

  return (
    <View style={s.root}>
      <View style={s.top}>
        <StatusLine state={p.link} />
        <TextLink label="Scollega" onPress={confirmUnpair} />
      </View>

      {/* Il saldo è l'unico elemento "forte" della schermata. */}
      <View style={s.center}>
        {/* Solo la cifra è toccabile: sat → euro → nascosto → sat… */}
        <Pressable
          onPress={cycleUnit}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          hitSlop={12}
          style={s.balance}
        >
          {layers.map(l => (
            <FadeLayer
              key={l.id}
              animateIn={l.id !== 0}
              leaving={l.leaving}
              onGone={() => removeLayer(l.id)}
            >
              {renderAmount(l.unit)}
            </FadeLayer>
          ))}
        </Pressable>
        {/* Spazio fisso: la nota compare senza spostare il saldo. */}
        <View style={s.note}>
          {p.balanceIsCached && p.balanceAt ? (
            <Text style={[type.small, { color: colors.muted }]}>
              Ultimo saldo delle {formatTime(p.balanceAt)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={s.actions}>
        <Button
          label="Ricevi"
          variant="secondary"
          onPress={p.onReceive}
          disabled={p.link !== 'online'}
        />
        {/* Scorciatoia: fotocamera subito pronta per pagare un QR */}
        <IconButton
          label="Scansiona QR"
          onPress={p.onScan}
          disabled={p.link !== 'online'}
        >
          <QrIcon />
        </IconButton>
        <Button
          label="Invia"
          onPress={p.onSend}
          disabled={p.link !== 'online'}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Altezza data dal livello entrante; quello uscente gli si sovrappone.
  balance: { alignSelf: 'stretch', marginTop: 32 },
  note: { height: 32, justifyContent: 'flex-end' },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  layer: { alignItems: 'center', gap: 2 },
});

/**
 * Dissolvenza incrociata: il nuovo valore sale da sotto mentre il vecchio,
 * sovrapposto, sfuma verso l'alto. Ingresso e uscita sono due animazioni
 * separate: un tocco a metà cambio riparte da dove si trova, senza scatti.
 */
function FadeLayer({
  animateIn,
  leaving,
  onGone,
  children,
}: {
  animateIn: boolean;
  leaving: boolean;
  onGone: () => void;
  children: React.ReactNode;
}) {
  const enter = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const gone = useRef(onGone);
  gone.current = onGone;

  useEffect(() => {
    if (!animateIn) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: 60,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [animateIn, enter]);

  useEffect(() => {
    if (!leaving) return;
    Animated.timing(exit, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start(({ finished }) => finished && gone.current());
  }, [leaving, exit]);

  const style = {
    opacity: Animated.multiply(
      enter,
      exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    ),
    transform: [
      {
        translateY: Animated.add(
          enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
          exit.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
        ),
      },
      {
        scale: Animated.multiply(
          enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
          exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }),
        ),
      },
    ],
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.layer, leaving && StyleSheet.absoluteFill, style]}
    >
      {children}
    </Animated.View>
  );
}
