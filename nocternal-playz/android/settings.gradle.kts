pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
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

rootProject.name = "NocternalPlayz"

// Pure Kotlin/JVM modules: no Android dependency, unit-tested on any JVM.
include(
    ":core:model",
    ":plugin_api",
    ":theme_manager",
    ":playlists",
    ":ai_assistant",
    ":auto_mix_engine",
    ":lyrics_engine",
    ":backup_manager",
    ":fx_engine",
    ":radio_hub",
    ":free_music",
)

// Android modules.
include(
    ":core:designsystem",
    ":audio_engine",
    ":library_scanner",
    ":lighting_effects",
    ":offline_manager",
    ":ui_player",
    ":ui_youtube_panel",
    ":ui_radio_panel",
    ":app",
)
