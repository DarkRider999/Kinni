import SwiftUI
import WebKit
import NocternalModel
import ThemeManager

/// Radio Hub (spec §3/§10): genre stations, search and the FM dial.
struct RadioView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @State private var genreId = GenreCatalog.all.first!.id
    @State private var stations: [RadioStation] = []
    @State private var fm: [RadioStation] = []
    @State private var freq = 98.3
    @State private var query = ""
    @State private var loading = false
    private let country = Locale.current.region?.identifier ?? "IN"

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                TextField("Search stations", text: $query).textFieldStyle(.roundedBorder).onSubmit { Task { await load { await model.radio.search(query) } } }
                SectionTitle(text: "FM dial · \(country)")
                GlowCard { FmDial(frequency: $freq, stations: fm) { st in play(st, nil) } }
                SectionTitle(text: "Genre stations")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(GenreCatalog.all) { g in NeonChip(text: "\(g.emoji) \(g.displayName)", selected: g.id == genreId) { genreId = g.id } } }
                }
                if loading { ProgressView().tint(theme.accent).frame(maxWidth: .infinity) }
                ForEach(stations) { s in
                    GlowCard(glow: theme.accent.opacity(0.4)) {
                        HStack {
                            AsyncImage(url: URL(string: s.favicon ?? "")) { $0.resizable().scaledToFill() } placeholder: { Image(systemName: "radio").foregroundStyle(theme.accent) }
                                .frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 10))
                            VStack(alignment: .leading) {
                                Text(s.name.trimmingCharacters(in: .whitespaces)).font(.subheadline.bold()).lineLimit(1).foregroundStyle(theme.text)
                                Text([s.country, s.codec, s.bitrate.map { "\($0) kbps" }].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(theme.muted)
                            }
                        }
                    }.onTapGesture { play(s, genreId) }
                }
            }.padding(16).padding(.bottom, 120)
        }
        .task(id: genreId) { await load { let g = GenreCatalog.byId(genreId)!; for tag in g.radioTags { let r = await model.radio.byTag(tag); if !r.isEmpty { return r } }; return [] } }
        .task { fm = await model.radio.fmStations(country: country) }
        .onChange(of: model.panelSearch?.1) { _, q in if model.panelSearch?.0 == .radio, let q { query = q; Task { await load { await model.radio.search(q) } } } }
    }

    private func load(_ f: () async -> [RadioStation]) async { loading = true; stations = await f(); loading = false }

    private func play(_ s: RadioStation, _ genreId: String?) {
        guard let url = URL(string: s.url_resolved ?? "") else { return }
        let tag = genreId.flatMap { GenreCatalog.byId($0)?.radioTags.first } ?? s.tags?.components(separatedBy: ",").first
        model.audio.playStream(url: url, title: s.name, subtitle: [s.country, s.codec].compactMap { $0 }.joined(separator: " · "), genreTag: tag)
    }
}

/// Drag to tune 87.5–108 MHz; releasing on a station plays its online stream.
struct FmDial: View {
    @EnvironmentObject var theme: ThemeState
    @Binding var frequency: Double
    let stations: [RadioStation]
    let onTune: (RadioStation) -> Void
    @State private var dragStart: Double?

    private var tuned: RadioStation? { stations.min { abs(($0.fmFrequency ?? 0) - frequency) < abs(($1.fmFrequency ?? 0) - frequency) }.flatMap { abs(($0.fmFrequency ?? 0) - frequency) <= 0.25 ? $0 : nil } }

    var body: some View {
        VStack {
            Text(String(format: "%.1f", frequency)).font(.system(size: 44, weight: .black)).foregroundStyle(tuned != nil ? theme.accent : theme.text).neonGlow(theme.accent, tuned != nil ? theme.glow : 0)
            Text(tuned?.name ?? "· · · static · · ·").font(.caption.monospaced()).foregroundStyle(tuned != nil ? theme.secondary : theme.muted)
            Canvas { ctx, size in
                let span = 6.0, start = frequency - span / 2, px = size.width / span
                var f = (start * 10).rounded() / 10
                while f <= start + span {
                    let x = (f - start) * px, major = Int((f * 10).rounded()) % 10 == 0
                    if (87.5...108).contains(f) {
                        var p = Path(); p.move(to: CGPoint(x: x, y: size.height * (major ? 0.55 : 0.8))); p.addLine(to: CGPoint(x: x, y: size.height))
                        ctx.stroke(p, with: .color(theme.muted.opacity(major ? 0.8 : 0.35)), lineWidth: major ? 2 : 1)
                    }
                    f = ((f + 0.1) * 10).rounded() / 10
                }
                for s in stations { if let sf = s.fmFrequency, sf >= start, sf <= start + span { ctx.fill(Path(ellipseIn: CGRect(x: (sf - start) * px - 4, y: size.height * 0.3 - 4, width: 8, height: 8)), with: .color(theme.secondary)) } }
                var needle = Path(); needle.move(to: CGPoint(x: size.width / 2, y: 0)); needle.addLine(to: CGPoint(x: size.width / 2, y: size.height))
                ctx.stroke(needle, with: .color(theme.accent), lineWidth: 4)
            }
            .frame(height: 90)
            .gesture(DragGesture().onChanged { v in
                if dragStart == nil { dragStart = frequency }
                frequency = min(max(((dragStart! - Double(v.translation.width) / 60) * 10).rounded() / 10, 87.5), 108)
            }.onEnded { _ in dragStart = nil; if let t = tuned { onTune(t) } })
        }
    }
}

/// YouTube Music panel (spec §3): the official web app in a WKWebView.
struct YouTubePanel: View {
    @EnvironmentObject var model: AppModel
    @State private var opened = false
    var body: some View {
        if opened {
            WebView(url: URL(string: "https://music.youtube.com/" + (model.panelSearch?.0 == .youtube ? "search?q=" + (model.panelSearch!.1.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") : ""))!)
                .clipShape(RoundedRectangle(cornerRadius: 20)).padding(8).padding(.bottom, 100)
        } else {
            VStack(spacing: 12) {
                Text("YouTube Music").font(.title2.bold())
                Text("Stream your YouTube Music library inside Nocternal").foregroundStyle(.secondary)
                NeonChip(text: "Open YouTube Music") { opened = true }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let v = WKWebView(frame: .zero, configuration: cfg)
        v.allowsBackForwardNavigationGestures = true
        v.isOpaque = false; v.backgroundColor = .black
        v.load(URLRequest(url: url))
        return v
    }
    func updateUIView(_ v: WKWebView, context: Context) { if v.url?.absoluteString.contains("search") != url.absoluteString.contains("search") && url.absoluteString.contains("search") { v.load(URLRequest(url: url)) } }
}
