# Keep the JS <-> Kotlin bridges: methods called from JavaScript via
# @JavascriptInterface must survive minification with their original names.
-keepclassmembers class com.smartbeginning.kids.* {
    @android.webkit.JavascriptInterface <methods>;
}
