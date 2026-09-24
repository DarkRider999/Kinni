// Minimal test harness: no external dependencies, so the tests build anywhere
// the engine builds.
#pragma once

#include <cmath>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

namespace djntest {

struct TestCase {
  const char* name;
  std::function<void()> fn;
};

std::vector<TestCase>& registry();
extern int g_failures;

struct Registrar {
  Registrar(const char* name, std::function<void()> fn) { registry().push_back({name, std::move(fn)}); }
};

}  // namespace djntest

#define DJN_CONCAT2(a, b) a##b
#define DJN_CONCAT(a, b) DJN_CONCAT2(a, b)
#define TEST(name)                                                                       \
  static void name();                                                                    \
  static djntest::Registrar DJN_CONCAT(reg_, name)(#name, name);                         \
  static void name()

#define CHECK(cond)                                                                      \
  do {                                                                                   \
    if (!(cond)) {                                                                       \
      std::printf("    FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);                    \
      ++djntest::g_failures;                                                             \
    }                                                                                    \
  } while (0)

#define CHECK_NEAR(a, b, tol)                                                            \
  do {                                                                                   \
    const double va_ = double(a), vb_ = double(b);                                       \
    if (!(std::fabs(va_ - vb_) <= double(tol))) {                                        \
      std::printf("    FAIL %s:%d: %s = %g, expected %g +- %g\n", __FILE__, __LINE__, #a, \
                  va_, vb_, double(tol));                                                \
      ++djntest::g_failures;                                                             \
    }                                                                                    \
  } while (0)
