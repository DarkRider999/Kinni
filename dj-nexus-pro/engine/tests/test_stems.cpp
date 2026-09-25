// Stems: playback with per-stem levels, and the separator.
#include <chrono>
#include <cmath>
#include <random>
#include <vector>

#include "djnexus/djnexus.h"
#include "test.h"
#include "test_util.h"

namespace {

// Four parts as pure tones, so each stem can be measured in the output.
struct Parts {
  std::vector<float> drums, bass, vocals, other, mix;  // interleaved stereo
};

Parts toneParts(double seconds, int rate) {
  const size_t n = size_t(seconds * rate);
  Parts p;
  for (auto* v : {&p.drums, &p.bass, &p.vocals, &p.other, &p.mix}) v->assign(n * 2, 0.0f);
  const double f[4] = {100.0, 200.0, 440.0, 880.0};
  for (size_t i = 0; i < n; ++i) {
    const double t = double(i) / rate;
    float s[4];
    for (int k = 0; k < 4; ++k) s[k] = float(0.15 * std::sin(2.0 * kPi * f[k] * t));
    for (int c = 0; c < 2; ++c) {
      p.drums[i * 2 + c] = s[0];
      p.bass[i * 2 + c] = s[1];
      p.vocals[i * 2 + c] = s[2];
      p.other[i * 2 + c] = s[3];
      p.mix[i * 2 + c] = s[0] + s[1] + s[2] + s[3];
    }
  }
  return p;
}

double level(const std::vector<float>& x, double hz) { return toneLevel(x, hz, x.size() / 2, x.size()); }

uint32_t trackId(djn_engine* e, int d) {
  djn_engine_state s;
  djn_engine_peek_state(e, &s);
  return s.decks[d].track_id;
}

}  // namespace

TEST(stems_levels_mute_each_part) {
  EngineHandle e;
  const int src = 44100;  // loaded at a different rate than the engine: stems are resampled the same way
  const Parts p = toneParts(6.0, src);
  CHECK(djn_deck_load_pcm(e, 0, p.mix.data(), int64_t(p.mix.size() / 2), 2, src, 120, 0) == DJN_OK);
  render(e, 0.02);
  const uint32_t id = trackId(e, 0);
  CHECK(id != 0);
  CHECK(djn_deck_load_stems(e, 0, id, p.drums.data(), p.bass.data(), p.vocals.data(), int64_t(p.mix.size() / 2), 2,
                            src) == DJN_OK);
  render(e, 0.02);
  CHECK(deckState(e, 0).stems_loaded == 1);
  djn_deck_play(e, 0);
  render(e, 0.3);
  const std::vector<float> full = render(e, 0.5);
  for (double hz : {100.0, 200.0, 440.0, 880.0}) CHECK(level(full, hz) > 0.08);

  // Vocals off: 440 Hz gone, everything else untouched.
  djn_deck_set_stem_gain(e, 0, DJN_STEM_VOCALS, 0.0f);
  render(e, 0.1);
  std::vector<float> out = render(e, 0.5);
  CHECK(level(out, 440.0) < level(full, 440.0) * 0.01);
  for (double hz : {100.0, 200.0, 880.0}) CHECK_NEAR(db(level(out, hz)), db(level(full, hz)), 0.2);

  // Only "other" (the mix minus the three separated parts).
  djn_deck_set_stem_gain(e, 0, DJN_STEM_DRUMS, 0.0f);
  djn_deck_set_stem_gain(e, 0, DJN_STEM_BASS, 0.0f);
  render(e, 0.1);
  out = render(e, 0.5);
  CHECK(level(out, 880.0) > 0.08);
  for (double hz : {100.0, 200.0, 440.0}) CHECK(level(out, hz) < level(full, hz) * 0.01);

  // Half level on bass.
  djn_deck_set_stem_gain(e, 0, DJN_STEM_BASS, 0.5f);
  render(e, 0.1);
  out = render(e, 0.5);
  CHECK_NEAR(db(level(out, 200.0)), db(level(full, 200.0)) - 6.02, 0.3);
  const djn_deck_state s = deckState(e, 0);
  CHECK_NEAR(s.stem_gain[DJN_STEM_BASS], 0.5, 1e-6);
  CHECK(s.stem_gain[DJN_STEM_VOCALS] == 0.0f);
}

TEST(stems_work_with_key_lock) {
  EngineHandle e;
  const Parts p = toneParts(8.0, kRate);
  CHECK(load(e, 0, p.mix, 120, 0) == DJN_OK);
  render(e, 0.02);
  CHECK(djn_deck_load_stems(e, 0, trackId(e, 0), p.drums.data(), p.bass.data(), p.vocals.data(),
                            int64_t(p.mix.size() / 2), 2, kRate) == DJN_OK);
  djn_deck_set_key_lock(e, 0, 1);
  djn_deck_set_pitch(e, 0, 0.08);  // stretcher path
  djn_deck_set_stem_gain(e, 0, DJN_STEM_DRUMS, 0.0f);
  djn_deck_play(e, 0);
  render(e, 0.5);
  const std::vector<float> out = render(e, 1.0);
  CHECK(level(out, 100.0) < 0.003);  // drums muted
  for (double hz : {200.0, 440.0, 880.0}) CHECK(level(out, hz) > 0.07);  // pitch kept, others there
}

TEST(stems_for_an_old_track_are_refused) {
  EngineHandle e;
  const Parts p = toneParts(3.0, kRate);
  const int64_t n = int64_t(p.mix.size() / 2);
  CHECK(load(e, 0, p.mix, 120, 0) == DJN_OK);
  render(e, 0.02);
  const uint32_t first = trackId(e, 0);
  CHECK(load(e, 0, p.mix, 120, 0) == DJN_OK);  // a new track replaces it
  render(e, 0.02);
  CHECK(trackId(e, 0) != first);
  CHECK(djn_deck_load_stems(e, 0, first, p.drums.data(), p.bass.data(), p.vocals.data(), n, 2, kRate) == DJN_ERR_STATE);
  // Wrong length: queued, then ignored by the deck.
  CHECK(djn_deck_load_stems(e, 0, trackId(e, 0), p.drums.data(), p.bass.data(), p.vocals.data(), n / 2, 2, kRate) == DJN_OK);
  render(e, 0.02);
  CHECK(deckState(e, 0).stems_loaded == 0);
  // Stem levels reset on load.
  CHECK(djn_deck_load_stems(e, 0, trackId(e, 0), p.drums.data(), p.bass.data(), p.vocals.data(), n, 2, kRate) == DJN_OK);
  djn_deck_set_stem_gain(e, 0, DJN_STEM_BASS, 0.0f);
  render(e, 0.02);
  CHECK(deckState(e, 0).stems_loaded == 1);
  CHECK(load(e, 0, p.mix, 120, 0) == DJN_OK);
  render(e, 0.02);
  CHECK(deckState(e, 0).stems_loaded == 0);
  CHECK(deckState(e, 0).stem_gain[DJN_STEM_BASS] == 1.0f);
  CHECK(djn_deck_set_stem_gain(e, 0, djn_stem(7), 0.0f) == DJN_ERR_INVALID_ARG);
}

// ---------------------------------------------------------------- separation

namespace {

// A small song with known parts: drums (kick, snare, hats), a bass line, a
// sung-like voice (harmonics with vibrato and vowel formants, centre) and
// wide stereo pads.
Parts songParts(double seconds, int rate) {
  const size_t n = size_t(seconds * rate);
  Parts p;
  for (auto* v : {&p.drums, &p.bass, &p.vocals, &p.other, &p.mix}) v->assign(n * 2, 0.0f);
  std::mt19937 rng(11);
  std::uniform_real_distribution<float> noise(-1.0f, 1.0f);
  const double spb = 60.0 / 124.0;
  const double bassNotes[4] = {55.0, 55.0, 43.65, 49.0};                // A1 A1 F1 G1
  const double chord[4][3] = {{220.0, 261.6, 329.6}, {220.0, 261.6, 329.6}, {174.6, 220.0, 261.6}, {196.0, 246.9, 293.7}};
  const double melody[8] = {440.0, 493.9, 523.3, 493.9, 440.0, 392.0, 349.2, 392.0};
  double phV = 0.0;
  float hp = 0.0f, prevNoise = 0.0f;
  for (size_t i = 0; i < n; ++i) {
    const double t = double(i) / rate;
    const double beat = t / spb;
    const int b = int(beat), bar = b / 4;
    const double tb = (beat - b) * spb;  // seconds since the beat
    // Drums
    double d = 0.9 * std::exp(-tb * 18.0) * std::sin(2.0 * kPi * (45.0 * tb + 60.0 * (1.0 - std::exp(-tb * 25.0)) / 25.0));
    if (b % 2 == 1) d += 0.35 * std::exp(-tb * 22.0) * noise(rng);
    const double off = std::fmod(beat + 0.5, 1.0) * spb;
    const float w = noise(rng);
    hp = w - prevNoise;
    prevNoise = w;
    d += 0.12 * std::exp(-off * 60.0) * hp;
    // Bass: sustained 8th notes
    const double fb = bassNotes[bar % 4];
    const double be = std::min(1.0, std::fmod(beat * 2.0, 1.0) * 20.0);
    double bs = 0.0;
    for (int h = 1; h <= 3; ++h) bs += std::sin(2.0 * kPi * fb * h * t) / h;
    bs *= 0.28 * be;
    // Voice: vowel "ah" on a melody, 2 beats on, 2 beats off, with vibrato.
    double v = 0.0;
    const int note = (b / 2) % 8;
    const bool singing = (b / 2) % 2 == 0;
    const double f0 = melody[note] * (1.0 + 0.012 * std::sin(2.0 * kPi * 5.5 * t));
    phV += f0 / rate;
    if (singing) {
      const double env = std::min(1.0, std::fmod(beat, 2.0) * 8.0) * std::min(1.0, (2.0 - std::fmod(beat, 2.0)) * 8.0);
      for (int h = 1; h <= 20; ++h) {
        const double fh = f0 * h;
        const double formant = std::exp(-std::pow((fh - 800.0) / 250.0, 2.0)) + 0.6 * std::exp(-std::pow((fh - 1200.0) / 300.0, 2.0)) +
                               0.3 * std::exp(-std::pow((fh - 2600.0) / 400.0, 2.0)) + 0.05;
        v += formant * std::sin(2.0 * kPi * phV * h) / std::sqrt(double(h));
      }
      v *= 0.10 * env;
    }
    // Pads: wide stereo (slightly detuned left/right), sustained.
    double pl = 0.0, pr = 0.0;
    for (int k = 0; k < 3; ++k) {
      const double f = chord[bar % 4][k];
      for (int h = 1; h <= 4; ++h) {
        pl += std::sin(2.0 * kPi * f * h * 1.003 * t) / (h * h);
        pr += std::sin(2.0 * kPi * f * h * 0.997 * t + 1.3) / (h * h);
      }
    }
    pl *= 0.05;
    pr *= 0.05;
    const float dd = float(d), bb = float(bs), vv = float(v);
    p.drums[i * 2] = p.drums[i * 2 + 1] = dd;
    p.bass[i * 2] = p.bass[i * 2 + 1] = bb;
    p.vocals[i * 2] = p.vocals[i * 2 + 1] = vv;
    p.other[i * 2] = float(pl);
    p.other[i * 2 + 1] = float(pr);
    p.mix[i * 2] = dd + bb + vv + float(pl);
    p.mix[i * 2 + 1] = dd + bb + vv + float(pr);
  }
  return p;
}

// Signal-to-distortion ratio of an estimate, in dB.
double sdr(const std::vector<float>& ref, const std::vector<float>& est) {
  double s = 0.0, e = 0.0;
  for (size_t i = 0; i < ref.size(); ++i) {
    s += double(ref[i]) * ref[i];
    e += double(ref[i] - est[i]) * (ref[i] - est[i]);
  }
  return 10.0 * std::log10(s / std::max(e, 1e-20));
}

}  // namespace

TEST(stems_separation_improves_on_the_mix) {
  const int rate = 44100;
  const Parts p = songParts(16.0, rate);
  const int64_t n = int64_t(p.mix.size() / 2);
  std::vector<float> drums(p.mix.size()), bass(p.mix.size()), vocals(p.mix.size());
  float lastProgress = -1.0f;
  auto cb = [](void* user, float pr) {
    *static_cast<float*>(user) = pr;
    return 0;
  };
  const auto t0 = std::chrono::steady_clock::now();
  CHECK(djn_separate_stems(p.mix.data(), n, 2, rate, drums.data(), bass.data(), vocals.data(), cb, &lastProgress) == DJN_OK);
  const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  std::printf("    separated %.0f s of audio in %.0f ms\n", double(n) / rate, ms);
  CHECK(lastProgress == 1.0f);
  std::vector<float> other(p.mix.size());
  for (size_t i = 0; i < other.size(); ++i) other[i] = p.mix[i] - drums[i] - bass[i] - vocals[i];

  // Improvement over doing nothing (using the whole mix as each stem).
  const double gain[4] = {sdr(p.drums, drums) - sdr(p.drums, p.mix), sdr(p.bass, bass) - sdr(p.bass, p.mix),
                          sdr(p.vocals, vocals) - sdr(p.vocals, p.mix), sdr(p.other, other) - sdr(p.other, p.mix)};
  std::printf("    SDR gain over the mix: drums %.1f dB, bass %.1f dB, vocals %.1f dB, other %.1f dB\n", gain[0], gain[1],
              gain[2], gain[3]);
  std::printf("    SDR: drums %.1f dB, bass %.1f dB, vocals %.1f dB, other %.1f dB\n", sdr(p.drums, drums),
              sdr(p.bass, bass), sdr(p.vocals, vocals), sdr(p.other, other));
  // Measured when written: gains 11.1 / 8.2 / 26.5 / 19.8 dB, SDR 7.5 / 10.4 / 10.0 / 6.9 dB.
  CHECK(gain[0] > 9.0);
  CHECK(gain[1] > 6.0);
  CHECK(gain[2] > 20.0);
  CHECK(gain[3] > 15.0);
  CHECK(sdr(p.drums, drums) > 5.5);
  CHECK(sdr(p.bass, bass) > 8.0);
  CHECK(sdr(p.vocals, vocals) > 7.5);
  CHECK(sdr(p.other, other) > 5.0);
}

TEST(stems_separation_can_be_cancelled_and_checks_input) {
  const int rate = 22050;
  const Parts p = toneParts(6.0, rate);
  const int64_t n = int64_t(p.mix.size() / 2);
  std::vector<float> a(p.mix.size()), b(p.mix.size()), c(p.mix.size());
  auto stop = [](void*, float pr) { return pr > 0.2f ? 1 : 0; };
  CHECK(djn_separate_stems(p.mix.data(), n, 2, rate, a.data(), b.data(), c.data(), stop, nullptr) == DJN_ERR_CANCELLED);
  CHECK(djn_separate_stems(nullptr, n, 2, rate, a.data(), b.data(), c.data(), nullptr, nullptr) == DJN_ERR_INVALID_ARG);
  CHECK(djn_separate_stems(p.mix.data(), n, 3, rate, a.data(), b.data(), c.data(), nullptr, nullptr) == DJN_ERR_INVALID_ARG);
  // Mono works too.
  std::vector<float> mono(static_cast<size_t>(n));
  for (int64_t i = 0; i < n; ++i) mono[size_t(i)] = p.mix[size_t(i) * 2];
  CHECK(djn_separate_stems(mono.data(), n, 1, rate, a.data(), b.data(), c.data(), nullptr, nullptr) == DJN_OK);
}
