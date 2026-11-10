package io.github.ramencoding.lampo

import android.os.Bundle
import android.view.WindowManager.LayoutParams.FLAG_SECURE
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /** Nome del componente registrato in index.js (lo stesso di iOS, da app.json). */
  override fun getMainComponentName(): String = "TelecomandoLnc"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // null: le schermate le ricrea React (richiesto da react-native-screens).
    super.onCreate(null)
    // Saldo e fatture non compaiono nelle app recenti, negli screenshot o nelle registrazioni.
    if (!BuildConfig.DEBUG) window.setFlags(FLAG_SECURE, FLAG_SECURE)
  }
}
