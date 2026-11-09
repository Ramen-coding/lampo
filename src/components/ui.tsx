import React from 'react';
import {ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {formatSat} from '../cache';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

/** Nome mostrato nell'app (unico punto da cambiare quando scegliamo il nome). */
export const APP_NAME = 'Lampo';

/**
 * Logo e nome al centro, identici alla schermata d'avvio di iOS (LaunchScreen.storyboard):
 * immagine 200×200 centrata sullo schermo intero, nome 8 punti sotto.
 * Se cambi qui, cambia anche lo storyboard, altrimenti all'apertura il logo "salta".
 */
export function BrandMark() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={brand.center}>
        {/* Stessa immagine dello storyboard, dal catalogo dell'app: pronta subito, niente attesa del caricamento. */}
        <Image source={{uri: 'BrandLogo'}} style={brand.logo} fadeDuration={0} />
      </View>
      <Text style={brand.name}>{APP_NAME}</Text>
    </View>
  );
}

const brand = StyleSheet.create({
  center: {...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center'},
  logo: {width: 200, height: 200},
  // metà schermo + metà logo + 8 punti di distacco
  name: {position: 'absolute', top: '50%', marginTop: 108, alignSelf: 'center', fontSize: 34, fontWeight: '700', color: '#FFFFFF'},
});

// Tema AMOLED: nero puro (pixel spenti sugli schermi OLED) e testo bianco.
export const colors = {
  bg: '#000000', // sfondo
  panel: '#0E0E0E', // superfici (campi, pulsanti secondari)
  line: '#262626', // bordi
  text: '#FFFFFF',
  muted: '#8E8E93',
  amber: '#F7931A', // arancio bitcoin: solo per l'azione principale
  green: '#30D158',
  red: '#FF453A',
};

export const type = {
  balance: {fontSize: 56, fontWeight: '600' as const, letterSpacing: -1.5, fontVariant: ['tabular-nums' as const]},
  title: {fontSize: 22, fontWeight: '600' as const},
  body: {fontSize: 17},
  small: {fontSize: 14},
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({label, onPress, variant = 'primary', disabled, loading}: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        s.button,
        primary ? s.primary : s.secondary,
        (disabled || loading) && {opacity: 0.4},
        pressed && {transform: [{scale: 0.98}]},
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.bg : colors.text} />
      ) : (
        <Text style={[s.buttonText, {color: primary ? colors.bg : colors.text}]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextLink({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <Text style={[type.small, {color: colors.muted, textDecorationLine: 'underline'}]}>{label}</Text>
    </Pressable>
  );
}

export type LinkState = 'connecting' | 'online' | 'offline';

export function StatusLine({state}: {state: LinkState}) {
  const color = state === 'online' ? colors.green : state === 'connecting' ? colors.amber : colors.red;
  const label = state === 'online' ? 'Nodo collegato' : state === 'connecting' ? 'Collegamento al nodo…' : 'Nodo non raggiungibile';
  return (
    <View style={s.status}>
      <View style={[s.dot, {backgroundColor: color}]} />
      <Text style={[type.small, {color: colors.muted}]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  button: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flex: 1,
  },
  primary: {backgroundColor: colors.amber},
  secondary: {borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.panel},
  buttonText: {fontSize: 18, fontWeight: '600'},
  status: {flexDirection: 'row', alignItems: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  chip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInput: {color: colors.text, textAlign: 'center', minWidth: 120},
  iconButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Icona QR (tre mirini + moduli), disegnata in SVG per restare nitida. */
export function QrIcon({size = 26, color = colors.text}: {size?: number; color?: string}) {
  const finder = (x: number, y: number) => (
    <>
      <Rect x={x + 0.75} y={y + 0.75} width={6.5} height={6.5} rx={1.5} stroke={color} strokeWidth={1.5} fill="none" />
      <Rect x={x + 2.75} y={y + 2.75} width={2.5} height={2.5} rx={0.5} fill={color} />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {finder(2, 2)}
      {finder(14, 2)}
      {finder(2, 14)}
      <Path d="M14 14h3v3h-3zM19 14h3v3h-3zM14 19h3v3h-3zM17 17h2v2h-2zM19 19h3v3h-3z" fill={color} />
    </Svg>
  );
}

/** Icona appunti (contorno sottile). */
export function PasteIcon({size = 18, color = colors.text}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={17} rx={2.5} stroke={color} strokeWidth={1.6} />
      <Rect x={9} y={2.5} width={6} height={3.5} rx={1.2} stroke={color} strokeWidth={1.6} fill={colors.bg} />
      <Path d="M9 11h6M9 15h4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Icona fotocamera (contorno sottile). */
export function CameraIcon({size = 18, color = colors.text}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.5} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

/** Pulsante minimal tondo: solo icona (l'etichetta resta per VoiceOver). */
export function ChipButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({pressed}) => [s.chip, pressed && {backgroundColor: colors.panel}, disabled && {opacity: 0.4}]}>
      {icon}
    </Pressable>
  );
}

/** Pulsante tondo con icona (es. il QR tra Ricevi e Invia). */
export function IconButton({
  onPress,
  disabled,
  label,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({pressed}) => [
        s.iconButton,
        disabled && {opacity: 0.4},
        pressed && {transform: [{scale: 0.94}]},
      ]}>
      {children}
    </Pressable>
  );
}

/**
 * Campo importo grande. Tiene in stato solo le cifre ("5000") ma mostra
 * il numero con il punto delle migliaia ("5.000"), come nel resto dell'app.
 */
export function AmountInput({value, onChange}: {value: string; onChange: (digits: string) => void}) {
  return (
    <TextInput
      style={[type.balance, s.amountInput]}
      value={value ? formatSat(Number(value)) : ''}
      onChangeText={t => onChange(t.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10))}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={colors.muted}
      autoFocus
    />
  );
}
