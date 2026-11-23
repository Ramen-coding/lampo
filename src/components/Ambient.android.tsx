import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet} from 'react-native';
import type {LinkState} from './ui';
import {colors} from './theme';

/** Quanta luce per ogni stato del nodo: piena quando è collegato, quasi spenta se non risponde. */
const LEVEL: Record<LinkState, number> = {online: 1, connecting: 0.55, offline: 0.25};

/**
 * Luce d'ambiente della Home su Android: lo stesso bagliore arancio dal basso di iOS,
 * ma disegnato dal gradiente nativo della vista (nessun SVG a tutto schermo da
 * rasterizzare). Più tenue: in Material dà solo calore, non deve "illuminare" il vetro.
 */
const GLOW = `radial-gradient(ellipse 85% 20% at 50% 100%, ${colors.amber}57 0%, ${colors.amber}1A 45%, ${colors.amber}00 100%)`;

export function Ambient({state}: {state: LinkState}) {
  const level = useRef(new Animated.Value(LEVEL[state])).current;

  useEffect(() => {
    Animated.timing(level, {toValue: LEVEL[state], duration: 200, useNativeDriver: true}).start();
  }, [state, level]);

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[StyleSheet.absoluteFill, {opacity: level, backgroundImage: GLOW}]}
    />
  );
}
