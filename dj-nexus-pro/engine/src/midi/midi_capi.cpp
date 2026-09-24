// C API for MIDI controllers: a Controller, its ports and (optionally) a
// service thread that drives jog timing and LED feedback.
//
// Locking: the controller has its own mutex; `portMu` guards the hardware
// ports. They are never held together, so the input callback (which feeds the
// controller) can't deadlock against a port being closed. LED bytes always go
// through the controller's queue and are flushed to the output port here.
#include <algorithm>
#include <cstring>
#include <memory>
#include <new>
#include <string>

#if !defined(DJN_NO_THREADS)
#include <atomic>
#include <chrono>
#include <thread>
#endif

#include "djnexus/djnexus.h"
#include "midi_controller.h"
#include "midi_ports.h"

struct djn_midi {
  explicit djn_midi(djn_engine* e) : controller(e) {}
  djn::midi::Controller controller;
  std::unique_ptr<djn::midi::Ports> ports;
  djn::Mutex portMu;
#if !defined(DJN_NO_THREADS)
  std::atomic<bool> running{false};
  std::thread service;
#endif
};

namespace {

int copyString(const std::string& s, char* buf, int32_t size) {
  if (!buf || size <= 0) return DJN_ERR_INVALID_ARG;
  const size_t n = std::min(s.size(), size_t(size - 1));
  std::memcpy(buf, s.data(), n);
  buf[n] = '\0';
  return DJN_OK;
}

// Service tick: jog physics and LEDs, then LED bytes out to the hardware port.
void serviceAndFlush(djn_midi* m, double now) {
  m->controller.service(now);
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  if (!m->ports->outputOpen()) return;
  uint8_t buf[768];
  size_t n;
  while ((n = m->controller.readOutput(buf, sizeof(buf))) > 0) m->ports->send(buf, n);
}

}  // namespace

DJN_API djn_midi* djn_midi_create(djn_engine* engine, int32_t flags) {
  if (!engine) return nullptr;
  djn_midi* m = nullptr;
  DJN_TRY {
    m = new djn_midi(engine);
    m->ports = djn::midi::makePorts();
  }
  DJN_CATCH_BAD_ALLOC(delete m; return nullptr)
#if !defined(DJN_NO_THREADS)
  if (!(flags & DJN_MIDI_MANUAL_SERVICE)) {
    m->running = true;
    m->service = std::thread([m] {
      using clock = std::chrono::steady_clock;
      const auto start = clock::now();
      while (m->running.load()) {
        serviceAndFlush(m, std::chrono::duration<double>(clock::now() - start).count());
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
      }
    });
  }
#else
  (void)flags;
#endif
  return m;
}

DJN_API void djn_midi_destroy(djn_midi* m) {
  if (!m) return;
#if !defined(DJN_NO_THREADS)
  m->running = false;
  if (m->service.joinable()) m->service.join();
#endif
  if (m->ports) m->ports->close();  // stops input callbacks before the controller goes away
  delete m;
}

DJN_API int32_t djn_midi_input_count(djn_midi* m) {
  if (!m) return 0;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  return m->ports->inputCount();
}

DJN_API int32_t djn_midi_output_count(djn_midi* m) {
  if (!m) return 0;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  return m->ports->outputCount();
}

DJN_API int djn_midi_input_name(djn_midi* m, int32_t i, char* buf, int32_t size) {
  if (!m) return DJN_ERR_INVALID_ARG;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  if (i < 0 || i >= m->ports->inputCount()) return DJN_ERR_INVALID_ARG;
  return copyString(m->ports->inputName(i), buf, size);
}

DJN_API int djn_midi_output_name(djn_midi* m, int32_t i, char* buf, int32_t size) {
  if (!m) return DJN_ERR_INVALID_ARG;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  if (i < 0 || i >= m->ports->outputCount()) return DJN_ERR_INVALID_ARG;
  return copyString(m->ports->outputName(i), buf, size);
}

DJN_API int djn_midi_open_input(djn_midi* m, int32_t i) {
  if (!m) return DJN_ERR_INVALID_ARG;
  auto* c = &m->controller;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  return m->ports->openInput(i, [c](const uint8_t* b, size_t n) { c->feed(b, n); }) ? DJN_OK : DJN_ERR_DEVICE;
}

DJN_API int djn_midi_open_output(djn_midi* m, int32_t i) {
  if (!m) return DJN_ERR_INVALID_ARG;
  {
    djn::LockGuard<djn::Mutex> lock(m->portMu);
    if (!m->ports->openOutput(i)) return DJN_ERR_DEVICE;
  }
  m->controller.readOutput(nullptr, size_t(-1));  // drop stale queued bytes
  m->controller.resendLeds();                     // and light the new device up from scratch
  return DJN_OK;
}

DJN_API int djn_midi_close_ports(djn_midi* m) {
  if (!m) return DJN_ERR_INVALID_ARG;
  djn::LockGuard<djn::Mutex> lock(m->portMu);
  m->ports->close();
  return DJN_OK;
}

DJN_API int djn_midi_feed(djn_midi* m, const uint8_t* bytes, int32_t length) {
  if (!m || (!bytes && length > 0) || length < 0) return DJN_ERR_INVALID_ARG;
  m->controller.feed(bytes, size_t(length));
  return DJN_OK;
}

DJN_API int32_t djn_midi_read_output(djn_midi* m, uint8_t* buf, int32_t size) {
  if (!m || !buf || size <= 0) return 0;
  return int32_t(m->controller.readOutput(buf, size_t(size)));
}

DJN_API int djn_midi_load_mapping(djn_midi* m, const char* text, char* error, int32_t error_size) {
  if (!m || !text) return DJN_ERR_INVALID_ARG;
  std::string err;
  if (m->controller.load(text, err)) {
    if (error && error_size > 0) error[0] = '\0';
    return DJN_OK;
  }
  if (error) copyString(err, error, error_size);
  return DJN_ERR_INVALID_ARG;
}

DJN_API int32_t djn_midi_get_mapping(djn_midi* m, char* buf, int32_t size) {
  if (!m) return 0;
  const std::string s = m->controller.text();
  if (buf && size > 0) copyString(s, buf, size);
  return int32_t(s.size());
}

DJN_API int djn_midi_learn(djn_midi* m, const char* action) {
  if (!m) return DJN_ERR_INVALID_ARG;
  std::string err;
  return m->controller.learn(action, err) ? DJN_OK : DJN_ERR_INVALID_ARG;
}

DJN_API int32_t djn_midi_learning(djn_midi* m) { return m && m->controller.learning() ? 1 : 0; }

DJN_API int djn_midi_service(djn_midi* m, double now_seconds) {
  if (!m) return DJN_ERR_INVALID_ARG;
  serviceAndFlush(m, now_seconds);
  return DJN_OK;
}

DJN_API int32_t djn_midi_last_message(djn_midi* m, uint8_t out[3]) {
  if (!m || !out) return 0;
  return m->controller.lastMessage(out);
}
