# Android project setup notes

This package includes the application Gradle files and Android manifest. Flutter tooling normally generates the Gradle wrapper scripts/JAR and default launch theme resources. If the wrapper files are absent, run `flutter create --platforms=android --org com.anjali.crm.ai .` in a copy of this project and review/merge the generated Android files without overwriting the configured `applicationId`, SDK levels, manifest permissions, or signing config.

For a first compile, Flutter's generated `android/gradlew`, `android/gradlew.bat`, `android/gradle/wrapper/gradle-wrapper.jar`, and `android/app/src/main/res/values/styles.xml` / `values-night/styles.xml` must exist. Do not assume this source archive has been compiled; validate it with the documented build commands.
