# Release shrinking (R8). Flutter's Gradle plugin already supplies the keep rules the
# engine and plugins need, so there is no blanket `-keep class io.flutter.**` here:
# that rule forced R8 to resolve Flutter's Play Store deferred-components code, whose
# Play Core classes this app does not ship, and failed the release build.
-keepattributes *Annotation*

# Flutter's engine references Play Core for deferred components, which this app does
# not use. The classes are absent on purpose.
-dontwarn com.google.android.play.core.**
-dontwarn javax.annotation.**
