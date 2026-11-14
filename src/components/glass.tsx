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
  /**
   * Per le superfici che coprono altri comandi (la bolla del QR sopra la barra):
   * il vetro di sistema sfoca quello che ha sotto, quello disegnato non può, quindi
   * diventa quasi opaco perché sotto non si legga niente.
   */
  solid?: boolean;
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
export function Glass({interactive, solid, style, children, ...rest}: Props) {
  if (hasGlass) {
    return (
      <LiquidGlassView effect="regular" colorScheme="dark" interactive={interactive} style={style} {...rest}>
        {children}
      </LiquidGlassView>
    );
  }
  return (
    <View style={[s.fallback, solid && s.solid, style]} {...rest}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // Vetro "disegnato" per Android e per gli iPhone senza Liquid Glass: fondo traslucido
  // (dietro si intravede la luce d'ambiente), un filo di luce sul bordo alto come un
  // riflesso e un contorno sottilissimo. Sono ombre interne: non occupano spazio, così
  // le misure restano identiche a quelle del vetro vero.
  fallback: {
    backgroundColor: 'rgba(120,120,128,0.24)',
    boxShadow: [
      {inset: true, offsetX: 0, offsetY: 1, blurRadius: 0.5, color: 'rgba(255,255,255,0.30)'},
      {inset: true, offsetX: 0, offsetY: -1, blurRadius: 0.5, color: 'rgba(255,255,255,0.08)'},
      {inset: true, offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: StyleSheet.hairlineWidth, color: 'rgba(255,255,255,0.14)'},
    ],
  },
  solid: {backgroundColor: 'rgba(34,34,37,0.97)'},
});
