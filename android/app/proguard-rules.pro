# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Libreria Go di Lightning Node Connect (gomobile): chiamata via JNI per nome.
-keep class go.** { *; }
-keep class mobile.** { *; }
-keep class lncmobile.** { *; }
-keep class engineering.lightning.lnc.mobile.rn.** { *; }
# Moduli nativi usati via JNI/riflessione (Nitro, VisionCamera, ML Kit, biometria, archivio cifrato).
-keep class com.margelo.nitro.** { *; }
-keep class com.mrousavy.** { *; }
-keep class com.google.mlkit.** { *; }
-keep class io.github.ramencoding.** { *; }
-keep class com.emeraldsanto.encryptedstorage.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.reactnativecommunity.clipboard.** { *; }
-dontwarn go.**
-dontwarn mobile.**
