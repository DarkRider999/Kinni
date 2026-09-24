cmake_minimum_required(VERSION 3.18)
project(djnexus_engine VERSION 0.1.0 LANGUAGES C CXX)

# ---------------------------------------------------------------- options
set(DJN_HOST "auto" CACHE STRING "Audio host: auto, desktop, android, ios, none")
set_property(CACHE DJN_HOST PROPERTY STRINGS auto desktop android ios none)
option(DJN_WITH_DECODER "Built-in WAV/FLAC/MP3 decoding (miniaudio)" ON)
option(DJN_SHARED "Build a shared library (Flutter desktop / Android)" OFF)
option(DJN_BUILD_TESTS "Build unit tests" ${PROJECT_IS_TOP_LEVEL})
option(DJN_BUILD_TOOLS "Build command-line tools" ${PROJECT_IS_TOP_LEVEL})
set(DJN_OBOE_SOURCE_DIR "" CACHE PATH "Android: build Oboe from this source checkout instead of the Gradle prefab package")

if(DJN_HOST STREQUAL "auto")
  if(ANDROID)
    set(DJN_HOST "android")
  elseif(CMAKE_SYSTEM_NAME STREQUAL "iOS")
    set(DJN_HOST "ios")
  else()
    set(DJN_HOST "desktop")
  endif()
endif()
message(STATUS "DJ Nexus engine: host=${DJN_HOST} decoder=${DJN_WITH_DECODER} shared=${DJN_SHARED}")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release)
endif()

# ---------------------------------------------------------------- sources
set(DJN_CORE_SOURCES
  src/core/track.cpp
  src/core/stretcher.cpp
  src/core/deck.cpp
  src/core/channel.cpp
  src/core/recorder.cpp
  src/core/engine.cpp
  src/core/fx.cpp
  src/core/sampler.cpp
  src/core/colorfx.cpp
  src/core/macro.cpp
  src/capi.cpp
)

set(DJN_NEEDS_MINIAUDIO OFF)
if(DJN_WITH_DECODER)
  list(APPEND DJN_CORE_SOURCES src/decode/decoder_miniaudio.cpp)
  set(DJN_NEEDS_MINIAUDIO ON)
else()
  list(APPEND DJN_CORE_SOURCES src/decode/decoder_none.cpp)
endif()

if(DJN_HOST STREQUAL "desktop")
  list(APPEND DJN_CORE_SOURCES src/hosts/host_desktop.cpp)
  set(DJN_NEEDS_MINIAUDIO ON)
elseif(DJN_HOST STREQUAL "android")
  list(APPEND DJN_CORE_SOURCES src/hosts/host_android.cpp)
elseif(DJN_HOST STREQUAL "ios")
  enable_language(OBJCXX)
  list(APPEND DJN_CORE_SOURCES src/hosts/host_ios.mm)
elseif(DJN_HOST STREQUAL "none")
  list(APPEND DJN_CORE_SOURCES src/hosts/host_none.cpp)
else()
  message(FATAL_ERROR "Unknown DJN_HOST '${DJN_HOST}'")
endif()

if(DJN_NEEDS_MINIAUDIO)
  list(APPEND DJN_CORE_SOURCES src/miniaudio/ma_impl.c)
endif()

if(DJN_SHARED)
  add_library(djnexus SHARED ${DJN_CORE_SOURCES})
  target_compile_definitions(djnexus PRIVATE DJN_BUILD_SHARED)
  set_target_properties(djnexus PROPERTIES CXX_VISIBILITY_PRESET hidden VISIBILITY_INLINES_HIDDEN ON
                                           C_VISIBILITY_PRESET hidden)
else()
  add_library(djnexus STATIC ${DJN_CORE_SOURCES})
endif()
add_library(djnexus::engine ALIAS djnexus)

target_include_directories(djnexus
  PUBLIC  ${CMAKE_CURRENT_SOURCE_DIR}/include
  PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/src/core
          ${CMAKE_CURRENT_SOURCE_DIR}/third_party/miniaudio)

if(DJN_HOST STREQUAL "desktop")
  target_compile_definitions(djnexus PRIVATE DJN_WITH_DEVICE_IO)
endif()

if(MSVC)
  target_compile_options(djnexus PRIVATE /W4 /permissive- /fp:fast)
else()
  target_compile_options(djnexus PRIVATE
    $<$<COMPILE_LANGUAGE:CXX,OBJCXX>:-Wall -Wextra -Wno-unused-parameter>
    -fno-math-errno)
endif()
# miniaudio is third-party: keep its warnings out of our build output.
if(DJN_NEEDS_MINIAUDIO AND NOT MSVC)
  set_source_files_properties(src/miniaudio/ma_impl.c PROPERTIES COMPILE_OPTIONS "-w")
endif()

# ---------------------------------------------------------------- platform libs
find_package(Threads REQUIRED)
target_link_libraries(djnexus PRIVATE Threads::Threads)

if(DJN_HOST STREQUAL "android")
  if(DJN_OBOE_SOURCE_DIR)
    # Plain CMake / CI builds: compile Oboe from source.
    add_subdirectory(${DJN_OBOE_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/oboe)
    target_link_libraries(djnexus PRIVATE oboe log)
  else()
    # Gradle builds: Oboe comes from the Maven prefab package com.google.oboe:oboe (see README).
    find_package(oboe REQUIRED CONFIG)
    target_link_libraries(djnexus PRIVATE oboe::oboe log)
  endif()
  # Android 15+ devices may use 16 KB memory pages.
  target_link_options(djnexus PRIVATE "-Wl,-z,max-page-size=16384")
elseif(DJN_HOST STREQUAL "ios")
  target_compile_options(djnexus PRIVATE $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  target_link_libraries(djnexus PRIVATE "-framework AVFoundation" "-framework AudioToolbox" "-framework CoreAudio"
                                        "-framework Foundation")
elseif(APPLE)
  target_link_libraries(djnexus PRIVATE "-framework CoreFoundation" "-framework CoreAudio"
                                        "-framework AudioToolbox" "-framework AudioUnit")
elseif(UNIX)
  target_link_libraries(djnexus PRIVATE ${CMAKE_DL_LIBS} m)
endif()

# ---------------------------------------------------------------- tools & tests
if(DJN_BUILD_TOOLS AND NOT DJN_HOST STREQUAL "android" AND NOT DJN_HOST STREQUAL "ios")
  add_executable(djnexus_render tools/djnexus_render.cpp)
  target_link_libraries(djnexus_render PRIVATE djnexus)
  if(WIN32)
    target_link_libraries(djnexus_render PRIVATE shell32)  # CommandLineToArgvW
  endif()
  if(DJN_HOST STREQUAL "desktop")
    add_executable(djnexus_play tools/djnexus_play.cpp)
    target_link_libraries(djnexus_play PRIVATE djnexus)
    if(WIN32)
      target_link_libraries(djnexus_play PRIVATE shell32)
    endif()
  endif()
endif()

# Tests reach into internal classes, so they need the static library.
if(DJN_BUILD_TESTS AND NOT DJN_SHARED AND NOT DJN_HOST STREQUAL "android" AND NOT DJN_HOST STREQUAL "ios")
  enable_testing()
  add_executable(djnexus_tests tests/test_main.cpp tests/test_engine.cpp tests/test_dsp.cpp tests/test_fx_sampler.cpp tests/test_color_macro.cpp)
  target_include_directories(djnexus_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/src/core)
  target_link_libraries(djnexus_tests PRIVATE djnexus)
  add_test(NAME djnexus_tests COMMAND djnexus_tests)
  add_executable(djnexus_bench tests/bench.cpp)
  target_link_libraries(djnexus_bench PRIVATE djnexus)
endif()

install(TARGETS djnexus ARCHIVE DESTINATION lib LIBRARY DESTINATION lib RUNTIME DESTINATION bin)
install(FILES include/djnexus/djnexus.h DESTINATION include/djnexus)
