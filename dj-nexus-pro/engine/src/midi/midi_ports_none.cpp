#include "midi_ports.h"

namespace djn {
namespace midi {

namespace {
class NoPorts final : public Ports {
 public:
  int inputCount() override { return 0; }
  int outputCount() override { return 0; }
  std::string inputName(int) override { return {}; }
  std::string outputName(int) override { return {}; }
  bool openInput(int, Bytes) override { return false; }
  bool openOutput(int) override { return false; }
  bool outputOpen() override { return false; }
  void send(const uint8_t*, size_t) override {}
  void close() override {}
};
}  // namespace

std::unique_ptr<Ports> makePorts() { return std::unique_ptr<Ports>(new NoPorts()); }

}  // namespace midi
}  // namespace djn
