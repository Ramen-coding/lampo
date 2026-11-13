// Nei test non c'è il vetro di sistema: si prova l'app come su un telefono che non lo ha.
const {View} = require('react-native');

module.exports = {
  LiquidGlassView: View,
  LiquidGlassContainerView: View,
  isLiquidGlassSupported: false,
};
