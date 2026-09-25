import Foundation
import NocternalModel
import ThemeManager
import FXEngine

public struct LLMTurn: Sendable { public enum Role: String, Sendable { case user, assistant }; public let role: Role; public let text: String }

public protocol AssistantLLM: Sendable {
    func complete(system: String, turns: [LLMTurn]) async throws -> String
}

/// Claude backend over raw HTTPS (there is no official Swift SDK). The key is the user's own and stays in
/// the Keychain; for a public release, proxy requests through your own server instead.
public struct ClaudeLLM: AssistantLLM {
    let apiKey: String
    let model: String
    public init(apiKey: String, model: String = "claude-opus-5") { self.apiKey = apiKey; self.model = model }

    public func complete(system: String, turns: [LLMTurn]) async throws -> String {
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        let body: [String: Any] = [
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "output_config": ["effort": "low"],
            "fallbacks": "default",
            "messages": turns.map { ["role": $0.role.rawValue, "content": $0.text] },
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw URLError(.cannotParseResponse) }
        if let http = resp as? HTTPURLResponse, http.statusCode != 200 {
            let msg = (obj["error"] as? [String: Any])?["message"] as? String ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "Claude", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: msg])
        }
        if obj["stop_reason"] as? String == "refusal" { return "I can’t help with that one — ask me about music, playlists or sound settings." }
        let blocks = obj["content"] as? [[String: Any]] ?? []
        let text = blocks.compactMap { $0["type"] as? String == "text" ? $0["text"] as? String : nil }.joined(separator: "\n")
        return text.isEmpty ? "Sorry, I didn’t catch that." : text
    }
}

/// The Nocternal AI assistant: offline commands first, optional Claude for everything else.
public final class AssistantEngine {
    let llm: AssistantLLM?
    let pluginHandler: (String) -> String?
    let recommender = RecommendationEngine()
    private var conversation: [LLMTurn] = []

    public init(llm: AssistantLLM?, pluginHandler: @escaping (String) -> String? = { _ in nil }) { self.llm = llm; self.pluginHandler = pluginHandler }

    public func handle(_ text: String, _ ctx: AssistantContext) async -> AssistantResponse {
        let intent = CommandParser.parse(text)
        if case .unknown = intent {
            if let r = pluginHandler(text) { return AssistantResponse(r) }
            return await askLLM(text, ctx)
        }
        return execute(intent, ctx)
    }

    public func execute(_ intent: AssistantIntent, _ ctx: AssistantContext) -> AssistantResponse {
        switch intent {
        case .playGenre(let id):
            guard let g = GenreCatalog.byId(id) else { return AssistantResponse(help) }
            let p = recommender.suggest(ctx, genreId: id, mood: nil, bpmMin: nil, bpmMax: nil)
            if p.trackIds.isEmpty { return radioFallback(g.aiSuggestions.first ?? g.displayName, g.id) }
            return AssistantResponse("Playing your \(g.displayName) playlist \(g.emoji) — \(ThemePresets.byId(g.themePresetId).name) theme on.",
                                     [.playQueue(p, genreId: g.id), .applyGenreTheme(g.id)], suggestions: Array(g.aiSuggestions.dropFirst().prefix(2)))
        case .playMood(let m):
            let p = recommender.suggest(ctx, genreId: nil, mood: m, bpmMin: nil, bpmMax: nil)
            let g = GenreDetector().forMood(m, hour: ctx.hour)
            return p.trackIds.isEmpty ? radioFallback("\(m.label) music", g.id)
                : AssistantResponse("Here’s a \(m.label.lowercased()) mix — \(p.trackIds.count) songs.", [.playQueue(p, genreId: g.id)], suggestions: ["Boost bass", "Sleep in 30 min"])
        case .playSearch(let q, let src):
            let words = q.split(separator: " ").map(String.init)
            let local = ctx.tracks.filter { t in words.allSatisfy { "\(t.title) \(t.artist) \(t.album)".lowercased().contains($0) } }
            if src == .local, let first = local.first {
                return AssistantResponse("Playing “\(first.title)”.", [.playQueue(Playlist(id: "ai_search", name: "Search: \(q)", trackIds: local.map(\.id), kind: .ai), genreId: nil)])
            }
            let target: AudioSource = src == .local ? .youtube : src
            return AssistantResponse("Searching \(target.label) for “\(q)”.", [.switchSource(target), .search(q, target)])
        case let .suggestPlaylist(genreId, mood, lo, hi):
            let p = recommender.suggest(ctx, genreId: genreId, mood: mood, bpmMin: lo, bpmMax: hi)
            return p.trackIds.isEmpty ? AssistantResponse("No matches in your library yet — want me to search YouTube Music or the Radio Hub?", suggestions: ["Open Radio Hub"])
                : AssistantResponse("I made “\(p.name)” with \(p.trackIds.count) songs.", [.playQueue(p, genreId: p.genreId)], suggestions: ["Auto mix", "Shuffle"])
        case .adjustBass(let up): return AssistantResponse(up ? "Bass boosted. The limiter keeps it clean." : "Bass reduced.", [.changeBass(up ? 0.2 : -0.2)])
        case .recommendEq:
            let (p, why) = EqAdvisor.recommend(ctx.nowPlaying, route: ctx.route)
            return AssistantResponse("\(why). Applied “\(p.name)”.", [.setEq(p)])
        case .activateTheme(let id):
            let g = GenreCatalog.byId(id)!
            return AssistantResponse("\(ThemePresets.byId(g.themePresetId).name) activated \(g.emoji)", [.applyGenreTheme(id)])
        case .switchSource(let s): return AssistantResponse("Switched to \(s.label).", [.switchSource(s)])
        case .sleepTimer(let m): return AssistantResponse("Sleep timer set for \(m) min. I’ll fade the music out gently.", [.setSleepTimer(m)])
        case .transport(let c): return AssistantResponse(c == .like ? "Added to Favorites 💜" : "Done.", [.transport(c)])
        case .enhance(let m): return AssistantResponse("\(m.label) on.", [.enhance(m)])
        case .vocalRemover(let on): return AssistantResponse(on ? "Karaoke mode on — vocals removed." : "Vocals are back.", [.setVocalRemover(on ? 1 : 0)])
        case .explain(let topic): return AssistantResponse(FeatureExplainer.explain(topic))
        case .identifySong: return AssistantResponse("Listening… hold your phone near the music.", [.startRecognition])
        case .generateArt:
            guard let t = ctx.nowPlaying else { return AssistantResponse("Play a song first and I’ll design its cover.") }
            return AssistantResponse("Here’s neon art for “\(t.title)”.", [.showAlbumArt(.generate(for: t))])
        case .autoMix: return AssistantResponse("DJ auto-mix on: key- and tempo-matched songs, blended on the beat.", [.enableAutoMix(true)])
        case .unknown: return AssistantResponse(help)
        }
    }

    private var help: String {
        "Try “play trance playlist”, “boost bass”, “activate meditation theme”, “sleep in 30 minutes” or “what song is this?”." + (llm == nil ? " Add a Claude API key in Settings to ask me anything else." : "")
    }

    private func radioFallback(_ q: String, _ genreId: String) -> AssistantResponse {
        AssistantResponse("Nothing like that in your library yet, so I’m tuning the Radio Hub to “\(q)”.", [.applyGenreTheme(genreId), .switchSource(.radio), .search(q, .radio)])
    }

    private func askLLM(_ text: String, _ ctx: AssistantContext) async -> AssistantResponse {
        guard let llm else { return AssistantResponse(help) }
        conversation.append(LLMTurn(role: .user, text: text))
        if conversation.count > 12 { conversation.removeFirst(conversation.count - 12) }
        var system = "You are the assistant inside NOCTERNAL PLAYZ, a neon music player. Answer in 1–4 short sentences. You can control the app by ending with one line \"ACTION: <command>\" (play <genre|mood|song>, boost bass, recommend eq, activate <genre> theme, switch to <local|youtube|radio>, sleep in <n> minutes, karaoke on, auto mix, identify song). Only add an ACTION if the user wants something done. Built-in genres: \(GenreCatalog.all.map(\.displayName).joined(separator: ", ")). Time: \(ctx.hour):00."
        if let t = ctx.nowPlaying { system += " Now playing: “\(t.title)” by \(t.artist)." }
        do {
            let reply = try await llm.complete(system: system, turns: conversation)
            conversation.append(LLMTurn(role: .assistant, text: reply))
            let lines = reply.components(separatedBy: "\n")
            let action = lines.last { $0.hasPrefix("ACTION:") }.map { String($0.dropFirst(7)).trimmingCharacters(in: .whitespaces) }
            let clean = lines.filter { !$0.hasPrefix("ACTION:") }.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            var actions: [AssistantAction] = []
            if let a = action { let intent = CommandParser.parse(a); if case .unknown = intent {} else { actions = execute(intent, ctx).actions } }
            return AssistantResponse(clean, actions, fromLLM: true)
        } catch {
            conversation.removeLast()
            return AssistantResponse("I couldn’t reach the AI service (\(error.localizedDescription)). Commands like “play lo-fi” still work offline.")
        }
    }
}
