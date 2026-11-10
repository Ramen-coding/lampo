import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
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

export function HomeScreen(p: Props) {
  const [unit, setUnit] = useState<Unit>('sat');
  const [price, setPrice] = useState<Price | null>(null);

  // Riapre con l'ultima unità scelta e l'ultimo cambio salvato.
  useEffect(() => {
    readUnit().then(setUnit);
    readCachedPrice().then(setPrice);
  }, []);

  // Il saldo cambia (pagamento, ricezione, rientro nell'app): cambio aggiornato.
  useEffect(() => {
    if (unit === 'eur' && p.balanceSat !== null) fetchPrice().then(setPrice);
  }, [unit, p.balanceSat]);

  // Cambio unità morbido: la cifra sfuma e sale, poi la nuova entra dal basso.
  const fade = useRef(new Animated.Value(1)).current;
  const switching = useRef(false);

  function toggleUnit() {
    if (switching.current) return;
    switching.current = true;
    const next: Unit = unit === 'sat' ? 'eur' : 'sat';
    writeUnit(next);
    p.onRefresh();
    Animated.timing(fade, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setUnit(next);
      fade.setValue(2);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => (switching.current = false));
    });
  }
  // fade: 1 = visibile; 0 = uscita (in alto, piccola); 2 = ingresso (in basso, piccola)
  const amountStyle = {
    opacity: fade.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateY: fade.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [-14, 0, 14],
        }),
      },
      {
        scale: fade.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0.94, 1, 0.94],
        }),
      },
    ],
  };

  const showEur = unit === 'eur';
  const amount =
    p.balanceSat === null
      ? '—'
      : showEur
      ? price
        ? formatEur(satToEur(p.balanceSat, price))
        : '—'
      : formatSat(p.balanceSat);
  const priceIsOld =
    showEur && price !== null && Date.now() - price.at > 10 * 60_000;

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
      <Pressable
        style={s.center}
        onPress={toggleUnit}
        accessibilityRole="button"
        accessibilityHint={
          showEur ? 'Mostra il saldo in sat' : 'Mostra il saldo in euro'
        }
      >
        <Animated.View
          style={[{ alignItems: 'center', alignSelf: 'stretch' }, amountStyle]}
        >
          <Text
            style={[
              type.balance,
              {
                color:
                  p.balanceIsCached || priceIsOld ? colors.muted : colors.text,
              },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {amount}
          </Text>
          <Text style={[type.body, { color: colors.muted }]}>
            {showEur ? '€' : 'sat'}
          </Text>
        </Animated.View>
        {p.balanceIsCached && p.balanceAt ? (
          <Text style={[type.small, { color: colors.muted, marginTop: 12 }]}>
            Ultimo saldo delle {formatTime(p.balanceAt)}
          </Text>
        ) : null}
        {showEur && !price ? (
          <Text style={[type.small, { color: colors.muted, marginTop: 12 }]}>
            Cambio non disponibile
          </Text>
        ) : null}
        {priceIsOld && price ? (
          <Text style={[type.small, { color: colors.muted, marginTop: 12 }]}>
            Cambio delle {formatTime(price.at)}
          </Text>
        ) : null}
      </Pressable>

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
