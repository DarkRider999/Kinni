import SwiftUI

@main
struct NocternalPlayzApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environmentObject(model.theme)
                .environmentObject(model.audio)
                .environmentObject(model.library)
                .preferredColorScheme(model.theme.mode == .light ? .light : .dark)
                .onAppear { model.library.rescan(); model.library.analyzeMissingBpm() }
        }
    }
}
