// swift-tools-version:5.9
import PackageDescription

// Platform-independent core of NOCTERNAL PLAYZ for iOS. Mirrors the Android Kotlin modules one-to-one
// (theme_manager, playlists, auto_mix_engine, lyrics_engine, backup_manager, fx_engine, ai_assistant).
let package = Package(
    name: "NocternalKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "NocternalKit", targets: ["NocternalModel", "ThemeManager", "Playlists", "AutoMixEngine", "LyricsEngine", "BackupManager", "FXEngine", "AIAssistant"]),
    ],
    targets: [
        .target(name: "NocternalModel"),
        .target(name: "ThemeManager", dependencies: ["NocternalModel"]),
        .target(name: "Playlists", dependencies: ["NocternalModel", "ThemeManager"]),
        .target(name: "AutoMixEngine", dependencies: ["NocternalModel"]),
        .target(name: "LyricsEngine", dependencies: ["NocternalModel"]),
        .target(name: "BackupManager", dependencies: ["NocternalModel"]),
        .target(name: "FXEngine", dependencies: ["NocternalModel"]),
        .target(name: "AIAssistant", dependencies: ["NocternalModel", "ThemeManager", "Playlists", "AutoMixEngine", "FXEngine"]),
        .testTarget(name: "NocternalKitTests", dependencies: ["NocternalModel", "ThemeManager", "Playlists", "AutoMixEngine", "LyricsEngine", "BackupManager", "FXEngine", "AIAssistant"]),
    ]
)
