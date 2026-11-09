# Lampo (iOS)

App iOS minimale per usare il proprio nodo LND da iPhone tramite Lightning Node Connect:
saldo, Invia, Ricevi. Niente canali, niente impostazioni avanzate, niente Tor o VPN.

## Come funziona

- **Apertura veloce**: all'avvio partono insieme Face ID e l'handshake LNC. Quando il volto
  è riconosciuto il collegamento è spesso già pronto; nel frattempo si vede l'ultimo saldo
  salvato (in grigio) finché il nodo non risponde.
- **Blocco**: Face ID (o il codice del telefono) viene chiesto a ogni apertura e ogni volta
  che l'app torna dal background. Nell'anteprima del multitasking il saldo è coperto.
- **Invia**: campo per fattura Lightning, Lightning Address (`nome@dominio`) o link LNURL
  (`lnurl1…`, `lnurlp://`); sotto, Incolla e Fotocamera. Il tasto QR in Home apre subito
  la fotocamera. Legge anche i QR `bitcoin:…?lightning=…`.
- **Pagamenti**: commissioni libere (tetto di 1 BTC, perché in LND 0 = "solo route gratuite")
  e fino a 128 parti per pagamento (multi-path), per la massima probabilità di successo.
- **Ricevi**: importo, QR della fattura, conferma quando viene pagata.
- **Tema AMOLED**, swipe da sinistra verso destra per tornare indietro.
- **Demo** (solo build di sviluppo): "Prova la demo" nella schermata di abbinamento usa un
  nodo fittizio per vedere l'app senza collegarsi.

## Struttura

```
App.tsx                         avvio, blocco Face ID, riconnessione, navigazione
src/lnc/node.ts                 unico punto di contatto con il nodo (LNC)
src/lnc/demoNode.ts             nodo fittizio per la demo
src/lnc/lightningAddress.ts     riconoscimento input, Lightning Address e LNURL-pay
src/lnc/credentialStore.ts      chiavi LNC nel Keychain
src/cache.ts                    saldo in cache, formattazione
src/components/ui.tsx           colori, tipografia, pulsanti, icone
src/screens/                    Abbina, Blocco, Home, Invia, Ricevi
modules/biometrics/             modulo nativo Face ID (LocalAuthentication)
scripts/fetch-lnc-ios.sh        scarica il framework LNC per iOS (postinstall)
```

## Setup

Servono Node ≥ 22, Xcode e CocoaPods (`brew install cocoapods`).

```
npm install            # scarica anche Lncmobile.xcframework (script postinstall)
cd ios && pod install && cd ..
npx react-native start # Metro, per le build di sviluppo
```

Poi apri `ios/TelecomandoLnc.xcworkspace` in Xcode e avvia su simulatore o iPhone.

## Sicurezza

- Il collegamento è cifrato da un capo all'altro tra app e Lightning Terminal: la frase
  di 10 parole serve solo al primo abbinamento (handshake Noise + SPAKE2), poi si usano
  chiavi salvate nel Keychain. Il mailbox server inoltra solo dati cifrati.
- In Lightning Terminal crea una sessione **Custom** con i soli permessi necessari
  (lettura saldo, creazione fatture, pagamenti), non una sessione Admin.
- Le chiavi LNC restano solo nel Keychain del telefono.
- Se usi un mailbox server tuo, inseriscilo al primo abbinamento.

## Prossimi passi

- Icona dell'app
- Prova completa con un nodo vero (abbinamento, invio, ricezione)
- Mailbox server self-hosted su VPS europeo per ridurre la latenza
