// Portability switches. DJN_NO_THREADS is set for the WebAssembly build,
// where the engine runs inside a single AudioWorklet thread.
#pragma once

#if defined(DJN_NO_THREADS)
namespace djn {
struct Mutex {
  void lock() {}
  void unlock() {}
};
template <typename M>
struct LockGuard {
  explicit LockGuard(M&) {}
};
}  // namespace djn
#else
#include <mutex>
namespace djn {
using Mutex = std::mutex;
template <typename M>
using LockGuard = std::lock_guard<M>;
}  // namespace djn
#endif

// try/catch only where the toolchain has exceptions (WASI builds don't).
#if defined(__cpp_exceptions) || defined(_CPPUNWIND)
#define DJN_TRY try
#define DJN_CATCH_BAD_ALLOC(stmt) catch (const std::bad_alloc&) { stmt; }
#else
#define DJN_TRY
#define DJN_CATCH_BAD_ALLOC(stmt)
#endif
