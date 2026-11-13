import React from 'react';
import {StyleSheet, View, ViewProps} from 'react-native';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';

/**
 * true dove esiste il vetro vero di sistema (Liquid Glass, iOS 26 o successivi).
 * Su Android e sugli iPhone più vecchi `Glass` disegna una superficie traslucida.
 */
export const hasGlass = isLiquidGlassSupported;

type Props = ViewProps & {
  /** Il vetro reagisce al tocco (si allarga e brilla): per i pulsanti. */
  interactive?: boolean;
};

/**
 * Superficie di vetro. Si usa per i comandi che "galleggiano" sopra il contenuto
 * (barra in basso, pillole, pulsanti secondari), mai per il contenuto stesso.
 *
 * Due regole per chi la usa:
 * - niente `opacity` animata su un genitore: il vetro di sistema si rompe finché
 *   l'opacità non torna a 1 (le trasformazioni invece vanno bene);
 * - niente `borderWidth` sullo stile: sposterebbe i figli rispetto al vetro.
 */
export function Glass({interactive, style, children, ...rest}: Props) {
  if (hasGlass) {
    return (
      <LiquidGlassView effect="regular" colorScheme="dark" interactive={interactive} style={style} {...rest}>
        {children}
      </LiquidGlassView>
    );
  }
  return (
    <View style={[s.fallback, style]} {...rest}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // Contorno disegnato con `outline`: non occupa spazio, così le misure restano
  // identiche a quelle del vetro vero.
  fallback: {
    backgroundColor: 'rgba(44,44,46,0.72)',
    outlineWidth: StyleSheet.hairlineWidth,
    outlineColor: 'rgba(255,255,255,0.16)',
    outlineOffset: -StyleSheet.hairlineWidth,
  },
});
