package io.github.ramencoding.biometrics

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Stessa interfaccia del modulo iOS (Biometrics.m):
 * kind() -> "biometric" | "passcode" | "none"
 * authenticate(reason) -> "ok" | "cancel" | "unavailable" | "failed"
 *
 * Come su iPhone: biometria (impronta o volto), e se non va il PIN/segno del telefono.
 */
class BiometricsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "Biometrics"

  private val allowed = BIOMETRIC_WEAK or DEVICE_CREDENTIAL

  @ReactMethod
  fun kind(promise: Promise) {
    val bm = BiometricManager.from(ctx)
    promise.resolve(
        when {
          // Android non dice se è impronta o volto: per l'app è "biometria".
          bm.canAuthenticate(BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS -> "biometric"
          bm.canAuthenticate(allowed) == BiometricManager.BIOMETRIC_SUCCESS -> "passcode"
          else -> "none"
        })
  }

  @ReactMethod
  fun authenticate(reason: String, promise: Promise) {
    val activity = ctx.currentActivity as? FragmentActivity
    if (activity == null ||
        BiometricManager.from(ctx).canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS) {
      promise.resolve("unavailable")
      return
    }
    UiThreadUtil.runOnUiThread {
      var settled = false
      fun settle(result: String) {
        if (!settled) {
          settled = true
          promise.resolve(result)
        }
      }
      val prompt =
          BiometricPrompt(
              activity,
              ContextCompat.getMainExecutor(activity),
              object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(r: BiometricPrompt.AuthenticationResult) =
                    settle("ok")

                override fun onAuthenticationError(code: Int, msg: CharSequence) =
                    settle(
                        when (code) {
                          BiometricPrompt.ERROR_USER_CANCELED,
                          BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                          BiometricPrompt.ERROR_CANCELED -> "cancel"
                          BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                          BiometricPrompt.ERROR_HW_NOT_PRESENT,
                          BiometricPrompt.ERROR_HW_UNAVAILABLE -> "unavailable"
                          else -> "failed"
                        })
                // onAuthenticationFailed: dito/volto non riconosciuto, il riquadro resta aperto.
              })
      val info =
          BiometricPrompt.PromptInfo.Builder()
              .setTitle(reason)
              .setAllowedAuthenticators(allowed)
              .build()
      prompt.authenticate(info)
    }
  }
}
