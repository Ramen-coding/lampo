import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Pressable, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Scanner} from '../components/Scanner';
import {AmountInput, Button, CameraIcon, ChipButton, PasteIcon, TextLink, colors, type} from '../components/ui';
import {DecodedInvoice, PAYMENT_TIMEOUT_S, decodeInvoice, isDemo, parseAmount, payInvoice} from '../lnc/node';
import {PayRequest, classifyInput, fetchInvoice, resolveAddress, resolveLnurl} from '../lnc/lightningAddress';
import {formatSat} from '../cache';

type Step =
  | {kind: 'input'}
  | {kind: 'scan'}
  | {kind: 'confirm'; inv: DecodedInvoice}
  | {kind: 'address'; req: PayRequest}
  | {kind: 'paying'; amount: number}
  | {kind: 'done'; amount: number; feeSat: number}
  | {kind: 'error'; message: string};

type Props = {
  onClose: () => void;
  onPaid: () => void;
  /** Apre direttamente la fotocamera (tasto QR della Home). */
  startWithScan?: boolean;
};

export function SendScreen({onClose, onPaid, startWithScan}: Props) {
  const [step, setStep] = useState<Step>(startWithScan ? {kind: 'scan'} : {kind: 'input'});
  const [text, setText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputError, setInputError] = useState('');
  const handled = useRef(false);
  // Un solo pagamento per volta anche con doppio tocco veloce su "Paga".
  const payingRef = useRef(false);
  // Pagamento grosso: LND ha più tempo per frazionare e riprovare altre strade.
  const [big, setBig] = useState(false);

  /** Da testo (digitato, incollato o scansionato) al passo successivo. */
  async function proceed(raw: string) {
    setInputError('');
    const input = classifyInput(raw);
    if (input.kind === 'unknown') {
      setInputError('Non riconosco questo testo: serve una fattura Lightning, un indirizzo nome@dominio o un LNURL.');
      setStep({kind: 'input'});
      return;
    }
    setBusy(true);
    try {
      if (input.kind === 'address' || input.kind === 'lnurl') {
        const req =
          input.kind === 'address' ? await resolveAddress(input.address) : await resolveLnurl(input.url);
        setAmountText('');
        setBig(false);
        setStep({kind: 'address', req});
      } else {
        const inv = await decodeInvoice(input.invoice);
        if (inv.expiresAt < Date.now()) {
          throw new Error('Questa fattura è scaduta. Chiedine una nuova.');
        }
        setAmountText('');
        setBig(false);
        setStep({kind: 'confirm', inv});
      }
    } catch (e: any) {
      setInputError(e?.message ?? 'Non è stato possibile leggere il destinatario.');
      setStep({kind: 'input'});
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    const value = isDemo() ? 'lnbc210u1pdemo' : (await Clipboard.getString()).trim();
    if (!value) {
      setInputError('Negli appunti non c’è niente da incollare.');
      return;
    }
    setText(value);
    proceed(value);
  }

  function openScanner() {
    handled.current = false;
    setInputError('');
    setStep({kind: 'scan'});
  }

  function onScanned(value: string) {
    if (handled.current) return;
    handled.current = true;
    setText(value);
    proceed(value);
  }

  async function pay(invoice: DecodedInvoice, amount: number) {
    if (payingRef.current) return;
    payingRef.current = true;
    setStep({kind: 'paying', amount});
    try {
      const {feeSat} = await payInvoice(invoice, amount, big ? 'big' : 'normal');
      setStep({kind: 'done', amount, feeSat});
      onPaid();
    } catch (e: any) {
      setStep({kind: 'error', message: e?.message ?? 'Pagamento non riuscito.'});
    } finally {
      payingRef.current = false;
    }
  }

  async function payAddress(req: PayRequest) {
    if (payingRef.current) return;
    const amount = parseAmount(amountText);
    setStep({kind: 'paying', amount});
    let inv: DecodedInvoice;
    try {
      payingRef.current = true;
      const pr = await fetchInvoice(req, amount);
      inv = await decodeInvoice(pr);
      // Il servizio deve restituire una fattura esattamente dell'importo chiesto.
      if (inv.amountSat !== amount) {
        throw new Error('La fattura ricevuta non corrisponde all’importo: pagamento annullato.');
      }
    } catch (e: any) {
      setStep({kind: 'error', message: e?.message ?? 'Pagamento non riuscito.'});
      return;
    } finally {
      payingRef.current = false;
    }
    await pay(inv, amount);
  }

  function restart() {
    setText('');
    setAmountText('');
    setInputError('');
    setStep({kind: 'input'});
  }

  return (
    // Il tastierino non deve coprire il pulsante in basso.
    <KeyboardAvoidingView style={s.root} behavior="padding">
      <View style={s.header}>
        <Text style={[type.title, {color: colors.text}]}>Invia</Text>
        <TextLink label="Chiudi" onPress={onClose} />
      </View>

      {step.kind === 'input' && (
        <View style={s.fill}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={t => {
              setText(t);
              setInputError('');
            }}
            placeholder="Fattura Lightning o indirizzo nome@dominio"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="go"
            onSubmitEditing={() => text.trim() && proceed(text)}
          />
          <View style={s.chips}>
            <ChipButton label="Incolla" icon={<PasteIcon size={22} />} onPress={paste} />
            <ChipButton label="Fotocamera" icon={<CameraIcon size={22} />} onPress={openScanner} />
          </View>
          {inputError ? <Text style={[type.small, {color: colors.red}]}>{inputError}</Text> : null}
          <View style={[s.row, {marginTop: 'auto'}]}>
            <Button label="Continua" onPress={() => proceed(text)} disabled={!text.trim()} loading={busy} />
          </View>
        </View>
      )}

      {step.kind === 'scan' && (
        <Scanner
          busy={busy}
          onScanned={onScanned}
          onCancel={() => {
            handled.current = false;
            // Aperta dal tasto QR della Home: Annulla torna alla Home, non al modulo Invia.
            if (startWithScan) onClose();
            else setStep({kind: 'input'});
          }}
        />
      )}

      {step.kind === 'confirm' && (
        <View style={s.fill}>
          <View style={s.center}>
            {step.inv.amountSat > 0 ? (
              <Text style={[type.balance, {color: colors.text}]}>{formatSat(step.inv.amountSat)}</Text>
            ) : (
              <AmountInput value={amountText} onChange={setAmountText} />
            )}
            <Text style={[type.body, {color: colors.muted}]}>sat</Text>
            {step.inv.description ? (
              <Text style={[type.body, s.description]}>{step.inv.description}</Text>
            ) : null}
          </View>
          <BigToggle value={big} onChange={setBig} />
          <View style={s.row}>
            <Button
              label="Paga"
              onPress={() => pay(step.inv, step.inv.amountSat || parseAmount(amountText))}
              disabled={!step.inv.amountSat && !parseAmount(amountText)}
            />
          </View>
        </View>
      )}

      {step.kind === 'address' && (
        <View style={s.fill}>
          <View style={s.center}>
            <AmountInput value={amountText} onChange={setAmountText} />
            <Text style={[type.body, {color: colors.muted}]}>sat</Text>
            <Text style={[type.body, s.description]}>a {step.req.address}</Text>
            {step.req.description && step.req.description !== `Pagamento a ${step.req.address}` ? (
              <Text style={[type.small, {color: colors.muted, textAlign: 'center'}]}>{step.req.description}</Text>
            ) : null}
            <Text style={[type.small, {color: colors.muted, marginTop: 8}]}>
              Da {formatSat(step.req.minSat)} a {formatSat(step.req.maxSat)} sat
            </Text>
          </View>
          <BigToggle value={big} onChange={setBig} />
          <View style={s.row}>
            <Button label="Paga" onPress={() => payAddress(step.req)} disabled={!parseAmount(amountText)} />
          </View>
        </View>
      )}

      {step.kind === 'paying' && (
        <View style={s.fill}>
          <View style={s.center}>
            <Text style={[type.balance, {color: colors.text}]}>{formatSat(step.amount)}</Text>
            <Text style={[type.body, {color: colors.muted}]}>sat</Text>
            <Text style={[type.small, {color: colors.muted, marginTop: 20, textAlign: 'center'}]}>
              {big ? 'Pagamento grosso in corso… può servire fino a 5 minuti.' : 'Pagamento in corso…'}
            </Text>
          </View>
          <View style={s.row}>
            <Button label="Paga" onPress={() => {}} loading />
          </View>
        </View>
      )}

      {step.kind === 'done' && (
        <View style={s.fill}>
          <View style={s.center}>
            <Text style={[type.title, {color: colors.green}]}>Pagato</Text>
            <Text style={[type.balance, {color: colors.text}]}>{formatSat(step.amount)}</Text>
            <Text style={[type.body, {color: colors.muted}]}>sat</Text>
            <Text style={[type.small, {color: colors.muted, marginTop: 12}]}>
              Commissione {formatSat(step.feeSat)} sat
            </Text>
          </View>
          <View style={s.row}>
            <Button label="Fatto" onPress={onClose} />
          </View>
        </View>
      )}

      {step.kind === 'error' && (
        <View style={s.fill}>
          <View style={s.center}>
            <Text style={[type.body, {color: colors.red, textAlign: 'center'}]}>{step.message}</Text>
          </View>
          <View style={s.row}>
            <Button label="Riprova" onPress={restart} />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Interruttore "Pagamento grosso": più tempo a LND per frazionare e riprovare. */
function BigToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  return (
    <Pressable style={s.toggle} onPress={() => onChange(!value)} accessibilityRole="switch">
      <View style={{flex: 1, gap: 2}}>
        <Text style={[type.body, {color: colors.text}]}>Pagamento grosso</Text>
        <Text style={[type.small, {color: colors.muted}]}>
          Tentativi fino a {Math.round(PAYMENT_TIMEOUT_S.big / 60)} minuti invece di {PAYMENT_TIMEOUT_S.normal} secondi
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{true: colors.amber, false: colors.line}} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  root: {flex: 1, padding: 24, gap: 20, backgroundColor: colors.bg},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  fill: {flex: 1, gap: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
  row: {flexDirection: 'row', gap: 12, alignSelf: 'stretch'},
  chips: {flexDirection: 'row', gap: 20, justifyContent: 'center'},
  input: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 17,
    padding: 16,
    textAlignVertical: 'top',
  },
  description: {color: colors.text, marginTop: 20, textAlign: 'center'},
});
