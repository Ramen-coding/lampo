import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Button, CameraIcon, ChipButton, PasteIcon, TextLink, colors, type} from '../components/ui';
import {Scanner} from '../components/Scanner';
import {PHRASE_WORDS, parsePairing, phraseWords} from '../lnc/pairing';

type Props = {
  onPair: (phrase: string, serverHost: string) => Promise<void>;
  onDemo: () => void;
};

export function PairScreen({onPair, onDemo}: Props) {
  const [phrase, setPhrase] = useState('');
  const [server, setServer] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const words = phraseWords(phrase).length;
  // Il QR può essere letto più volte in un attimo: un solo abbinamento alla volta.
  const pairing = useRef(false);

  async function connect(p: string, host: string) {
    if (pairing.current) return;
    pairing.current = true;
    setBusy(true);
    setError('');
    try {
      await onPair(p, host);
    } catch (e: any) {
      setError(e?.message ?? 'Abbinamento non riuscito.');
    } finally {
      pairing.current = false;
      setBusy(false);
    }
  }

  function submit() {
    const data = parsePairing(phrase);
    if (!data) {
      setError(`Servono esattamente ${PHRASE_WORDS} parole.`);
      return;
    }
    connect(data.phrase, server.trim() || data.serverHost);
  }

  /** Testo da QR o appunti: se è valido collega subito, senza altri tocchi. */
  function applyText(raw: string) {
    const data = parsePairing(raw);
    if (!data) {
      setError('Questo non sembra un codice di abbinamento Lightning Node Connect.');
      return;
    }
    setPhrase(data.phrase);
    if (data.serverHost) {
      setServer(data.serverHost);
      setShowServer(true);
    }
    connect(data.phrase, server.trim() || data.serverHost);
  }

  async function paste() {
    applyText(await Clipboard.getString());
  }

  if (scanning) {
    return (
      <View style={s.root}>
        <Scanner
          busy={false}
          hint="Inquadra il QR della sessione in Lightning Terminal"
          onScanned={value => {
            setScanning(false);
            applyText(value);
          }}
          onCancel={() => setScanning(false)}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{gap: 10}}>
        <Text style={[type.title, {color: colors.text}]}>Collega il tuo nodo</Text>
        <Text style={[type.body, {color: colors.muted, lineHeight: 24}]}>
          In Lightning Terminal crea una sessione Lightning Node Connect, poi inquadra il QR o
          incolla la frase di abbinamento.
        </Text>
      </View>

      <TextInput
        style={s.input}
        value={phrase}
        onChangeText={setPhrase}
        placeholder="dieci parole separate da spazi"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        multiline
        editable={!busy}
      />
      <Text style={[type.small, {color: colors.muted}]}>
        {words}/{PHRASE_WORDS} parole
      </Text>

      <View style={s.chips}>
        <ChipButton label="Incolla" icon={<PasteIcon size={22} />} onPress={paste} disabled={busy} />
        <ChipButton
          label="Fotocamera"
          icon={<CameraIcon size={22} />}
          onPress={() => {
            setError('');
            setScanning(true);
          }}
          disabled={busy}
        />
      </View>

      {showServer ? (
        <TextInput
          style={[s.input, {minHeight: 52}]}
          value={server}
          onChangeText={setServer}
          placeholder="mailbox.tuodominio.it:443"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
      ) : (
        <TextLink label="Uso un mailbox server mio" onPress={() => setShowServer(true)} />
      )}

      {error ? <Text style={[type.small, {color: colors.red}]}>{error}</Text> : null}
      {busy ? (
        <Text style={[type.small, {color: colors.muted}]}>
          Collegamento al nodo… la prima volta può servire qualche secondo.
        </Text>
      ) : null}

      <View style={{gap: 20, marginTop: 'auto', alignItems: 'center'}}>
        {__DEV__ ? <TextLink label="Prova la demo (nodo fittizio)" onPress={onDemo} /> : null}
        <View style={{flexDirection: 'row'}}>
          <Button label="Collega nodo" onPress={submit} disabled={words !== PHRASE_WORDS} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, padding: 24, gap: 16},
  chips: {flexDirection: 'row', gap: 20, justifyContent: 'center'},
  input: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 17,
    padding: 16,
    textAlignVertical: 'top',
  },
});
