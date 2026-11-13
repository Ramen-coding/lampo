import React, {useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions} from 'react-native';
import Svg, {Defs, Ellipse, RadialGradient, Stop} from 'react-native-svg';
import {LinkState, colors} from './ui';

/** Quanta luce per ogni stato del nodo: piena quando è collegato, quasi spenta se non risponde. */
const LEVEL: Record<LinkState, number> = {online: 1, connecting: 0.55, offline: 0.25};

/**
 * Luce d'ambiente della Home: un bagliore arancio che sale dal basso, dietro la barra,
 * e uno più tenue dietro il saldo. Dà al vetro qualcosa da rifrangere (su nero puro
 * il vetro non si vedrebbe) e lascia spento quasi tutto lo schermo OLED.
 * La luce "respira" lentamente e segue lo stato del nodo.
 */
export function Ambient({state}: {state: LinkState}) {
  const {width, height} = useWindowDimensions();
  const level = useRef(new Animated.Value(LEVEL[state])).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(level, {
      toValue: LEVEL[state],
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [state, level]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    // Con "Riduci movimento" attivo la luce resta ferma.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduce => {
        if (cancelled || reduce) return;
        const half = (toValue: number) =>
          Animated.timing(breath, {toValue, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true});
        loop = Animated.loop(Animated.sequence([half(1), half(0)]));
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [breath]);

  const opacity = Animated.multiply(level, breath.interpolate({inputRange: [0, 1], outputRange: [0.75, 1]}));
  const scale = breath.interpolate({inputRange: [0, 1], outputRange: [1, 1.06]});

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity, transform: [{scale}]}]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="low" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.amber} stopOpacity={0.42} />
            <Stop offset="0.45" stopColor={colors.amber} stopOpacity={0.14} />
            <Stop offset="1" stopColor={colors.amber} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="mid" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.amber} stopOpacity={0.13} />
            <Stop offset="1" stopColor={colors.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* dietro il saldo */}
        <Ellipse cx={width / 2} cy={height * 0.44} rx={width * 0.62} ry={height * 0.17} fill="url(#mid)" />
        {/* dietro la barra: il centro è sotto il bordo, se ne vede solo la parte alta */}
        <Ellipse cx={width / 2} cy={height} rx={width * 0.85} ry={height * 0.24} fill="url(#low)" />
      </Svg>
    </Animated.View>
  );
}
