// Il lettore di codici a barre (Google ML Kit) serve solo su Android:
// su iOS Lampo legge i QR con l'output nativo di VisionCamera (AVFoundation).
module.exports = {
  dependencies: {
    'react-native-vision-camera-barcode-scanner': {
      platforms: {ios: null},
    },
  },
};
