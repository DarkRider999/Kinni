# Turns mappings/*.txt into a C++ header of string literals, so the engine
# ships its controller mappings (apps and the browser build need no files).
#
#   include(cmake/EmbedMappings.cmake)                     from CMakeLists.txt
#   cmake -DSRC=<engine dir> -DOUT=<header> -P cmake/EmbedMappings.cmake
if(NOT SRC)
  set(SRC ${CMAKE_CURRENT_SOURCE_DIR})
endif()
if(NOT OUT)
  set(OUT ${CMAKE_CURRENT_BINARY_DIR}/generated/djn_builtin_mappings.h)
endif()

file(GLOB _djn_maps "${SRC}/mappings/*.txt")
list(SORT _djn_maps)
set(_body "// Generated from mappings/*.txt by cmake/EmbedMappings.cmake. Do not edit.\n#pragma once\n\nnamespace djn {\nnamespace midi {\n\nstruct BuiltinMapping {\n  const char* id;\n  const char* text;\n};\n\nconst BuiltinMapping kBuiltinMappings[] = {\n")
foreach(_f IN LISTS _djn_maps)
  get_filename_component(_id "${_f}" NAME_WE)
  file(READ "${_f}" _text)
  string(REPLACE "\r" "" _text "${_text}")
  string(REPLACE "\\" "\\\\" _text "${_text}")
  string(REPLACE "\"" "\\\"" _text "${_text}")
  string(REPLACE "\n" "\\n\"\n     \"" _text "${_text}")
  string(APPEND _body "    {\"${_id}\",\n     \"${_text}\"},\n")
  if(NOT CMAKE_SCRIPT_MODE_FILE)
    set_property(DIRECTORY "${SRC}" APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${_f}")
  endif()
endforeach()
string(APPEND _body "};\n\n}  // namespace midi\n}  // namespace djn\n")

# Only touch the header when it changes, so builds stay incremental.
set(_old "")
if(EXISTS "${OUT}")
  file(READ "${OUT}" _old)
endif()
if(NOT _old STREQUAL _body)
  file(WRITE "${OUT}" "${_body}")
endif()
