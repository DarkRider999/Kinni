# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.nocternal.playz.** { kotlinx.serialization.KSerializer serializer(...); }
# Plugins discovered via ServiceLoader
-keep class * implements com.nocternal.playz.plugin.NocternalPlugin { <init>(); }
# Anthropic SDK (Jackson/OkHttp reflection)
-keep class com.anthropic.** { *; }
-dontwarn com.anthropic.**
-dontwarn org.slf4j.**
-dontwarn com.google.errorprone.annotations.**
