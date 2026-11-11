# Flutter
-keep class io.flutter.** { *; }
-dontwarn io.flutter.embedding.**

# ML Kit text recognition: only the Latin model is bundled.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**

# flutter_local_notifications (Gson-based scheduled notification cache)
-keep class com.dexterous.** { *; }
-keepattributes Signature
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# WorkManager background isolate
-keep class dev.fluttercommunity.workmanager.** { *; }

# Play Core (deferred components referenced by Flutter embedding)
-dontwarn com.google.android.play.core.**
