import React, {useCallback, useEffect, useRef} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {colors} from './ui';
import {Glass} from './glass';

/** Distanza dai bordi: la stessa della barra della Home, da cui la bolla nasce. */
const MARGIN = 12;
const PADDING = 12;
const ACTIONS = 44;
/** La bolla parte grande più o meno quanto il tasto QR. */
const START_SCALE = 0.15;

/**
 * Il QR personale in una bolla di vetro che si gonfia dal tasto QR della barra
 * e ci rientra quando si chiude. Si chiude toccando fuori, trascinandola giù
 * o con "Chiudi".
 *
 * È una vista dentro la Home, non un Modal di sistema: così la schermata di
 * blocco (Face ID) continua a coprirla quando l'app torna dal background.
 */
export function QrBubble({
  uri,
  onChange,
  onRemove,
  onClose,
}: {
  uri: string;
  onChange: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const {width, height} = useWindowDimensions();
  // 0 = chiusa (piccola, sul tasto QR), 1 = aperta
  const open = useRef(new Animated.Value(0)).current;
  // spostamento del dito mentre si trascina verso il basso
  const drag = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    // Molla morbida: la bolla supera di poco la misura finale e si assesta.
    Animated.spring(open, {
      toValue: 1,
      damping: 15,
      stiffness: 170,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [open]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(open, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [open, onClose]);

  // Android: il tasto indietro chiude la bolla invece di uscire dall'app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const closeRef = useRef(close);
  closeRef.current = close;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          closeRef.current();
        } else {
          Animated.spring(drag, {toValue: 0, useNativeDriver: true, bounciness: 6}).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, {toValue: 0, useNativeDriver: true, bounciness: 6}).start();
      },
    }),
  ).current;

  // Larga quasi tutto lo schermo, con il QR quadrato; sugli schermi bassi o larghi si riduce.
  const bubbleWidth = Math.min(width - MARGIN * 2, 440, height - 220);
  const bubbleHeight = bubbleWidth + ACTIONS + PADDING;

  const scale = open.interpolate({inputRange: [0, 1], outputRange: [START_SCALE, 1]});
  // La scala parte dal centro della vista: questo spostamento tiene fermo il bordo
  // in basso, così la bolla cresce verso l'alto a partire dal tasto.
  const anchor = open.interpolate({
    inputRange: [0, 1],
    outputRange: [(bubbleHeight * (1 - START_SCALE)) / 2, 0],
  });
  const contentOpacity = open.interpolate({inputRange: [0, 0.45, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});
  const backdropOpacity = open.interpolate({inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp'});

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, {opacity: backdropOpacity}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
      </Animated.View>
      {/* Solo trasformazioni sulla bolla: il vetro non va mai reso trasparente (vedi Glass). */}
      <Animated.View
        style={[
          s.anchor,
          {width: bubbleWidth, height: bubbleHeight, transform: [{translateY: Animated.add(anchor, drag)}, {scale}]},
        ]}
        {...pan.panHandlers}>
        <Glass style={s.bubble}>
          <Animated.View style={[s.content, {opacity: contentOpacity}]}>
            {/* Fondo bianco: il QR resta leggibile anche se l'immagine è ritagliata stretta. */}
            <View style={s.frame}>
              <Image source={{uri}} style={s.image} resizeMode="contain" accessibilityLabel="Il tuo QR" />
            </View>
            <View style={s.actions}>
              <Action label="Rimuovi" color={colors.red} onPress={onRemove} />
              <Action label="Cambia" onPress={onChange} />
              <Action label="Chiudi" onPress={close} />
            </View>
          </Animated.View>
        </Glass>
      </Animated.View>
    </View>
  );
}

function Action({label, color = colors.text, onPress}: {label: string; color?: string; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [s.action, pressed && s.pressed]}>
      <Text style={[s.actionText, {color}]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: {backgroundColor: 'rgba(0,0,0,0.55)'},
  anchor: {position: 'absolute', bottom: MARGIN, alignSelf: 'center'},
  // Raggio 40 fuori, 28 dentro con 12 di margine: curve concentriche.
  bubble: {flex: 1, borderRadius: 40},
  content: {flex: 1, padding: PADDING, gap: PADDING},
  frame: {flex: 1, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 14},
  image: {flex: 1, width: '100%'},
  actions: {flexDirection: 'row', gap: 8, height: ACTIONS},
  action: {
    flex: 1,
    borderRadius: ACTIONS / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  actionText: {fontSize: 15, fontWeight: '600'},
  pressed: {transform: [{scale: 0.96}]},
});
