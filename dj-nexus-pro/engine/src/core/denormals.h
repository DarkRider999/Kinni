// Flush denormal floats to zero for the duration of an audio callback.
// Decaying filter and reverb tails otherwise hit very slow denormal arithmetic.
#pragma once

#include <cstdint>

#if defined(__SSE__) || defined(_M_X64) || (defined(_M_IX86_FP) && _M_IX86_FP >= 1)
#include <xmmintrin.h>
#define DJN_X86_DENORMALS 1
#endif

namespace djn {

class ScopedFlushDenormals {
 public:
  ScopedFlushDenormals() {
#if defined(DJN_X86_DENORMALS)
    saved_ = _mm_getcsr();
    _mm_setcsr(saved_ | 0x8040);  // FTZ | DAZ
#elif defined(__aarch64__)
    uint64_t fpcr;
    __asm__ __volatile__("mrs %0, fpcr" : "=r"(fpcr));
    saved_ = fpcr;
    fpcr |= (uint64_t(1) << 24);  // FZ
    __asm__ __volatile__("msr fpcr, %0" : : "r"(fpcr));
#elif defined(__arm__) && defined(__ARM_FP)
    uint32_t fpscr;
    __asm__ __volatile__("vmrs %0, fpscr" : "=r"(fpscr));
    saved_ = fpscr;
    fpscr |= (1u << 24);  // FZ
    __asm__ __volatile__("vmsr fpscr, %0" : : "r"(fpscr));
#endif
  }

  ~ScopedFlushDenormals() {
#if defined(DJN_X86_DENORMALS)
    _mm_setcsr(static_cast<unsigned int>(saved_));
#elif defined(__aarch64__)
    uint64_t fpcr = saved_;
    __asm__ __volatile__("msr fpcr, %0" : : "r"(fpcr));
#elif defined(__arm__) && defined(__ARM_FP)
    uint32_t fpscr = static_cast<uint32_t>(saved_);
    __asm__ __volatile__("vmsr fpscr, %0" : : "r"(fpscr));
#endif
  }

  ScopedFlushDenormals(const ScopedFlushDenormals&) = delete;
  ScopedFlushDenormals& operator=(const ScopedFlushDenormals&) = delete;

 private:
  uint64_t saved_ = 0;
};

}  // namespace djn
