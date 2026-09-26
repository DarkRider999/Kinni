import AVFoundation
import MediaPlayer
import Combine
import NocternalModel
import ThemeManager
import FXEngine
import AutoMixEngine

/// iOS audio engine (spec §2): AVAudioEngine graph
///
///   player → time/pitch → 10-band EQ + bass shelf → reverb → compressor → main mixer (fader) → output
///
/// Decoded audio is processed by the shared `CustomFxProcessor` (vocal remover, widener, surround, flanger,
/// phaser, noise gate, limiter) in ~0.2 s chunks before it is scheduled, and files are chained back-to-back
/// for true gapless playback. Streams (radio) and Apple Music library items play through AVPlayer.
final class AudioEngine: ObservableObject, EQManaging {
    struct FxState: Equatable {
        var eqGains: [Double] = Array(repeating: 0, count: 10)
        var preampDb: Double = 0
        var bassBoost: Double = 0
        var reverbWet: Double = 0
        var compressor = false
        var pitchSemitones: Double = 0
        var custom = CustomFxSettings()
        var normalizationDb: Double = 0
    }

    @Published private(set) var queue: [Track] = []
    @Published private(set) var index = -1
    @Published private(set) var isPlaying = false
    @Published private(set) var positionMs: Int64 = 0
    @Published var fx = FxState() { didSet { applyFx() } }
    @Published private(set) var spectrum = SpectrumFrame.silent
    @Published var autoMix = false
    @Published private(set) var sleepRemaining: TimeInterval?
    @Published var shuffle = false
    @Published var repeatMode: RepeatMode = .off
    var queueGenreId: String?
    var onTrackStarted: ((Track, String?) -> Void)?
    var onTrackFinished: ((Track, Int64) -> Void)?
    var libraryPool: () -> [Track] = { [] }
    var settings = AppSettings()

    var current: Track? { queue.indices.contains(index) ? queue[index] : nil }

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let timePitch = AVAudioUnitTimePitch()
    private let eq = AVAudioUnitEQ(numberOfBands: 11)
    private let reverb = AVAudioUnitReverb()
    private let dynamics = AVAudioUnitEffect(audioComponentDescription: AudioComponentDescription(
        componentType: kAudioUnitType_Effect, componentSubType: kAudioUnitSubType_DynamicsProcessor,
        componentManufacturer: kAudioUnitManufacturer_Apple, componentFlags: 0, componentFlagsMask: 0))
    private let custom = CustomFxProcessor()
    private let analyzer: SpectrumAnalyzer
    private var streamPlayer: AVPlayer?
    private var format: AVAudioFormat!

    // Scheduling state for the engine path.
    private var file: AVAudioFile?
    private var converter: AVAudioConverter?
    private var scheduledFramesForTrack: AVAudioFramePosition = 0
    private var trackStartFrame: AVAudioFramePosition = 0
    private var framesScheduledTotal: AVAudioFramePosition = 0
    private var generation = 0
    private var listenedMs: Int64 = 0
    private var ticker: Timer?
    private var sleepEnd: Date?
    private let planner = AutoMixPlanner()

    init() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default)
        try? session.setActive(true)
        let rate = session.sampleRate > 0 ? session.sampleRate : 48000
        let analyzer = SpectrumAnalyzer(sampleRate: rate)
        self.analyzer = analyzer
        format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)
        custom.prepare(sampleRate: rate)

        for (i, f) in eqBandFrequencies.enumerated() {
            let b = eq.bands[i]; b.filterType = .parametric; b.frequency = Float(f); b.bandwidth = 1.0; b.gain = 0; b.bypass = false
        }
        let shelf = eq.bands[10]; shelf.filterType = .lowShelf; shelf.frequency = 80; shelf.gain = 0; shelf.bypass = false
        reverb.loadFactoryPreset(.mediumHall); reverb.wetDryMix = 0

        [player, timePitch, eq, reverb, dynamics].forEach { engine.attach($0) }
        engine.connect(player, to: timePitch, format: format)
        engine.connect(timePitch, to: eq, format: format)
        engine.connect(eq, to: reverb, format: format)
        engine.connect(reverb, to: dynamics, format: format)
        engine.connect(dynamics, to: engine.mainMixerNode, format: format)
        dynamics.bypass = true
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: engine.mainMixerNode.outputFormat(forBus: 0)) { buffer, _ in
            guard let ch = buffer.floatChannelData, buffer.format.channelCount >= 2 else { return }
            analyzer.push(left: ch[0], right: ch[1], frames: Int(buffer.frameLength))
        }
        try? engine.start()
        setupRemoteCommands()
        ticker = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in Task { @MainActor in self?.tick() } }
    }

    // MARK: Transport

    func play(_ tracks: [Track], at start: Int = 0, genreId: String? = nil) {
        guard !tracks.isEmpty else { return }
        finishCurrent()
        queue = shuffle ? tracks.shuffled() : tracks
        queueGenreId = genreId
        startTrack(at: min(max(start, 0), tracks.count - 1))
    }

    func playStream(url: URL, title: String, subtitle: String, genreTag: String?) {
        play([Track(id: "stream:\(url.absoluteString)", uri: url.absoluteString, title: title, artist: subtitle, genreTag: genreTag, source: .radio)])
    }

    func togglePlay() {
        if let sp = streamPlayer {
            if isPlaying { sp.pause() } else { sp.play() }
            isPlaying.toggle()
            return
        }
        if player.isPlaying { player.pause(); isPlaying = false } else { if !engine.isRunning { try? engine.start() }; player.play(); isPlaying = true }
        updateNowPlaying()
    }

    func next() { advance(by: 1) }
    func previous() { if positionMs > 3000 { seek(to: 0) } else { advance(by: -1) } }

    func seek(to ms: Int64) {
        guard let t = current else { return }
        if let sp = streamPlayer { sp.seek(to: CMTime(value: ms, timescale: 1000)); return }
        startTrack(at: index, fromMs: ms, notify: false)
        _ = t
    }

    func setSleepTimer(minutes: Int?) { sleepEnd = minutes.map { Date().addingTimeInterval(TimeInterval($0 * 60)) }; sleepRemaining = minutes.map { TimeInterval($0 * 60) } }

    // MARK: EQ / FX

    func applyPreset(_ p: EqPreset) {
        var f = fx
        f.eqGains = p.bandGainsDb; f.preampDb = p.preampDb; f.bassBoost = p.bassBoost; f.custom.surround = Float(p.surround)
        fx = f
    }

    private func applyFx() {
        for i in 0..<10 { eq.bands[i].gain = Float(fx.eqGains[i]) }
        eq.bands[10].gain = Float(fx.bassBoost * 12)
        eq.globalGain = Float(fx.preampDb + fx.normalizationDb)
        reverb.wetDryMix = Float(fx.reverbWet * 100)
        dynamics.bypass = !fx.compressor
        timePitch.pitch = Float(fx.pitchSemitones * 100)
        var c = fx.custom
        c.limiterCeilingDb = settings.speakerSafeMode ? -1 : -0.3
        custom.settings = c
    }

    // MARK: Internals

    private func advance(by delta: Int) {
        guard !queue.isEmpty else { return }
        var n = index + delta
        if repeatMode == .one { n = index }
        if n >= queue.count { if repeatMode == .all { n = 0 } else { player.stop(); isPlaying = false; return } }
        if n < 0 { n = 0 }
        finishCurrent()
        startTrack(at: n)
    }

    private func startTrack(at i: Int, fromMs: Int64 = 0, notify: Bool = true) {
        generation += 1
        index = i
        let t = queue[i]
        player.stop(); streamPlayer?.pause(); streamPlayer = nil
        positionMs = fromMs
        fx.normalizationDb = settings.normalization && t.source == .local ? LoudnessNormalizer.gainDb(replayGainDb: t.replayGainDb, measuredLoudnessDb: t.loudnessDb) : 0
        guard let url = URL(string: t.uri) else { return }
        if url.isFileURL, let f = try? AVAudioFile(forReading: url) {
            file = f
            converter = f.processingFormat == format ? nil : AVAudioConverter(from: f.processingFormat, to: format)
            let start = AVAudioFramePosition(Double(fromMs) / 1000 * f.processingFormat.sampleRate)
            f.framePosition = min(start, f.length)
            trackStartFrame = framesScheduledTotal - AVAudioFramePosition(Double(fromMs) / 1000 * format.sampleRate)
            if !engine.isRunning { try? engine.start() }
            for _ in 0..<4 { scheduleChunk(gen: generation) }
            player.play()
        } else {
            // Streams and Apple Music items: AVPlayer (system EQ-free path).
            let sp = AVPlayer(url: url)
            streamPlayer = sp
            if fromMs > 0 { sp.seek(to: CMTime(value: fromMs, timescale: 1000)) }
            sp.play()
        }
        isPlaying = true
        if notify { onTrackStarted?(t, queueGenreId); if autoMix { queueAutoMixNext() } }
        updateNowPlaying()
    }

    /// Reads ~0.2 s, runs the custom DSP and schedules it; when the file ends, opens the next one (gapless).
    private func scheduleChunk(gen: Int) {
        guard gen == generation, let f = file else { return }
        let frames: AVAudioFrameCount = AVAudioFrameCount(format.sampleRate * 0.2)
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return }
        if let conv = converter {
            var error: NSError?
            var done = false
            conv.convert(to: out, error: &error) { packets, status in
                guard let inBuf = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: packets),
                      (try? f.read(into: inBuf, frameCount: packets)) != nil, inBuf.frameLength > 0 else { status.pointee = .endOfStream; done = true; return nil }
                status.pointee = .haveData
                return inBuf
            }
            if done && out.frameLength == 0 { fileEnded(gen: gen); return }
        } else {
            do { try f.read(into: out, frameCount: frames) } catch { fileEnded(gen: gen); return }
            if out.frameLength == 0 { fileEnded(gen: gen); return }
        }
        if let ch = out.floatChannelData, out.format.channelCount >= 2 { custom.process(left: ch[0], right: ch[1], frames: Int(out.frameLength)) }
        framesScheduledTotal += AVAudioFramePosition(out.frameLength)
        player.scheduleBuffer(out) { [weak self] in Task { @MainActor in self?.scheduleChunk(gen: gen) } }
    }

    private func fileEnded(gen: Int) {
        guard gen == generation else { return }
        file = nil
        // Gapless: start decoding the next track right away so its first buffer follows the last one.
        let nextIndex = repeatMode == .one ? index : index + 1
        guard nextIndex < queue.count || repeatMode == .all else { return }
        let n = nextIndex < queue.count ? nextIndex : 0
        guard let url = URL(string: queue[n].uri), url.isFileURL, let f = try? AVAudioFile(forReading: url) else { return }
        let boundary = framesScheduledTotal
        file = f
        converter = f.processingFormat == format ? nil : AVAudioConverter(from: f.processingFormat, to: format)
        for _ in 0..<3 { scheduleChunk(gen: gen) }
        pendingBoundary = (boundary, n)
    }

    private var pendingBoundary: (AVAudioFramePosition, Int)?

    private func tick() {
        if let end = sleepEnd {
            let left = end.timeIntervalSinceNow
            sleepRemaining = max(left, 0)
            if left <= 0 { player.pause(); streamPlayer?.pause(); isPlaying = false; sleepEnd = nil; sleepRemaining = nil }
        }
        var rendered: AVAudioFramePosition = 0
        if let nt = player.lastRenderTime, let pt = player.playerTime(forNodeTime: nt) { rendered = pt.sampleTime }
        if let pb = pendingBoundary, rendered >= pb.0 {
            pendingBoundary = nil
            finishCurrent()
            index = pb.1; trackStartFrame = pb.0
            if let t = current { onTrackStarted?(t, queueGenreId); if autoMix { queueAutoMixNext() } }
            updateNowPlaying()
        }
        if let sp = streamPlayer { positionMs = Int64(sp.currentTime().seconds * 1000) }
        else if player.isPlaying { positionMs = max(0, Int64(Double(rendered - trackStartFrame) / format.sampleRate * 1000)) }
        if isPlaying { listenedMs += 33 }

        // Files are scheduled back-to-back (gapless), so there is no fade dip between songs; only the sleep timer fades.
        var level = 1.0
        if let left = sleepRemaining, left < 30 { level *= left / 30 }
        engine.mainMixerNode.outputVolume = Float(level)
        streamPlayer?.volume = Float(level)

        spectrum = isPlaying && streamPlayer == nil ? analyzer.compute() : decayed(spectrum)
        if !player.isPlaying && streamPlayer == nil && isPlaying && file == nil && pendingBoundary == nil { isPlaying = false }
    }

    private func decayed(_ f: SpectrumFrame) -> SpectrumFrame {
        SpectrumFrame(bands: f.bands.map { $0 * 0.85 }, bass: f.bass * 0.85, mid: f.mid * 0.85, treble: f.treble * 0.85, level: f.level * 0.85, beat: false)
    }

    private func finishCurrent() {
        if let t = current, listenedMs > 0 { onTrackFinished?(t, listenedMs) }
        listenedMs = 0
    }

    private func queueAutoMixNext() {
        guard let cur = current, let pick = planner.next(current: cur, pool: libraryPool(), recentlyPlayed: Set(queue.prefix(index + 1).map(\.id))) else { return }
        if index + 1 < queue.count, queue[index + 1].id == pick.track.id { return }
        queue.insert(pick.track, at: index + 1)
    }

    // MARK: Lock screen / Control Center

    private func setupRemoteCommands() {
        let c = MPRemoteCommandCenter.shared()
        c.togglePlayPauseCommand.addTarget { [weak self] _ in Task { @MainActor in self?.togglePlay() }; return .success }
        c.playCommand.addTarget { [weak self] _ in Task { @MainActor in if self?.isPlaying == false { self?.togglePlay() } }; return .success }
        c.pauseCommand.addTarget { [weak self] _ in Task { @MainActor in if self?.isPlaying == true { self?.togglePlay() } }; return .success }
        c.nextTrackCommand.addTarget { [weak self] _ in Task { @MainActor in self?.next() }; return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in Task { @MainActor in self?.previous() }; return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] e in
            if let e = e as? MPChangePlaybackPositionCommandEvent { Task { @MainActor in self?.seek(to: Int64(e.positionTime * 1000)) } }
            return .success
        }
    }

    private func updateNowPlaying() {
        guard let t = current else { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: t.title, MPMediaItemPropertyArtist: t.artist, MPMediaItemPropertyAlbumTitle: t.album,
            MPMediaItemPropertyPlaybackDuration: Double(t.durationMs) / 1000,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: Double(positionMs) / 1000,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
    }
}
