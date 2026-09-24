plugins {
    id("com.android.application") version "8.7.3"
}

// The page, the WebAssembly engine and its JS runtime come straight from the
// engine's browser build, so the app always runs the current engine.
val deckLabFiles = listOf("index.html", "djnexus.wasm", "djnexus-asm.js", "djnexus-runtime.js", "djnexus-worklet.js")
val deckLabAssets = layout.buildDirectory.dir("generated/decklab-assets")
val copyDeckLab by tasks.registering(Copy::class) {
    from("../engine/web") { include(deckLabFiles) }
    into(deckLabAssets.map { it.dir("decklab") })
}

val runNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.djnexus.decklab"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.djnexus.decklab"
        minSdk = 26
        targetSdk = 35
        versionCode = runNumber
        versionName = "0.1.$runNumber"
    }

    signingConfigs {
        // A fixed debug key (password "android"), so each preview build installs
        // over the last one. Not for store releases.
        getByName("debug") {
            storeFile = file("decklab-preview.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(deckLabAssets)
}

tasks.named("preBuild") { dependsOn(copyDeckLab) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
