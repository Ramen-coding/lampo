# ⚡ Lampo

**A tiny remote control for your own Lightning node.**

Lampo ("lightning" in Italian) turns your phone into a remote for your LND node. It connects
through [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect)
(LNC): no open ports, no Tor, no VPN, no custodian. Your node, your keys, your sats.

It does three things and tries to do them fast:

- **Balance:** see what you have, in sats or euros (tap to switch).
- **Send:** pay invoices, Lightning Addresses and LNURL by pasting or scanning a QR.
- **Receive:** type an amount, show the QR, and see it confirmed when it's paid.

No channel management, no advanced settings. For those, use your node's own tools.

## Features

- **Pairing in seconds:** scan the LNC QR from Lightning Terminal, or paste the 10-word
  pairing phrase.
- **Fast start:** biometric unlock and the LNC handshake run in parallel. The last known
  balance is shown (greyed out) until the node answers.
- **Locked by default:** Face ID / Touch ID on iPhone, or fingerprint / face on Android,
  with the phone's passcode as a fallback. You are asked at every launch and every return
  from the background, and the balance is hidden in the app switcher.
- **Payments that go through:** fees are left uncapped and payments can split into up to
  128 parts (multi-path). A **Big payment** switch gives LND 5 minutes instead of 60 seconds
  to find a route.
- **Everything you can scan:** BOLT11 invoices, Lightning Addresses (`name@domain`), LNURL
  (`lnurl1…`, `lnurlp://`) and `bitcoin:…?lightning=…` QR codes. The QR button on the home
  screen opens the camera straight away.
- **Sats ⇄ euros:** tap the balance. The BTC/EUR rate comes from
  [mempool.space](https://mempool.space), which only receives the price request and never
  your balance. The last rate is kept for offline use.
- **AMOLED black theme**, and swipe back from anywhere on the screen.
- **Demo mode** (development builds only): try the app against a fake node.

## Platforms

| Platform | Status |
| --- | --- |
| iOS 15.1+ | Used daily on a real node |
| Android 7.0+ | New: runs in the emulator, not yet tried on a real phone or node |

Both apps share the same React Native code. Only the LNC library and the biometric unlock
module are native per platform.

## Security

- The link between the app and Lightning Terminal is end-to-end encrypted (Noise handshake
  with SPAKE2). The mailbox server in the middle only relays ciphertext.
- The 10-word phrase is used once, to pair. After that the app uses keys stored in the iOS
  Keychain or Android encrypted storage, and they never leave the phone.
- In Lightning Terminal, create a **Custom** session with only the permissions Lampo needs:
  read balance, create invoices and send payments. Don't use an Admin session.
- You can use your own mailbox server: tap "Uso un mailbox server mio" when pairing.

## Project layout

```
App.tsx                       startup, lock, reconnection, navigation
src/lnc/node.ts               the only place that talks to the node (LNC)
src/lnc/pairing.ts            reads pairing data from QR codes, links and pasted text
src/lnc/lightningAddress.ts   input detection, Lightning Address and LNURL-pay
src/lnc/credentialStore.ts    LNC keys in secure storage
src/lnc/demoNode.ts           fake node for demo mode
src/price.ts                  BTC/EUR rate and euro formatting
src/screens/                  Pair, Lock, Home, Send, Receive
src/components/               UI kit, QR scanner
modules/biometrics/           native unlock module (iOS LocalAuthentication, Android BiometricPrompt)
scripts/fetch-lnc.sh          downloads the LNC native libraries (runs on npm install)
scripts/make-icon.swift       draws the app icon and logo
ios/  android/                native projects
```

## Building

You need Node ≥ 22.

```bash
npm install   # also downloads the LNC libraries for iOS and Android
```

**iOS:** Xcode and CocoaPods.

```bash
cd ios && pod install && cd ..
npx react-native start
```

Then open `ios/TelecomandoLnc.xcworkspace` in Xcode and run it on a simulator or an iPhone.

**Android:** JDK 17 and the Android SDK (platform 37, NDK 27.1, CMake 3.22).

```bash
npx react-native run-android
```

## Notes

The UI is in Italian for now. The internal project name is still `TelecomandoLnc`
(Italian for "LNC remote control"); the app is called Lampo.

Lampo is built on [`@lightninglabs/lnc-rn`](https://github.com/lightninglabs/lnc-rn) by
Lightning Labs.
