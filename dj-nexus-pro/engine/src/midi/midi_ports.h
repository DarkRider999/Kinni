// Hardware MIDI ports. Desktop and iOS use RtMidi (WinMM, CoreMIDI, ALSA);
// Android and the web have no in-engine ports: the app forwards bytes from
// android.media.midi / Web MIDI with djn_midi_feed instead.
#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace djn {
namespace midi {

class Ports {
 public:
  using Bytes = std::function<void(const uint8_t*, size_t)>;
  virtual ~Ports() = default;
  virtual int inputCount() = 0;
  virtual int outputCount() = 0;
  virtual std::string inputName(int index) = 0;
  virtual std::string outputName(int index) = 0;
  virtual bool openInput(int index, Bytes onBytes) = 0;  // replaces any open input
  virtual bool openOutput(int index) = 0;                // replaces any open output
  virtual bool outputOpen() = 0;
  virtual void send(const uint8_t* bytes, size_t length) = 0;
  virtual void close() = 0;
};

std::unique_ptr<Ports> makePorts();

}  // namespace midi
}  // namespace djn
