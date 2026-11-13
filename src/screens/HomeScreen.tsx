import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutAnimation,
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

/** Durate brevi: l'app deve sembrare immediata. */
const MORPH_MS = 160; // la bolla del saldo cambia forma e la cifra nuova compare
const COUNT_MS = 320; // la cifra scorre al nuovo saldo
const REFRESH_MIN_MS = 350; // tempo minimo della rotellina

/** La bolla del saldo: distanza dai bordi dello schermo e margine interno. */
const BUBBLE_MARGIN = 16;
const BUBBLE_PADDING = 26;

/** Saldo nascosto: sempre la stessa lunghezza, così non lascia intuire la cifra. */
const HIDDEN = '******';

export function HomeScreen(p: Props) {
  // null finché non si sa la modalità salvata: niente cifra mostrata per errore
  // se l'utente aveva lasciato il saldo nascosto.
  const [unit, setUnit] = useState<Unit | null>(null);
  const [price, setPrice] = useState<Price | null>(null);

  // All'apertura: sat, oppure nascosto se l'app era stata chiusa così.
  useEffect(() => {
    readUnit().then(setUnit);
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

  // La cifra nuova compare con una dissolvenza breve dentro la bolla.
  const fade = useRef(new Animated.Value(1)).current;

  function cycleUnit() {
    if (unit === null) return;
    const next = nextUnit(unit);
    // La bolla si allarga o si stringe attorno alla nuova cifra.
    LayoutAnimation.configureNext({
      duration: MORPH_MS,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setUnit(next);
    writeUnit(next);
    if (next === 'eur') fetchPrice().then(setPrice);
    p.onRefresh();
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: MORPH_MS,
      useNativeDriver: true,
    }).start();
  }

  // Font il più grande possibile perché "1.000.000" stia in una riga dentro la bolla.
  const { width } = useWindowDimensions();
  const amountWidth = width - 2 * (BUBBLE_MARGIN + BUBBLE_PADDING);
  const balanceSize = Math.min(80, Math.floor(amountWidth / 5));

  // Quando il saldo cambia (un pagamento arrivato o partito) la cifra scorre fino al nuovo valore.
  const shownSat = useCountUp(p.balanceSat);

  const isEur = unit === 'eur';
  const priceIsOld = price !== null && Date.now() - price.at > 10 * 60_000;
  const amount =
    unit === 'hidden'
      ? HIDDEN
      : shownSat === null
      ? '—'
      : isEur
      ? price
        ? formatEur(satToEur(shownSat, price))
        : '—'
      : formatSat(shownSat);
  // Sotto la cifra: unità e, se serve, lo stato del cambio. Nascosto: niente, la bolla si accorcia.
  const caption =
    unit === 'sat'
      ? 'sat'
      : unit === 'hidden'
      ? null
      : !price
      ? '€ · cambio non disponibile'
      : priceIsOld
      ? `€ · cambio delle ${formatTime(price.at)}`
      : '€';

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
        new Promise<void>(r => setTimeout(r, REFRESH_MIN_MS)),
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
          {/* Tutto il saldo sta in una bolla di vetro: toccandola sat → euro → nascosto → sat… */}
          {unit === null ? null : (
            <Pressable
              onPress={cycleUnit}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={accessibilityHint}
              hitSlop={12}
              style={({ pressed }) => [s.balance, pressed && s.pressed]}
            >
              <Glass interactive style={s.bubble}>
                {/* La dissolvenza è sul contenuto, mai sul vetro (vedi Glass). */}
                <Animated.View style={[s.amount, { opacity: fade }]}>
                  <Text
                    style={[
                      type.balance,
                      {
                        maxWidth: amountWidth,
                        fontSize: balanceSize,
                        lineHeight: Math.round(balanceSize * 1.15),
                        letterSpacing: -balanceSize * 0.03,
                        color:
                          p.balanceIsCached || (isEur && priceIsOld)
                            ? colors.muted
                            : colors.text,
                      },
                      // L'asterisco sta in alto sulla riga: lo si porta al centro della bolla.
                      unit === 'hidden' && {
                        transform: [{ translateY: balanceSize * 0.2 }],
                      },
                    ]}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {amount}
                  </Text>
                  {caption ? (
                    <Text style={s.caption} numberOfLines={1}>
                      {caption}
                    </Text>
                  ) : null}
                </Animated.View>
              </Glass>
            </Pressable>
          )}
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
 * Fa scorrere un numero dal valore precedente a quello nuovo (un terzo di secondo,
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
      const k = Math.min(1, (Date.now() - start) / COUNT_MS);
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
  content: {
    flexGrow: 1,
    paddingVertical: 24,
    paddingHorizontal: BUBBLE_MARGIN,
    paddingBottom: 8,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24 - BUBBLE_MARGIN,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balance: { marginTop: 32 },
  bubble: {
    borderRadius: 40,
    paddingHorizontal: BUBBLE_PADDING,
    paddingTop: 14,
    paddingBottom: 16,
    minWidth: 150,
    alignItems: 'center',
  },
  amount: { alignItems: 'center' },
  caption: { fontSize: 17, fontWeight: '500', color: colors.muted },
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
});
