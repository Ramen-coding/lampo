import React, {useEffect, useRef} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {formatSat} from '../cache';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {Glass} from './glass';

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
  fill: 'rgba(255,255,255,0.10)', // ovali dentro il vetro (Ricevi, QR)
  field: 'rgba(255,255,255,0.06)', // campi di testo
  hairline: 'rgba(255,255,255,0.14)',
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
  const content = loading ? (
    <ActivityIndicator color={primary ? colors.bg : colors.text} />
  ) : (
    <Text style={[s.buttonText, {color: primary ? colors.bg : colors.text}]}>{label}</Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [s.buttonWrap, (disabled || loading) && s.dimmed, pressed && s.pressed]}>
      {primary ? (
        <View style={[s.button, s.primary]}>{content}</View>
      ) : (
        // Il pulsante secondario è una capsula di vetro.
        <Glass interactive style={s.button}>
          {content}
        </Glass>
      )}
    </Pressable>
  );
}

export function TextLink({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <Text style={[type.small, s.link]}>{label}</Text>
    </Pressable>
  );
}

/** Pillola di vetro con una parola: i comandi in alto ("Chiudi", "Scollega"). */
export function PillButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={({pressed}) => pressed && s.pressed}>
      <Glass interactive style={s.pill}>
        <Text style={s.pillText}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/** Titolo della schermata e pillola "Chiudi": uguale in Invia e Ricevi. */
export function ScreenHeader({title, onClose}: {title: string; onClose: () => void}) {
  return (
    <View style={s.header}>
      <Text style={[type.title, {color: colors.text}]}>{title}</Text>
      <PillButton label="Chiudi" onPress={onClose} />
    </View>
  );
}

export type LinkState = 'connecting' | 'online' | 'offline';

const STATUS: Record<LinkState, {color: string; label: string}> = {
  online: {color: colors.green, label: 'Nodo collegato'},
  connecting: {color: colors.amber, label: 'Collegamento al nodo…'},
  offline: {color: colors.red, label: 'Nodo non raggiungibile'},
};

export function StatusLine({state}: {state: LinkState}) {
  return (
    <View style={s.status}>
      <StatusDot state={state} />
      <Text style={[type.small, {color: colors.muted}]}>{STATUS[state].label}</Text>
    </View>
  );
}

/** Lo stato del nodo dentro una pillola di vetro (in alto nella Home). */
export function StatusPill({state}: {state: LinkState}) {
  return (
    <Glass style={[s.pill, s.status]} accessibilityLabel={STATUS[state].label}>
      <StatusDot state={state} />
      <Text style={s.pillText}>{STATUS[state].label}</Text>
    </Glass>
  );
}

/** Il pallino di stato: mentre il nodo si collega "respira". */
function StatusDot({state}: {state: LinkState}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== 'connecting') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 0.3, duration: 600, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1, duration: 600, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);
  return <Animated.View style={[s.dot, {backgroundColor: STATUS[state].color, opacity: pulse}]} />;
}

const s = StyleSheet.create({
  buttonWrap: {flex: 1},
  // Capsula: stessa forma degli ovali nella barra della Home.
  button: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {backgroundColor: colors.amber},
  buttonText: {fontSize: 18, fontWeight: '600'},
  dimmed: {opacity: 0.4},
  pressed: {transform: [{scale: 0.97}]},
  link: {color: colors.muted, textDecorationLine: 'underline'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  pill: {height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center'},
  pillText: {fontSize: 15, fontWeight: '500', color: colors.text},
  status: {flexDirection: 'row', alignItems: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  chip: {width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center'},
  amountInput: {color: colors.text, textAlign: 'center', minWidth: 120, padding: 0},
  stage: {flex: 1, alignSelf: 'stretch'},
  stageTop: {flex: 2, justifyContent: 'flex-end'},
  stageError: {paddingBottom: 10},
  // Se lo spazio non basta (schermo basso, tastiera alta) è il campo a stringersi: mai sovrapposizioni.
  stageMain: {justifyContent: 'center', flexShrink: 1, minHeight: 64},
  stageSecond: {height: 52, marginTop: 16, justifyContent: 'center'},
  stageBottom: {flex: 1},
  error: {color: colors.red, textAlign: 'center'},
  badge: {width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14},
});

/** Aspetto comune dei campi di testo (fattura, descrizione, frase di abbinamento). */
export const field = {
  borderRadius: 20,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.hairline,
  backgroundColor: colors.field,
  color: colors.text,
  fontSize: 17,
  paddingHorizontal: 16,
} as const;

/**
 * La parte centrale di Invia e Ricevi: un campo grande e, sotto, una riga da 52 punti
 * (descrizione oppure Incolla e Fotocamera). Le misure sono fisse e uguali nelle due
 * schermate, così il blocco sta alla stessa altezza: a due terzi dello spazio che resta
 * sopra la tastiera, comodo per il pollice e mai coperto dai tasti.
 */
export function Stage({
  main,
  second,
  error,
}: {
  main: React.ReactNode;
  second: React.ReactNode;
  error?: string;
}) {
  // Sugli schermi bassi (iPhone SE) il campo si accorcia per lasciare posto alla tastiera.
  const {height} = useWindowDimensions();
  const mainHeight = height < 700 ? 96 : 120;
  return (
    <View style={s.stage}>
      <View style={s.stageTop}>
        {error ? (
          <Text style={[type.small, s.error, s.stageError]} numberOfLines={3}>
            {error}
          </Text>
        ) : null}
      </View>
      <View style={[s.stageMain, {height: mainHeight}]}>{main}</View>
      <View style={s.stageSecond}>{second}</View>
      <View style={s.stageBottom} />
    </View>
  );
}

/** Spunta verde in una bolla di vetro che "sboccia": pagamento inviato o ricevuto. */
export function SuccessBadge() {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, {toValue: 1, damping: 14, stiffness: 420, mass: 0.6, useNativeDriver: true}).start();
  }, [pop]);
  return (
    <Animated.View style={{transform: [{scale: pop}]}}>
      <Glass style={s.badge}>
        <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.green} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Glass>
    </Animated.View>
  );
}

/** Freccia di Ricevi (verso il basso a sinistra) e di Invia (verso l'alto a destra). */
export function ArrowIcon({direction, size = 18, color = colors.text}: {direction: 'in' | 'out'; size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === 'out' ? 'M7 17L17 7M9 7h8v8' : 'M17 7L7 17M7 9v8h8'}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
      {/* Il contorno della tavoletta si interrompe dietro la molletta: niente riempimenti, sta bene anche sul vetro. */}
      <Path
        d="M15 4h1.5A2.5 2.5 0 0 1 19 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5v-12A2.5 2.5 0 0 1 7.5 4H9"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Rect x={9} y={2.5} width={6} height={3.5} rx={1.2} stroke={color} strokeWidth={1.6} />
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

/** Pulsante tondo di vetro: solo icona (l'etichetta resta per VoiceOver). */
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
      style={({pressed}) => [pressed && s.pressed, disabled && s.dimmed]}>
      <Glass interactive style={s.chip}>
        {icon}
      </Glass>
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
      keyboardAppearance="dark"
      autoFocus
    />
  );
}
