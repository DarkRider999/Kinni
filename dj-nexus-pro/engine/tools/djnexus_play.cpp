// Real-time desktop player: two decks on the default sound card, driven by
// typed commands. A quick way to hear the engine on Windows, macOS or Linux.
//
//   djnexus_play A.mp3 [BPM_A] [B.mp3] [BPM_B]
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

int main(int argc, char** argv) {
  argv = utf8Argv(argc, argv);
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s A.wav [BPM_A] [B.wav] [BPM_B]\n", argv[0]);
    return 2;
  }
  djn_engine_config cfg{djn_host_preferred_sample_rate(), 1024, 2};
  djn_engine* e = djn_engine_create(&cfg);
  if (!e) return 1;
  if (djn_deck_load_file(e, 0, argv[1], argc > 2 ? std::atof(argv[2]) : 0, 0) != DJN_OK) {
    std::fprintf(stderr, "could not load %s\n", argv[1]);
  }
  if (argc > 3 && djn_deck_load_file(e, 1, argv[3], argc > 4 ? std::atof(argv[4]) : 0, 0) != DJN_OK) {
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
