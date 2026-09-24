// CPU benchmark: how many times faster than real time the engine renders.
// Run on target devices; the budget for a 256-frame block at 48 kHz is 5.3 ms.
#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>

#include "djnexus/djnexus.h"

namespace {

double run(int decks, bool keyLock, bool isolator, int block) {
  const int rate = 48000;
  djn_engine_config cfg{rate, block, decks};
  djn_engine* e = djn_engine_create(&cfg);
  std::vector<float> pcm(size_t(rate) * 120 * 2);
  for (size_t i = 0; i < pcm.size() / 2; ++i) {
    const double t = double(i) / rate;
    pcm[2 * i] = pcm[2 * i + 1] = float(0.3 * std::sin(2 * 3.14159265 * 110 * t) + 0.2 * std::sin(2 * 3.14159265 * 1760 * t));
  }
  for (int d = 0; d < decks; ++d) {
    djn_deck_load_pcm(e, d, pcm.data(), int64_t(pcm.size() / 2), 2, rate, 124 + d, 0);
    djn_deck_set_key_lock(e, d, keyLock);
    djn_deck_set_pitch(e, d, 0.03 * (d + 1));
    djn_mixer_set_filter(e, d, d % 2 ? 0.4f : -0.4f);
    djn_deck_play(e, d);
  }
  if (isolator) djn_mixer_set_eq_mode(e, DJN_EQ_ISOLATOR);
  std::vector<float> out(size_t(block) * 2);
  const int seconds = 60;
  const int blocks = seconds * rate / block;
  const auto t0 = std::chrono::steady_clock::now();
  for (int b = 0; b < blocks; ++b) djn_engine_process(e, out.data(), block, 2);
  const double elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
  djn_engine_destroy(e);
  return seconds / elapsed;
}

}  // namespace

int main() {
  std::printf("DJ Nexus engine benchmark (60 s of audio per case)\n");
  std::printf("%-44s %12s\n", "case", "x realtime");
  struct Case { const char* name; int decks; bool keyLock; bool iso; int block; } cases[] = {
      {"2 decks, varispeed, classic EQ, 256", 2, false, false, 256},
      {"2 decks, key lock, classic EQ, 256", 2, true, false, 256},
      {"4 decks, key lock, isolator EQ, 256", 4, true, true, 256},
      {"4 decks, key lock, isolator EQ, 64", 4, true, true, 64},
  };
  for (const auto& c : cases) std::printf("%-44s %12.1f\n", c.name, run(c.decks, c.keyLock, c.iso, c.block));
  return 0;
}
