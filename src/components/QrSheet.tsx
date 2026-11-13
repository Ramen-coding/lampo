import React, {useCallback, useEffect, useRef} from 'react';
import {Animated, BackHandler, Easing, Image, PanResponder, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {TextLink, colors} from './ui';

/**
 * Pannello che sale dal basso e occupa metà schermo: mostra il QR personale
 * scelto dalla galleria. Si chiude toccando fuori, trascinandolo giù o con "Chiudi".
 *
 * È una vista dentro la Home, non un Modal di sistema: così la schermata di
 * blocco (Face ID) continua a coprirlo quando l'app torna dal background.
 */
export function QrSheet({
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
  const {height} = useWindowDimensions();
  // 0 = chiuso (sotto lo schermo), 1 = aperto
  const open = useRef(new Animated.Value(0)).current;
  // spostamento del dito mentre si trascina verso il basso
  const drag = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(open, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(open, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [open, onClose]);

  // Android: il tasto indietro chiude il pannello invece di uscire dall'app.
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
          Animated.spring(drag, {toValue: 0, useNativeDriver: true, bounciness: 0}).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, {toValue: 0, useNativeDriver: true, bounciness: 0}).start();
      },
    }),
  ).current;

  const sheetHeight = Math.round(height / 2);
  const translateY = Animated.add(
    open.interpolate({inputRange: [0, 1], outputRange: [sheetHeight, 0]}),
    drag,
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, {opacity: open}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
      </Animated.View>
      <Animated.View style={[s.sheet, {height: sheetHeight, transform: [{translateY}]}]} {...pan.panHandlers}>
        <View style={s.grabber} />
        {/* Fondo bianco: il QR resta leggibile anche se l'immagine è ritagliata stretta. */}
        <View style={s.frame}>
          <Image source={{uri}} style={s.image} resizeMode="contain" accessibilityLabel="Il tuo QR" />
        </View>
        <View style={s.links}>
          <TextLink label="Rimuovi" onPress={onRemove} />
          <TextLink label="Cambia" onPress={onChange} />
          <TextLink label="Chiudi" onPress={close} />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  grabber: {alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line},
  frame: {flex: 1, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 12},
  image: {flex: 1, width: '100%'},
  links: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4},
});
