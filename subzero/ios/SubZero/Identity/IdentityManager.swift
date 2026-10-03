import UIKit

/// App identity (alternate icon + implied name). iOS switches the home-screen
/// icon via `setAlternateIconName`; each alternate icon is declared under
/// `CFBundleIcons.CFBundleAlternateIcons` in Info.plist. This is App Store
/// compliant identity switching — it does not hide the app.
enum AppIdentity: String, CaseIterable {
    case `default` = "AppIcon"        // nil alternate name
    case calculator = "IconCalculator"
    case notes = "IconNotes"
    case weather = "IconWeather"
    case gallery = "IconGallery"
    case systemUpdate = "IconSystem"

    var alternateName: String? { self == .default ? nil : rawValue }
    var label: String {
        switch self {
        case .default: return "SubZero"; case .calculator: return "Calculator"
        case .notes: return "Notes"; case .weather: return "Weather"
        case .gallery: return "Gallery"; case .systemUpdate: return "System Update"
        }
    }
}

enum IdentityManager {
    static func current() -> AppIdentity {
        let name = UIApplication.shared.alternateIconName
        return AppIdentity.allCases.first { $0.alternateName == name } ?? .default
    }

    static func switchTo(_ identity: AppIdentity, completion: ((Error?) -> Void)? = nil) {
        guard UIApplication.shared.supportsAlternateIcons else { completion?(nil); return }
        UIApplication.shared.setAlternateIconName(identity.alternateName, completionHandler: completion)
    }

    static func rotateRandom() {
        let others = AppIdentity.allCases.filter { $0 != current() }
        if let pick = others.randomElement() { switchTo(pick) }
    }
}
