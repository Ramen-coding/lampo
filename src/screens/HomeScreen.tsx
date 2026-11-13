import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowIcon,
  LinkState,
  PillButton,
  QrIcon,
  StatusPill,
  colors,
  type,
} from '../components/ui';
import { Glass } from '../components/glass';
import { QrBubble } from '../components/QrBubble';
import { formatSat, formatTime } from '../cache';
import { clearQrImage, pickQrImage, readQrImage } from '../qrImage';
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
  /** Trascinando giù: rilegge il saldo e, se il nodo non risponde, rifà il collegamento. */
  onPullRefresh: () => Promise<void>;
  onSend: () => void;
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

  // Quando il saldo cambia (un pagamento arrivato o partito) la cifra scorre fino al nuovo valore.
  const shownSat = useCountUp(p.balanceSat);

  const priceIsOld = price !== null && Date.now() - price.at > 10 * 60_000;

  function renderAmount(u: Unit) {
    const isEur = u === 'eur';
    const amount =
      u === 'hidden'
        ? HIDDEN
        : shownSat === null
        ? '—'
        : isEur
        ? price
          ? formatEur(satToEur(shownSat, price))
          : '—'
        : formatSat(shownSat);
    return (
      <Text
        style={[
          type.balance,
          {
            fontSize: balanceSize,
            lineHeight: Math.round(balanceSize * 1.2),
            letterSpacing: -balanceSize * 0.03,
            color:
              p.balanceIsCached || (isEur && priceIsOld)
                ? colors.muted
                : colors.text,
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
    );
  }

  // Nella pillola sotto la cifra: unità e, se serve, lo stato del cambio.
  const unitLabel =
    unit === null
      ? ' '
      : unit === 'sat'
      ? 'sat'
      : unit === 'hidden'
      ? 'nascosto'
      : !price
      ? '€ · cambio non disponibile'
      : priceIsOld
      ? `€ · cambio delle ${formatTime(price.at)}`
      : '€';

  // Il saldo "cede" sotto il dito, come una goccia.
  const press = useRef(new Animated.Value(0)).current;
  const pressTo = (toValue: number) =>
    Animated.spring(press, {
      toValue,
      damping: 14,
      stiffness: 260,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  const pressScale = press.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  // Trascinando giù si aggiorna il saldo: la rotellina resta almeno un attimo,
  // così si capisce che l'aggiornamento è partito anche quando il nodo risponde subito.
  const [refreshing, setRefreshing] = useState(false);
  const pulling = useRef(false);
  async function pullRefresh() {
    if (pulling.current) return;
    pulling.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        p.onPullRefresh(),
        new Promise<void>(r => setTimeout(r, 600)),
      ]);
    } finally {
      pulling.current = false;
      setRefreshing(false);
    }
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

  // Tasto centrale: il QR personale, un'immagine scelta dalla galleria che resta salvata.
  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const picking = useRef(false);

  useEffect(() => {
    readQrImage().then(setQr);
  }, []);

  async function chooseQr() {
    if (picking.current) return;
    picking.current = true;
    try {
      const uri = await pickQrImage();
      if (uri) {
        setQr(uri);
        setQrOpen(true);
      }
    } catch (e: any) {
      Alert.alert(
        'Immagine non caricata',
        e?.message ?? 'Non è stato possibile aprire la galleria.',
      );
    } finally {
      picking.current = false;
    }
  }

  /** Con un QR già salvato lo mostra; la prima volta apre la galleria per aggiungerlo. */
  async function openQr() {
    const saved = qr ?? (await readQrImage());
    if (saved) {
      setQr(saved);
      setQrOpen(true);
    } else {
      chooseQr();
    }
  }

  function confirmRemoveQr() {
    Alert.alert('Rimuovere il QR?', 'Potrai aggiungerne un altro dalla galleria.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: () => {
          clearQrImage();
          setQr(null);
          setQrOpen(false);
        },
      },
    ]);
  }

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

  const offline = p.link !== 'online';

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={pullRefresh}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <View style={s.top}>
          <StatusPill state={p.link} />
          <PillButton label="Scollega" onPress={confirmUnpair} />
        </View>

        {/* Il saldo è l'unico elemento "forte" della schermata. */}
        <View style={s.center}>
          {/* Cifra e pillola dell'unità sono toccabili: sat → euro → nascosto → sat… */}
          <Pressable
            onPress={cycleUnit}
            onPressIn={() => pressTo(1)}
            onPressOut={() => pressTo(0)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            hitSlop={12}
            style={s.balance}
          >
            <Animated.View
              style={[s.drop, { transform: [{ scale: pressScale }] }]}
            >
              {/* Altezza data dal livello entrante; quello uscente gli si sovrappone. */}
              <View style={s.amount}>
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
              </View>
              {/* Fuori dai livelli che sfumano: il vetro non sopporta l'opacità animata. */}
              <Glass style={s.unit}>
                <Text style={s.unitText} numberOfLines={1}>
                  {unitLabel}
                </Text>
              </Glass>
            </Animated.View>
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
      </ScrollView>

      {/* La barra dei comandi: una bolla di vetro con dentro due ovali e un cerchio. */}
      <Glass style={s.bar}>
        <BarButton
          label="Ricevi"
          icon={<ArrowIcon direction="in" />}
          onPress={p.onReceive}
          disabled={offline}
        />
        {/* Il QR personale: non serve il nodo, quindi funziona anche offline. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            qr ? 'Mostra il mio QR' : 'Aggiungi un QR dalla galleria'
          }
          onPress={openQr}
          hitSlop={8}
          style={({ pressed }) => [s.round, pressed && s.pressed]}
        >
          <QrIcon />
        </Pressable>
        <BarButton
          label="Invia"
          icon={<ArrowIcon direction="out" color={colors.bg} />}
          onPress={p.onSend}
          disabled={offline}
          primary
        />
      </Glass>

      {qrOpen && qr ? (
        <QrBubble
          uri={qr}
          onChange={chooseQr}
          onRemove={confirmRemoveQr}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </View>
  );
}

/** Ovale dentro la barra di vetro: pieno arancio per Invia, traslucido per Ricevi. */
function BarButton({
  label,
  icon,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.oval,
        primary && s.ovalPrimary,
        disabled && s.dimmed,
        pressed && s.pressed,
      ]}
    >
      {icon}
      <Text style={[s.ovalText, primary && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Fa scorrere un numero dal valore precedente a quello nuovo (circa un secondo,
 * rallentando alla fine). La prima cifra mostrata compare subito, senza scorrere.
 */
function useCountUp(target: number | null): number | null {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === null || target === null || from === target) {
      current.current = target;
      setShown(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / 900);
      const value = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      current.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  // flexGrow: il contenuto riempie lo schermo (saldo al centro) e si può comunque trascinare.
  content: { flexGrow: 1, padding: 24, paddingBottom: 8 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balance: { alignSelf: 'stretch', marginTop: 32 },
  drop: { alignItems: 'center', gap: 10 },
  amount: { alignSelf: 'stretch' },
  unit: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: { fontSize: 15, fontWeight: '500', color: colors.muted },
  note: { height: 32, justifyContent: 'flex-end' },
  // Bolla alta 72 con raggio 36; dentro, ovali alti 56 con raggio 28: curve concentriche.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 36,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  oval: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.fill,
  },
  ovalPrimary: { backgroundColor: colors.amber },
  ovalText: { fontSize: 18, fontWeight: '600', color: colors.text },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  dimmed: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.96 }] },
  layer: { alignItems: 'center' },
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
