// Real-time desktop player: two decks on the default sound card, driven by
// typed commands. A quick way to hear the engine on Windows, macOS or Linux.
//
//   djnexus_play A.mp3 [BPM_A] [B.mp3] [BPM_B]
//
// A BPM of 0 (or omitted) runs the offline analyzer (djn_analyze_file) to
// detect BPM, first-beat and musical key before loading.
//
// Commands (deck is a or b):  a play | a cue | a sync | a key | a loop 4 | a exit
//   a pitch 0.04 | a hot 0 | a sethot 0 | a eq low -26 | a filter -0.5 | x 0.5 | rec out.wav | stop | info | q
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>

#include "djnexus/djnexus.h"
#include "utf8_args.h"

namespace {

// Loads `path` onto `deck`, analyzing for BPM/key first when `bpmOverride`
// is 0 (not supplied on the command line).
int loadWithAnalysis(djn_engine* e, int32_t deck, const char* path, double bpmOverride) {
  if (bpmOverride > 0.0) return djn_deck_load_file(e, deck, path, bpmOverride, 0.0);

  djn_analysis_result a;
  const int ar = djn_analyze_file(path, &a);
  if (ar == DJN_OK && a.bpm > 0.0) {
    char camelot[8] = "?";
    if (a.key_pitch_class >= 0) djn_camelot_code(a.key_pitch_class, a.key_is_minor, camelot, sizeof(camelot));
    std::printf("analyzed %s: %.1f BPM (confidence %.0f%%), key %s (confidence %.0f%%)\n", path, a.bpm,
                a.bpm_confidence * 100, camelot, a.key_confidence * 100);
    const int r = djn_deck_load_file(e, deck, path, a.bpm, a.first_beat_sec);
    if (r != DJN_OK) return r;
    // Auto cue points: intro end / drop / outro start land on hot cues 1-3.
    if (a.intro_end_sec >= 0.0) djn_deck_hot_cue_set_at(e, deck, 0, a.intro_end_sec);
    if (a.drop_sec >= 0.0) djn_deck_hot_cue_set_at(e, deck, 1, a.drop_sec);
    if (a.outro_start_sec >= 0.0) djn_deck_hot_cue_set_at(e, deck, 2, a.outro_start_sec);
    std::printf("  auto cues: intro end %.1fs, drop %.1fs, outro start %.1fs\n", a.intro_end_sec, a.drop_sec,
                a.outro_start_sec);
    return DJN_OK;
  }
  if (ar != DJN_OK) std::fprintf(stderr, "analysis unavailable for %s (err %d); loading without a grid\n", path, ar);
  else std::printf("analyzed %s: no clear tempo found; loading without a grid\n", path);
  return djn_deck_load_file(e, deck, path, 0.0, 0.0);
}

}  // namespace

int main(int argc, char** argv) {
  argv = utf8Argv(argc, argv);
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s A.wav [BPM_A] [B.wav] [BPM_B]\n", argv[0]);
    return 2;
  }
  djn_engine_config cfg{djn_host_preferred_sample_rate(), 1024, 2};
  djn_engine* e = djn_engine_create(&cfg);
  if (!e) return 1;
  if (loadWithAnalysis(e, 0, argv[1], argc > 2 ? std::atof(argv[2]) : 0.0) != DJN_OK) {
    std::fprintf(stderr, "could not load %s\n", argv[1]);
  }
  if (argc > 3 && loadWithAnalysis(e, 1, argv[3], argc > 4 ? std::atof(argv[4]) : 0.0) != DJN_OK) {
    std::fprintf(stderr, "could not load %s\n", argv[3]);
  }
  djn_mixer_set_xfader_assign(e, 0, DJN_XF_A);
  djn_mixer_set_xfader_assign(e, 1, DJN_XF_B);

  djn_host_config hc{};
  hc.output_channels = 2;
  hc.buffer_frames = 256;
  djn_host* host = djn_host_start(e, &hc);
  if (!host) {
    std::fprintf(stderr, "could not open the audio device\n");
    djn_engine_destroy(e);
    return 1;
  }
  djn_host_info info;
  djn_host_get_info(host, &info);
  std::printf("audio: %s, %d Hz, %d frames, ~%.1f ms output latency\n", info.backend, info.sample_rate,
              info.buffer_frames, info.output_latency_ms);
  std::printf("type commands, e.g. 'a play', 'b sync', 'b play', 'x 0.5', 'info', 'q'\n");

  std::string line;
  while (std::printf("> "), std::fflush(stdout), std::getline(std::cin, line)) {
    std::istringstream in(line);
    std::string w0, w1, w2;
    in >> w0 >> w1 >> w2;
    djn_engine_collect_garbage(e);
    if (w0 == "q" || w0 == "quit") break;
    if (w0 == "x") { djn_mixer_set_crossfader(e, float(std::atof(w1.c_str()))); continue; }
    if (w0 == "rec") { std::printf("%s\n", djn_record_start(e, w1.c_str(), DJN_REC_WAV16) == DJN_OK ? "recording" : "failed"); continue; }
    if (w0 == "stop") { djn_record_stop(e); continue; }
    if (w0 == "info") {
      djn_engine_state s;
      djn_engine_get_state(e, &s);
      for (int d = 0; d < 2; ++d) {
        const auto& k = s.decks[d];
        std::printf("%c: %s %6.2f/%6.2f s  %6.2f BPM  phase %.2f%s%s%s\n", 'a' + d, k.playing ? "PLAY " : "pause",
                    k.position_sec, k.duration_sec, k.effective_bpm, k.beat_phase, k.sync ? " SYNC" : "",
                    k.is_master ? " MASTER" : "", k.looping ? " LOOP" : "");
      }
      std::printf("dsp load %.1f%%  limiter reduction %.1f dB\n", s.dsp_load * 100, s.limiter_gain_reduction_db);
      continue;
    }
    if (w0 != "a" && w0 != "b") { std::printf("?\n"); continue; }
    const int d = w0 == "a" ? 0 : 1;
    if (w1 == "play") djn_deck_toggle_play(e, d);
    else if (w1 == "cue") djn_deck_cue(e, d);
    else if (w1 == "sync") { static int on[2]; on[d] ^= 1; djn_deck_set_sync(e, d, on[d]); }
    else if (w1 == "key") { static int on[2]; on[d] ^= 1; djn_deck_set_key_lock(e, d, on[d]); }
    else if (w1 == "slip") { static int on[2]; on[d] ^= 1; djn_deck_set_slip(e, d, on[d]); }
    else if (w1 == "rev") { static int on[2]; on[d] ^= 1; djn_deck_set_reverse(e, d, on[d]); }
    else if (w1 == "loop") djn_deck_loop_beats(e, d, w2.empty() ? 4 : std::atof(w2.c_str()));
    else if (w1 == "exit") djn_deck_loop_exit(e, d);
    else if (w1 == "pitch") djn_deck_set_pitch(e, d, std::atof(w2.c_str()));
    else if (w1 == "hot") djn_deck_hot_cue_trigger(e, d, std::atoi(w2.c_str()));
    else if (w1 == "sethot") djn_deck_hot_cue_set(e, d, std::atoi(w2.c_str()));
    else if (w1 == "seek") djn_deck_seek(e, d, std::atof(w2.c_str()));
    else if (w1 == "filter") djn_mixer_set_filter(e, d, float(std::atof(w2.c_str())));
    else if (w1 == "fader") djn_mixer_set_fader(e, d, float(std::atof(w2.c_str())));
    else if (w1 == "eq") {
      std::string v;
      in >> v;
      const int band = w2 == "low" ? 0 : (w2 == "mid" ? 1 : 2);
      djn_mixer_set_eq_db(e, d, band, float(std::atof(v.c_str())));
    } else std::printf("?\n");
  }

  djn_record_stop(e);
  djn_host_stop(host);
  djn_engine_destroy(e);
  return 0;
}
