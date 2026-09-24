// Runs a MIDI mapping against the engine: incoming messages become engine
// calls (through the public C API), engine state becomes LED feedback.
#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

#include "djnexus/djnexus.h"
#include "midi_mapping.h"
#include "platform.h"

namespace djn {
namespace midi {

// A generic starting mapping: decks on MIDI channels 1-4, mixer on 7, FX on
// 5-6, and sampler pads on notes 36-51 of channel 10 (the usual drum-pad layout).
std::string defaultMappingText();

class Controller {
 public:
  explicit Controller(djn_engine* engine);

  bool load(const std::string& text, std::string& error);
  std::string text();

  void feed(const uint8_t* bytes, size_t length);
  bool learn(const char* action, std::string& error);  // nullptr cancels
  bool learning();

  void service(double now);  // jog physics + LED feedback
  size_t readOutput(uint8_t* buf, size_t size);
  // Forget which LED values were sent, so the next service() sends them all
  // (after a new output port opens).
  void resendLeds();
  int lastMessage(uint8_t out[3]);

 private:
  struct Jog {
    double ticks = 0.0;         // accumulated since the last service
    double ticksPerRev = 128.0;
    double rate = 0.0;          // smoothed platter speed (1 = normal)
    double sentNudge = 0.0;
    bool touched = false;
    bool vinyl = true;
  };

  void message(uint8_t status, uint8_t d1, uint8_t d2);
  void dispatch(const Control& c, double value01, int delta, int rawValue, bool isButtonPress, bool isButtonRelease);
  void apply(const Binding& b, double value01, int delta, bool press, bool release);
  int decodeRelative(Encoding enc, int v) const;
  void send(const uint8_t* b, size_t n);
  void sendLeds(bool force);

  djn_engine* engine_;
  Mutex mu_;
  Mapping mapping_;
  bool shift_ = false;
  bool learning_ = false;
  Binding learnBinding_;

  // Parser state
  uint8_t running_ = 0;
  uint8_t data_[2] = {0, 0};
  int have_ = 0;
  bool sysex_ = false;
  uint8_t last_[3] = {0, 0, 0};
  int lastLen_ = 0;

  std::array<std::array<int, 128>, 16> cc14Msb_{};
  std::array<std::array<int, 128>, 16> cc14Lsb_{};
  std::array<Jog, 4> jogs_{};
  std::array<bool, 4> pfl_{};
  std::array<bool, 4> quantize_{{true, true, true, true}};
  double lastService_ = -1.0;
  double lastDt_ = 0.005;
  std::array<double, 4> vu_{};        // meter LEDs with a fall-back, 0..1
  bool sendInit_ = true;              // one-shot sends due (after load / new output)
  std::vector<double> sendAt_;        // next due time per mapping send

  std::vector<uint8_t> out_;      // queued feedback bytes
  std::vector<int> ledSent_;      // last value sent per LED, -1 = unknown
};

}  // namespace midi
}  // namespace djn
