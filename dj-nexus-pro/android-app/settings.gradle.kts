// DJ Nexus Deck Lab for Android: a standalone build, separate from the other
// app in this repository. Build with: gradle -p dj-nexus-pro/android-app assembleDebug
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "djnexus-decklab"
