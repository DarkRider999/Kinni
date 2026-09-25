import SwiftUI
import UniformTypeIdentifiers
import NocternalModel
import ThemeManager
import Playlists
import AIAssistant

/// Home (spec §3/§10): logo, source tabs and the three sliding panels (Local / YouTube Music / Radio Hub).
struct HomeView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    let openPlayer: () -> Void
    @State private var page: AudioSource = .local

    var body: some View {
        VStack(spacing: 8) {
            NeonLogo().padding(.top, 8)
            HStack(spacing: 0) {
                ForEach(AudioSource.allCases, id: \.self) { s in
                    Button { withAnimation(.spring) { page = s } } label: {
                        Text(s.label).font(.caption.bold()).frame(maxWidth: .infinity).padding(.vertical, 9)
                            .foregroundStyle(page == s ? .black : theme.text)
                            .background(Capsule().fill(page == s ? AnyShapeStyle(LinearGradient(colors: [theme.accent, theme.secondary], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(Color.clear)))
                    }.buttonStyle(.plain)
                }
            }
            .padding(3).background(Capsule().fill(theme.surface)).padding(.horizontal)
            TabView(selection: $page) {
                LocalPanel(openPlayer: openPlayer, openRadio: { page = .radio }).tag(AudioSource.local)
                YouTubePanel().tag(AudioSource.youtube)
                RadioView().tag(AudioSource.radio)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .onChange(of: page) { _, src in model.switcher.handle(.sourceChanged(src, nowPlaying: model.audio.current?.source == src ? model.audio.current : nil)) }
        .onChange(of: model.requestedSource) { _, src in if let src { withAnimation { page = src }; model.requestedSource = nil } }
    }
}

struct LocalPanel: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var library: LibraryStore
    let openPlayer: () -> Void
    let openRadio: () -> Void
    @State private var tab = 0
    @State private var folder = ""
    @State private var importing = false

    var body: some View {
        let snap = library.snapshot
        let recent = model.smart.recentlyPlayed(snap, limit: 15).trackIds.compactMap(library.track)
        let genrePlaylists = Dictionary(model.smart.genrePlaylists(snap).map { ($0.genreId ?? "", $0) }, uniquingKeysWith: { a, _ in a })
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if library.scanning { Text("Scanning your music…").font(.caption.monospaced()).foregroundStyle(theme.accent) }
                if !recent.isEmpty {
                    SectionTitle(text: "Continue listening")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) { ForEach(recent) { t in TrackCard(track: t) { model.audio.play(recent, at: recent.firstIndex(of: t) ?? 0); openPlayer() } } }
                    }
                }
                SectionTitle(text: "Genres")
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(GenreCatalog.all) { g in
                        GenreTile(genre: g, count: genrePlaylists[g.id]?.trackIds.count ?? 0) {
                            model.switcher.handle(.genreTileSelected(g.id))
                            if let p = genrePlaylists[g.id] { model.playPlaylist(p); openPlayer() } else { openRadio() }
                        }
                    }
                }
                HStack {
                    SectionTitle(text: "Library · \(library.data.tracks.count) songs")
                    Button { importing = true } label: { Label("Import", systemImage: "square.and.arrow.down").font(.caption) }.tint(theme.accent)
                }
                Picker("", selection: $tab) { Text("Songs").tag(0); Text("Playlists").tag(1); Text("Folders").tag(2); Text("History").tag(3) }.pickerStyle(.segmented)
                switch tab {
                case 0: ForEach(library.data.tracks) { t in TrackRow(track: t) { model.audio.play(library.data.tracks, at: library.data.tracks.firstIndex(of: t) ?? 0); openPlayer() } }
                case 1:
                    ForEach(model.smart.all(snap).filter { !$0.trackIds.isEmpty } + library.data.playlists) { p in
                        GlowCard { Text(p.name).font(.headline).foregroundStyle(theme.text); Text("\(p.trackIds.count) songs · \(p.description)").font(.caption).foregroundStyle(theme.muted) }
                            .onTapGesture { model.playPlaylist(p); openPlayer() }
                    }
                case 2:
                    let root = FolderNode.build(library.data.tracks), node = root.find(folder) ?? root
                    if !node.path.isEmpty { NeonChip(text: "⬅ \(node.path)") { folder = node.path.split(separator: "/").dropLast().joined(separator: "/") } }
                    NeonChip(text: "▶ Play folder (\(node.totalCount))") { model.audio.play(node.allTrackIds.compactMap(library.track)); openPlayer() }
                    ForEach(node.children) { f in GlowCard { Text("📁 \(f.name)").foregroundStyle(theme.text); Text("\(f.totalCount) songs").font(.caption).foregroundStyle(theme.muted) }.onTapGesture { folder = f.path } }
                    ForEach(node.trackIds.compactMap(library.track)) { t in TrackRow(track: t) { model.audio.play([t]); openPlayer() } }
                default:
                    ForEach(HistoryTimeline.build(library.data.history)) { day in
                        SectionTitle(text: day.label)
                        ForEach(Array(day.events.prefix(50).enumerated()), id: \.offset) { _, e in if let t = library.track(e.trackId) { TrackRow(track: t) { model.audio.play([t]) } } }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 120)
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.audio], allowsMultipleSelection: true) { r in if case .success(let urls) = r { library.importFiles(urls) } }
    }
}

struct GenreTile: View {
    @EnvironmentObject var theme: ThemeState
    let genre: GenreDefinition; let count: Int; let action: () -> Void
    var body: some View {
        let p = ThemePresets.byId(genre.themePresetId)
        Button(action: action) {
            VStack(alignment: .leading) {
                Text(genre.emoji).font(.title2)
                Spacer()
                Text(genre.displayName).font(.subheadline.bold()).lineLimit(1).foregroundStyle(theme.text)
                Text(count > 0 ? "\(count) songs" : "Radio").font(.caption2).foregroundStyle(p.accent.color)
            }
            .padding(10).frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18).fill(LinearGradient(colors: [p.accent.color.opacity(0.35), p.secondaryAccent.color.opacity(0.15), theme.surface], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .neonGlow(p.accent.color, theme.glow * 0.4, radius: 8)
        }.buttonStyle(.plain)
    }
}

struct TrackCard: View {
    @EnvironmentObject var theme: ThemeState
    let track: Track; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading) {
                NeonArtView(spec: .generate(for: track)).frame(width: 128, height: 128).clipShape(RoundedRectangle(cornerRadius: 16)).neonGlow(theme.accent, theme.glow * 0.4, radius: 8)
                Text(track.title).font(.subheadline).lineLimit(1).foregroundStyle(theme.text)
                Text(track.artist).font(.caption).lineLimit(1).foregroundStyle(theme.muted)
            }.frame(width: 128)
        }.buttonStyle(.plain)
    }
}

struct TrackRow: View {
    @EnvironmentObject var theme: ThemeState
    @EnvironmentObject var library: LibraryStore
    let track: Track; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                NeonArtView(spec: .generate(for: track)).frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading) {
                    Text(track.title).font(.subheadline).lineLimit(1).foregroundStyle(theme.text)
                    Text([track.artist, track.bpm.map { "\(Int($0)) BPM" }, track.camelotKey].compactMap { $0 }.joined(separator: " · ")).font(.caption).lineLimit(1).foregroundStyle(theme.muted)
                }
                Spacer()
                if library.data.favorites.contains(track.id) { Image(systemName: "heart.fill").foregroundStyle(theme.secondary) }
            }
        }.buttonStyle(.plain)
    }
}

/// Renders an AI neon album-art spec.
struct NeonArtView: View {
    let spec: NeonArtSpec
    var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(red: 0.02, green: 0.02, blue: 0.04)))
            for l in spec.layers {
                let col = spec.palette[l.colorIndex % spec.palette.count].color
                let c = CGPoint(x: size.width * l.x, y: size.height * l.y), r = min(size.width, size.height) * l.size / 2
                let rect = CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)
                switch l.shape {
                case .ring, .mandala: ctx.stroke(Path(ellipseIn: rect), with: .color(col), lineWidth: max(2, r * 0.08))
                case .sun, .orb: ctx.fill(Path(ellipseIn: rect), with: .radialGradient(Gradient(colors: [col, col.opacity(0.2), .clear]), center: c, startRadius: 0, endRadius: r))
                case .grid, .waveform:
                    for i in 0...8 { var p = Path(); let y = size.height * (0.6 + 0.05 * Double(i)); p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: size.width, y: y)); ctx.stroke(p, with: .color(col.opacity(0.6)), lineWidth: 1.5) }
                case .mountains, .triangle:
                    var p = Path(); p.move(to: CGPoint(x: c.x, y: c.y - r)); p.addLine(to: CGPoint(x: c.x + r, y: c.y + r * 0.7)); p.addLine(to: CGPoint(x: c.x - r, y: c.y + r * 0.7)); p.closeSubpath()
                    ctx.stroke(p, with: .color(col), lineWidth: max(2, r * 0.06))
                case .wave:
                    var p = Path()
                    for s in 0...40 { let x = size.width * Double(s) / 40, y = c.y + sin(Double(s) / 40 * 4 * .pi) * r * 0.4; if s == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) } }
                    ctx.stroke(p, with: .color(col), lineWidth: 3)
                case .stars:
                    for i in 0..<40 { let x = Double((i * 7919 + Int(spec.seed % 997)) % 1000) / 1000, y = Double((i * 104729) % 1000) / 1000; ctx.fill(Path(ellipseIn: CGRect(x: x * size.width, y: y * size.height, width: 2, height: 2)), with: .color(.white.opacity(0.7))) }
                }
            }
        }
    }
}
