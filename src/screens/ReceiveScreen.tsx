import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import {AmountInput, Button, ScreenHeader, Stage, SuccessBadge, colors, field, type} from '../components/ui';
import {KeyboardFrame} from '../components/KeyboardFrame';
import {createInvoice, parseAmount, watchInvoice} from '../lnc/node';
import {formatSat} from '../cache';

type Step =
  | {kind: 'amount'}
  | {kind: 'waiting'; invoice: string; amount: number}
  | {kind: 'paid'; amount: number};

export function ReceiveScreen({onClose, onReceived}: {onClose: () => void; onReceived: () => void}) {
  const [step, setStep] = useState<Step>({kind: 'amount'});
  const [amountText, setAmountText] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const stopWatching = useRef<(() => void) | null>(null);

  // Chiudendo la schermata si smette di controllare la fattura.
  useEffect(() => () => stopWatching.current?.(), []);

  const amount = parseAmount(amountText);

  async function create() {
    setBusy(true);
    setError('');
    try {
      const created = await createInvoice(amount, memo.trim());
      const invoice = created.paymentRequest;
      setStep({kind: 'waiting', invoice, amount});
      stopWatching.current = watchInvoice(created, sat => {
        setStep({kind: 'paid', amount: sat || amount});
        onReceived();
      });
    } catch (e: any) {
      setError(e?.message ?? 'Non è stato possibile creare la richiesta.');
    } finally {
      setBusy(false);
    }
  }

  function copy(invoice: string) {
    Clipboard.setString(invoice);
    setCopied(true);
  }

  return (
    // Lo spazio del tastierino è riservato da subito: il contenuto compare già al suo posto.
    <KeyboardFrame kind={step.kind === 'amount' ? 'number' : null} style={s.root}>
      <ScreenHeader title="Ricevi" onClose={onClose} />

      {step.kind === 'amount' && (
        <View style={s.fill}>
          <Stage
            error={error}
            main={
              <View style={s.amount}>
                <AmountInput value={amountText} onChange={setAmountText} />
                <Text style={[type.body, {color: colors.muted}]}>sat</Text>
              </View>
            }
            second={
              <TextInput
                style={s.memo}
                value={memo}
                onChangeText={setMemo}
                placeholder="Descrizione (facoltativa)"
                placeholderTextColor={colors.muted}
                keyboardAppearance="dark"
                maxLength={120}
              />
            }
          />
          <View style={s.row}>
            <Button label="Crea richiesta" onPress={create} loading={busy} disabled={!amount} />
          </View>
        </View>
      )}

      {step.kind === 'waiting' && (
        <View style={s.body}>
          <View style={s.qr}>
            <QRCode value={step.invoice.toUpperCase()} size={248} backgroundColor="#FFFFFF" color="#000000" />
          </View>
          <Text style={[type.title, s.waitingAmount]}>{formatSat(step.amount)} sat</Text>
          <Text style={[type.small, {color: colors.muted}]}>In attesa del pagamento</Text>
          <View style={[s.row, s.bottom]}>
            <Button
              label={copied ? 'Fattura copiata' : 'Copia fattura'}
              variant="secondary"
              onPress={() => copy(step.invoice)}
            />
          </View>
        </View>
      )}

      {step.kind === 'paid' && (
        <View style={s.body}>
          <View style={s.center}>
            <SuccessBadge />
            <Text style={[type.title, {color: colors.green}]}>Ricevuti</Text>
            <Text style={[type.balance, {color: colors.text}]}>{formatSat(step.amount)}</Text>
            <Text style={[type.body, {color: colors.muted}]}>sat</Text>
          </View>
          <View style={s.row}>
            <Button label="Fatto" onPress={onClose} />
          </View>
        </View>
      )}
    </KeyboardFrame>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, padding: 24, paddingBottom: 16, gap: 20},
  // Come in Invia: stessa distanza tra il blocco centrale e il pulsante.
  fill: {flex: 1, gap: 16},
  body: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
  row: {flexDirection: 'row', alignSelf: 'stretch'},
  bottom: {marginTop: 'auto'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
  amount: {alignItems: 'center', gap: 2},
  memo: {...field, flex: 1},
  waitingAmount: {color: colors.text, marginTop: 20},
  qr: {padding: 16, backgroundColor: '#FFFFFF', borderRadius: 28},
});
