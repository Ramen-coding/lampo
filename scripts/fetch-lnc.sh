#!/bin/bash
# Prepara lnc-rn dopo npm install:
# - scarica le librerie native LNC (iOS e Android), che il pacchetto npm non include;
# - sostituisce la configurazione Android di lnc-rn (AGP 3, jcenter) con una che
#   compila con React Native 0.88 (AGP 9, Gradle 9).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/node_modules/@lightninglabs/lnc-rn"
[ -d "$DIR" ] || exit 0
VERSION=$(sed -n 's/^VERSION=//p' "$DIR/fetch-libraries.sh")
BASE="https://github.com/lightninglabs/lightning-node-connect/releases/download/$VERSION"

fetch() { # piattaforma, file da controllare, destinazione
  [ -e "$2" ] && return 0
  local tmp; tmp=$(mktemp -d)
  echo "Scarico LNC $VERSION per $1…"
  curl -fsSL "$BASE/lnc-$VERSION-$1.zip" -o "$tmp/lib.zip"
  unzip -q "$tmp/lib.zip" -d "$tmp"
  mkdir -p "$3"
  mv "$tmp/$1"/* "$3/"
  rm -rf "$tmp"
}
fetch ios "$DIR/ios/Lncmobile.xcframework" "$DIR/ios"
fetch android "$DIR/android/libs/lnc-mobile.aar" "$DIR/android/libs"

cp "$ROOT/scripts/lnc-rn-android.gradle" "$DIR/android/build.gradle"
# AGP 9 non accetta più package= nel manifest delle librerie (c'è namespace nel gradle).
printf '<manifest xmlns:android="http://schemas.android.com/apk/res/android" />\n' > "$DIR/android/src/main/AndroidManifest.xml"

# lnc-rn su Android scrive nel log di sistema la frase di abbinamento e il contenuto
# di ogni richiesta (fatture, importi): si lasciano solo mailbox e nome della chiamata.
KT="$DIR/android/src/main/java/com/lnc-rn/LncModule.kt"
perl -0pi -e 's/"called with connectPhrase: " \+ connectPhrase\s*\+ " and mailboxServerAddr: "/"mailboxServerAddr: "/; s/"called with route: " \+ route\s*\+ " and requestData: " \+ requestData/"route: " + route/' "$KT"
