// Offline mix renderer: loads two tracks, beat-syncs B to A and performs a
// 16-bar bass-swap transition, writing the result to a WAV file. Useful for
// listening tests on any machine, with no audio device needed.
//
//   djnexus_render A.mp3 BPM_A FIRST_BEAT_A  B.mp3 BPM_B FIRST_BEAT_B  out.wav [mix_at_sec]
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "djnexus/djnexus.h"
#include "utf8_args.h"

int main(int argc, char** argv) {
  argv = utf8Argv(argc, argv);
  if (argc < 8) {
    std::fprintf(stderr,
                 "usage: %s A.wav BPM_A FIRST_BEAT_A B.wav BPM_B FIRST_BEAT_B out.wav [mix_at_sec=60] [key_lock=1]\n",
                 argv[0]);
    return 2;
  }
  const double bpmA = std::atof(argv[2]), fbA = std::atof(argv[3]);
  const double bpmB = std::atof(argv[5]), fbB = std::atof(argv[6]);
  const double mixAt = argc > 8 ? std::atof(argv[8]) : 60.0;
  const int keyLock = argc > 9 ? std::atoi(argv[9]) : 1;

  const int rate = 48000, block = 512;
  djn_engine_config cfg{rate, block, 2};
  djn_engine* e = djn_engine_create(&cfg);
  if (djn_deck_load_file(e, 0, argv[1], bpmA, fbA) != DJN_OK || djn_deck_load_file(e, 1, argv[4], bpmB, fbB) != DJN_OK) {
    std::fprintf(stderr, "could not load input files\n");
    djn_engine_destroy(e);
    return 1;
  }
  djn_mixer_set_eq_mode(e, DJN_EQ_ISOLATOR);
  djn_mixer_set_xfader_assign(e, 0, DJN_XF_A);
  djn_mixer_set_xfader_assign(e, 1, DJN_XF_B);
  djn_mixer_set_crossfader_curve(e, DJN_XF_CURVE_SHARP);  // both full in the middle
  djn_mixer_set_crossfader(e, 0.5f);
  djn_deck_set_key_lock(e, 1, keyLock);
  djn_deck_set_sync(e, 1, 1);
  djn_mixer_set_eq_db(e, 1, 0, -80);  // B starts with its bass killed
  djn_mixer_set_fader(e, 1, 0.0f);
  djn_deck_seek(e, 1, fbB);
  djn_deck_play(e, 0);

  if (djn_record_start(e, argv[7], DJN_REC_WAV24) != DJN_OK) {
    std::fprintf(stderr, "could not open %s\n", argv[7]);
    djn_engine_destroy(e);
    return 1;
  }

  const double barSec = 4 * 60.0 / bpmA;
  const double t0 = mixAt, t1 = mixAt + 8 * barSec, t2 = mixAt + 16 * barSec, end = t2 + 16 * barSec;
  std::vector<float> out(size_t(block) * 2);
  bool bStarted = false, swapped = false;
  for (double t = 0; t < end; t += double(block) / rate) {
    if (!bStarted && t >= t0) {
      djn_deck_play(e, 1);  // sync snaps B onto A's beat
      bStarted = true;
    }
    if (t >= t0 && t < t1) djn_mixer_set_fader(e, 1, float((t - t0) / (t1 - t0)));  // bring B in over 8 bars
    if (!swapped && t >= t1) {
      djn_mixer_set_eq_db(e, 0, 0, -80);  // bass swap on the bar
      djn_mixer_set_eq_db(e, 1, 0, 0);
      swapped = true;
    }
    if (t >= t1 && t < t2) djn_mixer_set_fader(e, 0, float(1.0 - (t - t1) / (t2 - t1)));  // A out over 8 bars
    djn_engine_process(e, out.data(), block, 2);
  }
  djn_record_stop(e);
  djn_engine_state s;
  djn_engine_get_state(e, &s);
  std::printf("wrote %s: %.1f s, B synced to %.2f BPM\n", argv[7], s.recorded_sec, s.decks[1].effective_bpm);
  djn_engine_destroy(e);
  return 0;
}
