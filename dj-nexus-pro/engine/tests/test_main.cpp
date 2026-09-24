#include <cstring>

#include "test.h"

namespace djntest {
std::vector<TestCase>& registry() {
  static std::vector<TestCase> r;
  return r;
}
int g_failures = 0;
}  // namespace djntest

int main(int argc, char** argv) {
  const char* filter = argc > 1 ? argv[1] : nullptr;
  int run = 0, failedTests = 0;
  for (auto& t : djntest::registry()) {
    if (filter && !std::strstr(t.name, filter)) continue;
    const int before = djntest::g_failures;
    std::printf("[ RUN  ] %s\n", t.name);
    t.fn();
    ++run;
    if (djntest::g_failures != before) {
      ++failedTests;
      std::printf("[ FAIL ] %s\n", t.name);
    } else {
      std::printf("[  OK  ] %s\n", t.name);
    }
  }
  std::printf("\n%d tests, %d failed\n", run, failedTests);
  return failedTests == 0 ? 0 : 1;
}
