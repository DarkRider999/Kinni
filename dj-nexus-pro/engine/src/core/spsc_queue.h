// Single-producer single-consumer lock-free queues. Used to pass commands from
// the control thread to the audio thread and released objects back again.
#pragma once

#include <atomic>
#include <cstddef>
#include <cstring>
#include <memory>
#include <type_traits>

namespace djn {

// Fixed-capacity queue of trivially copyable items.
template <typename T, size_t CapacityPow2>
class SpscQueue {
  static_assert((CapacityPow2 & (CapacityPow2 - 1)) == 0, "capacity must be a power of two");
  static_assert(std::is_trivially_copyable<T>::value, "T must be trivially copyable");

 public:
  bool push(const T& item) {
    const size_t w = write_.load(std::memory_order_relaxed);
    const size_t r = read_.load(std::memory_order_acquire);
    if (w - r == CapacityPow2) return false;
    items_[w & (CapacityPow2 - 1)] = item;
    write_.store(w + 1, std::memory_order_release);
    return true;
  }

  bool pop(T& out) {
    const size_t r = read_.load(std::memory_order_relaxed);
    const size_t w = write_.load(std::memory_order_acquire);
    if (r == w) return false;
    out = items_[r & (CapacityPow2 - 1)];
    read_.store(r + 1, std::memory_order_release);
    return true;
  }

 private:
  T items_[CapacityPow2]{};
  alignas(64) std::atomic<size_t> write_{0};
  alignas(64) std::atomic<size_t> read_{0};
};

// Float sample ring buffer (audio thread writes, disk thread reads).
class SampleRing {
 public:
  explicit SampleRing(size_t capacity_pow2) : mask_(capacity_pow2 - 1), data_(new float[capacity_pow2]()) {}

  size_t capacity() const { return mask_ + 1; }

  // Writes up to n samples; returns how many were written.
  size_t write(const float* src, size_t n) {
    const size_t w = write_.load(std::memory_order_relaxed);
    const size_t r = read_.load(std::memory_order_acquire);
    const size_t space = capacity() - (w - r);
    if (n > space) n = space;
    const size_t start = w & mask_;
    const size_t first = n < capacity() - start ? n : capacity() - start;
    std::memcpy(data_.get() + start, src, first * sizeof(float));
    std::memcpy(data_.get(), src + first, (n - first) * sizeof(float));
    write_.store(w + n, std::memory_order_release);
    return n;
  }

  size_t read(float* dst, size_t n) {
    const size_t r = read_.load(std::memory_order_relaxed);
    const size_t w = write_.load(std::memory_order_acquire);
    const size_t avail = w - r;
    if (n > avail) n = avail;
    const size_t start = r & mask_;
    const size_t first = n < capacity() - start ? n : capacity() - start;
    std::memcpy(dst, data_.get() + start, first * sizeof(float));
    std::memcpy(dst + first, data_.get(), (n - first) * sizeof(float));
    read_.store(r + n, std::memory_order_release);
    return n;
  }

  void reset() {
    read_.store(0);
    write_.store(0);
  }

 private:
  size_t mask_;
  std::unique_ptr<float[]> data_;
  alignas(64) std::atomic<size_t> write_{0};
  alignas(64) std::atomic<size_t> read_{0};
};

}  // namespace djn
