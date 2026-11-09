#!/bin/bash
# Scarica il framework LNC per iOS (solo iOS, non Android) dentro lnc-rn.
# lnc-rn non lo include nel pacchetto npm; il podspec lo usa da ios/Lncmobile.xcframework.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/node_modules/@lightninglabs/lnc-rn"
[ -d "$DIR" ] || exit 0
[ -d "$DIR/ios/Lncmobile.xcframework" ] && exit 0
VERSION=$(sed -n 's/^VERSION=//p' "$DIR/fetch-libraries.sh")
URL="https://github.com/lightninglabs/lightning-node-connect/releases/download/$VERSION/lnc-$VERSION-ios.zip"
TMP=$(mktemp -d)
echo "Scarico LNC $VERSION per iOS…"
curl -fsSL "$URL" -o "$TMP/ios.zip"
unzip -q "$TMP/ios.zip" -d "$TMP"
mv "$TMP/ios/Lncmobile.xcframework" "$DIR/ios/"
rm -rf "$TMP"
