# ⚡ Lampo

**A simple remote for paying with your own Lightning node, on the go.**

Lampo ("lightning" in Italian) is a small, light app that connects your phone to your LND
node through [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect)
(LNC). No open ports, no Tor, no VPN, no custodian.

It is **not a node manager**. It does three things: show your balance, send and receive.
For channels and everything else, use your node's own tools.

> **Beta.** Lampo is a personal project that does this one job. It doesn't aim to be the
> reference app for anything. Use it with amounts you are comfortable with.

## Download

| Platform | How |
| --- | --- |
| Android 7.0+ | [**Download the APK**](https://github.com/Ramen-coding/lampo/releases/latest/download/Lampo-android-arm64.apk) (arm64, most phones). Older 32-bit phones: [armv7 APK](https://github.com/Ramen-coding/lampo/releases/latest/download/Lampo-android-armv7.apk). |
| iOS 15.1+ | No store build yet: [build it with Xcode](#build-it-yourself). |

On Android, open the APK and allow the install when asked. The beta is signed with a test
key, so Play Protect may warn you.

## Use it

1. In Lightning Terminal, create an LNC session. Pick **Custom** and allow only what Lampo
   needs: read balance, create invoices, send payments.
2. Open Lampo and scan the session QR, or paste the 10-word pairing phrase.
3. Done. From now on the app opens with Face ID, fingerprint or your phone passcode.

- **Pay:** tap the QR button and scan, or paste an invoice, a Lightning Address
  (`name@domain`) or an LNURL. For large amounts, turn on **Pagamento grosso** to give the
  node up to 5 minutes to find a route.
- **Receive:** type an amount and show the QR.
- **Balance:** tap it to switch between sats and euros.

The interface is in Italian for now.

## Security

- The link to your node is end-to-end encrypted. The mailbox server in the middle only
  relays ciphertext.
- The pairing phrase is used once. After that the app uses keys kept in the iOS Keychain or
  Android encrypted storage.
- Fees are uncapped and payments can split into up to 128 parts, so they go through. Check
  the fee shown after each payment.
- LNURL and Lightning Addresses are only contacted over https.

## Build it yourself

You need Node ≥ 22.

```bash
npm install
```

**iOS** (Xcode and CocoaPods):

```bash
cd ios && pod install && cd ..
```

Then open `ios/TelecomandoLnc.xcworkspace` in Xcode. Under *Signing & Capabilities*, pick
your own team and change the bundle identifier, then run it on your iPhone.

**Android** (JDK 17 and the Android SDK):

```bash
npx react-native run-android
```

Built with React Native on [`@lightninglabs/lnc-rn`](https://github.com/lightninglabs/lnc-rn).
