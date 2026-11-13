import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, useWindowDimensions} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Stop} from 'react-native-svg';
import {LinkState, colors} from './ui';

/** Quanta luce per ogni stato del nodo: piena quando è collegato, quasi spenta se non risponde. */
const LEVEL: Record<LinkState, number> = {online: 1, connecting: 0.55, offline: 0.25};

/**
 * Luce d'ambiente della Home: un bagliore arancio che sale dal basso, dietro la barra.
 * Dà al vetro qualcosa da rifrangere e lascia spento quasi tutto lo schermo OLED.
 *
 * È ferma (cambia solo, in un attimo, con lo stato del nodo) e resta in basso: una luce
 * molto tenue dietro il saldo sugli schermi OLED appare sgranata, per questo lì non c'è.
 */
export function Ambient({state}: {state: LinkState}) {
  const {width, height} = useWindowDimensions();
  const level = useRef(new Animated.Value(LEVEL[state])).current;

  useEffect(() => {
    Animated.timing(level, {toValue: LEVEL[state], duration: 200, useNativeDriver: true}).start();
  }, [state, level]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity: level}]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="low" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.amber} stopOpacity={0.42} />
            <Stop offset="0.45" stopColor={colors.amber} stopOpacity={0.14} />
            <Stop offset="1" stopColor={colors.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* il centro è sotto il bordo: se ne vede solo la parte alta */}
        <Ellipse cx={width / 2} cy={height} rx={width * 0.85} ry={height * 0.2} fill="url(#low)" />
      </Svg>
    </Animated.View>
  );
}
