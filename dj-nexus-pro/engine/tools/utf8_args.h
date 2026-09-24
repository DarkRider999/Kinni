// On Windows, main()'s argv uses the ANSI code page, which mangles
// non-English file names. The engine API takes UTF-8, so rebuild argv as UTF-8
// from the wide command line. Elsewhere argv is already UTF-8.
#pragma once

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
// windows.h must come first
#include <shellapi.h>

#include <string>
#include <vector>

inline char** utf8Argv(int& argc, char** argv) {
  static std::vector<std::string> storage;
  static std::vector<char*> ptrs;
  int wargc = 0;
  wchar_t** wargv = CommandLineToArgvW(GetCommandLineW(), &wargc);
  if (!wargv) return argv;
  storage.clear();
  for (int i = 0; i < wargc; ++i) {
    const int n = WideCharToMultiByte(CP_UTF8, 0, wargv[i], -1, nullptr, 0, nullptr, nullptr);
    std::string s(size_t(n > 0 ? n - 1 : 0), '\0');
    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, wargv[i], -1, &s[0], n, nullptr, nullptr);
    storage.push_back(std::move(s));
  }
  LocalFree(wargv);
  ptrs.clear();
  for (auto& s : storage) ptrs.push_back(&s[0]);
  ptrs.push_back(nullptr);
  argc = wargc;
  return ptrs.data();
}
#else
inline char** utf8Argv(int&, char** argv) { return argv; }
#endif
