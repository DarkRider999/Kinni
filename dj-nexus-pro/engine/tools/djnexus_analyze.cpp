// Prints tempo, beat grid and key for audio files.
//
//   djnexus_analyze [--range 88-175] [--csv] track.mp3 [more files...]
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "djnexus/djnexus.h"
#include "utf8_args.h"

int main(int argc, char** argv) {
  argv = utf8Argv(argc, argv);
  djn_analysis_options opt;
  djn_analysis_default_options(&opt);
  bool csv = false;
  int first = 1;
  for (; first < argc && argv[first][0] == '-' && argv[first][1] == '-'; ++first) {
    if (!std::strcmp(argv[first], "--csv")) {
      csv = true;
    } else if (!std::strcmp(argv[first], "--range") && first + 1 < argc) {
      if (std::sscanf(argv[++first], "%lf-%lf", &opt.min_bpm, &opt.max_bpm) != 2) {
        std::fprintf(stderr, "--range wants MIN-MAX, e.g. 88-175\n");
        return 2;
      }
    } else {
      std::fprintf(stderr, "unknown option %s\n", argv[first]);
      return 2;
    }
  }
  if (first >= argc) {
    std::fprintf(stderr, "usage: %s [--range 78-180] [--csv] file...\n", argv[0]);
    return 2;
  }
  if (csv) std::printf("file,bpm,first_beat_sec,tempo_stable,bpm_confidence,downbeat_confidence,key,camelot,open_key,key_confidence,tuning_cents\n");
  int failures = 0;
  for (int i = first; i < argc; ++i) {
    djn_analysis a;
    const auto t0 = std::chrono::steady_clock::now();
    const int r = djn_analyze_file(argv[i], &opt, &a);
    const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    if (r != DJN_OK) {
      std::fprintf(stderr, "%s: could not read (error %d)\n", argv[i], r);
      ++failures;
      continue;
    }
    if (csv) {
      std::printf("\"%s\",%.3f,%.4f,%d,%.2f,%.2f,%s,%s,%s,%.2f,%.1f\n", argv[i], a.bpm, a.first_beat_sec, a.tempo_stable,
                  a.bpm_confidence, a.downbeat_confidence, a.key_name, a.camelot, a.open_key, a.key_confidence,
                  a.tuning_cents);
    } else {
      std::printf("%s\n  BPM %.2f%s  first downbeat %.3f s  (confidence %.2f, downbeat %.2f)\n", argv[i], a.bpm,
                  a.tempo_stable ? "" : " (tempo varies)", a.first_beat_sec, a.bpm_confidence, a.downbeat_confidence);
      if (a.key >= 0) {
        std::printf("  Key %s  %s / %s  (confidence %.2f, tuning %+.0f cents)\n", a.key_name, a.camelot, a.open_key,
                    a.key_confidence, a.tuning_cents);
      } else {
        std::printf("  Key: none found\n");
      }
      std::printf("  analyzed in %.0f ms\n", ms);
    }
  }
  return failures ? 1 : 0;
}
