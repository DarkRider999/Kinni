import Foundation
import Speech
import AVFoundation
import ShazamKit
import Security

/// Radio Hub backend: the community Radio Browser directory (free, keyless).
struct RadioStation: Codable, Identifiable, Hashable {
    let stationuuid: String
    let name: String
    let url_resolved: String?
    let favicon: String?
    let tags: String?
    let country: String?
    let codec: String?
    let bitrate: Int?
    var id: String { stationuuid }
    var fmFrequency: Double? {
        guard let r = name.range(of: #"\b(8[7-9]|9\d|10[0-8])[.,]\d\b"#, options: .regularExpression) else { return nil }
        return Double(name[r].replacingOccurrences(of: ",", with: "."))
    }
}

final class RadioBrowser {
    private let mirrors = ["https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info", "https://at1.api.radio-browser.info"]
    private let common = "hidebroken=true&order=clickcount&reverse=true"

    func byTag(_ tag: String) async -> [RadioStation] { await get("/json/stations/bytag/\(enc(tag))?\(common)&limit=40") }
    func search(_ name: String) async -> [RadioStation] { await get("/json/stations/search?name=\(enc(name))&\(common)&limit=40") }
    func fmStations(country: String) async -> [RadioStation] {
        let all = await get("/json/stations/search?countrycode=\(enc(country))&name=fm&\(common)&limit=300").filter { $0.fmFrequency != nil }
        var seen = Set<Double>()
        return all.filter { seen.insert($0.fmFrequency!).inserted }.sorted { $0.fmFrequency! < $1.fmFrequency! }
    }

    private func get(_ path: String) async -> [RadioStation] {
        for m in mirrors {
            guard let url = URL(string: m + path) else { continue }
            var req = URLRequest(url: url); req.setValue("NocternalPlayz/1.0", forHTTPHeaderField: "User-Agent"); req.timeoutInterval = 10
            guard let (data, _) = try? await URLSession.shared.data(for: req), let list = try? JSONDecoder().decode([RadioStation].self, from: data) else { continue }
            return list.filter { ($0.url_resolved ?? "").hasPrefix("http") }
        }
        return []
    }
    private func enc(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s }
}

/// Voice commands via on-device Speech recognition.
final class SpeechInput: ObservableObject {
    @Published var listening = false
    @Published var partial = ""
    @Published var level: Float = 0
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-IN")) ?? SFSpeechRecognizer()
    private let engine = AVAudioEngine()
    private var task: SFSpeechRecognitionTask?

    func start(onResult: @escaping (String) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return }
            DispatchQueue.main.async { self.begin(onResult) }
        }
    }

    private func begin(_ onResult: @escaping (String) -> Void) {
        stop()
        try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buf, _ in
            request.append(buf)
            if let ch = buf.floatChannelData?[0] {
                var sum: Float = 0; for i in 0..<Int(buf.frameLength) { sum += ch[i] * ch[i] }
                let rms = sqrt(sum / Float(max(buf.frameLength, 1)))
                DispatchQueue.main.async { self?.level = min(rms * 8, 1) }
            }
        }
        engine.prepare(); try? engine.start()
        listening = true; partial = ""
        task = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                if let r = result { self?.partial = r.bestTranscription.formattedString }
                if result?.isFinal == true || error != nil {
                    let text = self?.partial ?? ""
                    self?.stop()
                    if !text.isEmpty { onResult(text) }
                }
            }
        }
        // Stop automatically after 6 s of listening.
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in if self?.listening == true { request.endAudio() } }
    }

    func stop() {
        engine.stop(); engine.inputNode.removeTap(onBus: 0)
        task?.cancel(); task = nil; listening = false; level = 0
        try? AVAudioSession.sharedInstance().setCategory(.playback)
    }
}

/// Music recognition with Apple's ShazamKit (listens to the microphone, so it works for any app or speaker).
final class SongRecognizer {
    struct Match { let title: String; let artist: String; let appleMusicURL: URL? }
    func recognize() async -> Match? {
        let session = SHManagedSession()
        switch await session.result() {
        case .match(let m):
            guard let item = m.mediaItems.first else { return nil }
            return Match(title: item.title ?? "Unknown", artist: item.artist ?? "", appleMusicURL: item.appleMusicURL)
        default:
            return nil
        }
    }
}

/// Tiny Keychain wrapper for the user's Claude API key.
enum Keychain {
    static func set(_ key: String, _ value: String?) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key]
        SecItemDelete(q as CFDictionary)
        guard let v = value, !v.isEmpty else { return }
        var add = q; add[kSecValueData as String] = Data(v.utf8); add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
    static func get(_ key: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
}
