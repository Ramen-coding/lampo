import React from 'react';
import {StyleSheet, View, ViewProps} from 'react-native';
import {colors} from './theme';

/**
 * Android non ha il vetro di sistema e imitarlo con la trasparenza sembra finto.
 * Qui `Glass` è una superficie Material 3: tinta piena e calda (surface container),
 * niente contorno, niente trasparenza. Stessa forma e stesse misure di iOS.
 */
export const hasGlass = false;

type Props = ViewProps & {
  /** Solo iOS (il vetro reagisce al tocco); su Android il tocco lo gestisce il ripple. */
  interactive?: boolean;
  /** Solo per il vetro disegnato: qui ogni superficie è già piena, sotto non si legge niente. */
  solid?: boolean;
};

export function Glass({interactive: _interactive, solid: _solid, style, children, ...rest}: Props) {
  return (
    <View style={[s.surface, style]} {...rest}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  surface: {backgroundColor: colors.surface},
});
