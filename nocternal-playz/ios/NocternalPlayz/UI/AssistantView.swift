import SwiftUI
import NocternalModel
import AIAssistant

/// AI Assistant panel (spec §4/§10): neon chat bubbles, quick actions and the voice orb.
struct AssistantView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @ObservedObject private var speech: SpeechInput
    struct Message: Identifiable { let id = UUID(); let fromUser: Bool; let text: String; var art: NeonArtSpec? = nil; var suggestions: [String] = [] }
    @State private var messages = [Message(fromUser: false, text: "Hi, I'm Nocternal AI 🌙 Ask for a mood, a genre, an EQ or a theme — or tap the orb and speak.")]
    @State private var input = ""
    @State private var thinking = false
    private let quick = ["Play trance playlist", "Boost bass", "Activate meditation theme", "What song is this?", "Recommend EQ", "Sleep in 30 minutes", "Karaoke on", "Auto mix"]

    init() { _speech = ObservedObject(wrappedValue: SpeechInputHolder.shared) }

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text("Nocternal AI").font(.title2.bold()).foregroundStyle(theme.text)
                Spacer()
                VoiceOrbButton(size: 60, level: Double(speech.level), listening: speech.listening) {
                    if speech.listening { speech.stop() } else { speech.start { send($0) } }
                }
            }
            if speech.listening && !speech.partial.isEmpty { Text("“\(speech.partial)”").foregroundStyle(theme.accent) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(messages) { m in bubble(m).id(m.id) }
                        if thinking { Text("…").foregroundStyle(theme.accent) }
                    }
                }
                .onChange(of: messages.count) { _, _ in if let id = messages.last?.id { withAnimation { proxy.scrollTo(id) } } }
            }
            ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(quick, id: \.self) { q in NeonChip(text: q) { send(q) } } } }
            HStack {
                TextField("Ask or command…", text: $input).textFieldStyle(.roundedBorder).onSubmit { send(input); input = "" }
                Button { send(input); input = "" } label: { Image(systemName: "paperplane.fill").foregroundStyle(theme.accent) }
            }
        }
        .padding(16)
    }

    private func send(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        messages.append(Message(fromUser: true, text: text))
        thinking = true
        Task {
            let r = await model.assistant.handle(text, model.context())
            await MainActor.run {
                let wantsRecognition = model.run(r.actions)
                var art: NeonArtSpec?
                for a in r.actions { if case .showAlbumArt(let s) = a { art = s } }
                messages.append(Message(fromUser: false, text: r.reply, art: art, suggestions: r.suggestions))
                thinking = false
                if wantsRecognition { recognize() }
            }
        }
    }

    private func recognize() {
        Task {
            let match = await model.recognizer.recognize()
            await MainActor.run {
                if let m = match { messages.append(Message(fromUser: false, text: "That's “\(m.title)” by \(m.artist).", suggestions: ["Play \(m.title) \(m.artist)"])) }
                else { messages.append(Message(fromUser: false, text: "I couldn't identify it — try closer to the speaker.")) }
            }
        }
    }

    @ViewBuilder private func bubble(_ m: Message) -> some View {
        VStack(alignment: m.fromUser ? .trailing : .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 8) {
                Text(m.text).foregroundStyle(theme.text)
                if let art = m.art { NeonArtView(spec: art).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 16)) }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 20).fill(LinearGradient(colors: m.fromUser ? [theme.secondary.opacity(0.35), theme.surface] : [theme.surface, theme.accent.opacity(0.18)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke((m.fromUser ? theme.secondary : theme.accent).opacity(0.6)))
            .neonGlow(m.fromUser ? theme.secondary : theme.accent, theme.glow * 0.3, radius: 8)
            .frame(maxWidth: 300, alignment: m.fromUser ? .trailing : .leading)
            if !m.suggestions.isEmpty { HStack { ForEach(m.suggestions, id: \.self) { s in NeonChip(text: s) { send(s) } } } }
        }
        .frame(maxWidth: .infinity, alignment: m.fromUser ? .trailing : .leading)
    }
}

/// The speech recognizer is shared so the orb keeps its state across sheet presentations.
enum SpeechInputHolder { static let shared = SpeechInput() }
