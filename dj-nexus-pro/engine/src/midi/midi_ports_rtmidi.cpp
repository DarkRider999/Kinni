#include <memory>
#include <vector>

#include "RtMidi.h"
#include "midi_ports.h"

namespace djn {
namespace midi {

namespace {

// RtMidi reports failures by throwing RtMidiError, or through an error
// callback. Everything here is caught and turned into a false return.
void quiet(RtMidiError::Type, const std::string&, void*) {}

class RtPorts final : public Ports {
 public:
  ~RtPorts() override { close(); }

  // The MIDI clients are created on first use, so an engine that never
  // touches hardware ports never talks to the OS MIDI service.
  void ensure() {
    if (tried_) return;
    tried_ = true;
    try {
      in_.reset(new RtMidiIn(RtMidi::UNSPECIFIED, "DJ Nexus Pro"));
      in_->setErrorCallback(&quiet, nullptr);
    } catch (const RtMidiError&) {
      in_.reset();
    }
    try {
      out_.reset(new RtMidiOut(RtMidi::UNSPECIFIED, "DJ Nexus Pro"));
      out_->setErrorCallback(&quiet, nullptr);
    } catch (const RtMidiError&) {
      out_.reset();
    }
  }

  int inputCount() override {
    ensure();
    try {
      return in_ ? int(in_->getPortCount()) : 0;
    } catch (const RtMidiError&) {
      return 0;
    }
  }
  int outputCount() override {
    ensure();
    try {
      return out_ ? int(out_->getPortCount()) : 0;
    } catch (const RtMidiError&) {
      return 0;
    }
  }
  std::string inputName(int i) override {
    ensure();
    try {
      return in_ && i >= 0 ? in_->getPortName(unsigned(i)) : std::string();
    } catch (const RtMidiError&) {
      return {};
    }
  }
  std::string outputName(int i) override {
    ensure();
    try {
      return out_ && i >= 0 ? out_->getPortName(unsigned(i)) : std::string();
    } catch (const RtMidiError&) {
      return {};
    }
  }

  bool openInput(int i, Bytes onBytes) override {
    ensure();
    if (!in_ || i < 0 || i >= inputCount()) return false;
    try {
      if (in_->isPortOpen()) {
        in_->cancelCallback();
        in_->closePort();
      }
      onBytes_ = std::move(onBytes);
      in_->ignoreTypes(true, true, true);  // SysEx, clock, active sensing
      in_->setCallback(&RtPorts::onMessage, this);
      in_->openPort(unsigned(i), "DJ Nexus Pro In");
      return in_->isPortOpen();
    } catch (const RtMidiError&) {
      return false;
    }
  }

  bool openOutput(int i) override {
    ensure();
    if (!out_ || i < 0 || i >= outputCount()) return false;
    try {
      if (out_->isPortOpen()) out_->closePort();
      out_->openPort(unsigned(i), "DJ Nexus Pro Out");
      return out_->isPortOpen();
    } catch (const RtMidiError&) {
      return false;
    }
  }

  bool outputOpen() override { return out_ && out_->isPortOpen(); }

  void send(const uint8_t* bytes, size_t length) override {
    if (!outputOpen() || length == 0) return;
    try {
      out_->sendMessage(bytes, length);
    } catch (const RtMidiError&) {
    }
  }

  void close() override {
    try {
      if (in_ && in_->isPortOpen()) {
        in_->cancelCallback();
        in_->closePort();
      }
      if (out_ && out_->isPortOpen()) out_->closePort();
    } catch (const RtMidiError&) {
    }
  }

 private:
  static void onMessage(double, std::vector<unsigned char>* msg, void* user) {
    auto* self = static_cast<RtPorts*>(user);
    if (msg && !msg->empty() && self->onBytes_) self->onBytes_(msg->data(), msg->size());
  }

  std::unique_ptr<RtMidiIn> in_;
  std::unique_ptr<RtMidiOut> out_;
  Bytes onBytes_;
  bool tried_ = false;
};

}  // namespace

std::unique_ptr<Ports> makePorts() { return std::unique_ptr<Ports>(new RtPorts()); }

}  // namespace midi
}  // namespace djn
