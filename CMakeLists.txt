cmake_minimum_required(VERSION 3.5.1)

# Project name
project(merging-unit)

# Specify the C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Detect if we should cross-compile
if(DEFINED ENV{TOOLCHAIN})
    set(CMAKE_C_COMPILER $ENV{TOOLCHAIN}gcc)
    set(CMAKE_CXX_COMPILER $ENV{TOOLCHAIN}g++)
    set(CMAKE_AR "$ENV{TOOLCHAIN}ar" CACHE FILEPATH "CW archiver" FORCE)
endif()

# Find the installed libiec61850 library
find_path(LIBIEC61850_INCLUDE_DIR NAMES iec61850_server.h PATHS /usr/local/include/libiec61850)
find_library(LIBIEC61850_LIBRARY NAMES iec61850 PATHS /usr/local/lib)

if (NOT LIBIEC61850_INCLUDE_DIR OR NOT LIBIEC61850_LIBRARY)
    message(FATAL_ERROR "libiec61850 not found")
else()
    message(STATUS "libiec61850 include directory: ${LIBIEC61850_INCLUDE_DIR}")
    message(STATUS "libiec61850 library: ${LIBIEC61850_LIBRARY}")
endif()

# Include directories
include_directories(${LIBIEC61850_INCLUDE_DIR})

## directory containing hal_socket.h library necessary for libiec61850 proper working
include_directories(/root/libiec61850/hal/inc)
## to be removed, used for testing 

# Source files for the merging-unit project
set(SOURCES
    ${CMAKE_SOURCE_DIR}/merging-unit/Main.cpp
    ${CMAKE_SOURCE_DIR}/merging-unit/goose-publisher/GoosePublisherWrapper.cpp
    ${CMAKE_SOURCE_DIR}/merging-unit/sv-subscriber/SampledValuesSubscriberWrapper.cpp
)

# Header files for the merging-unit project
set(HEADERS
    ${CMAKE_SOURCE_DIR}/merging-unit/goose-publisher/GoosePublisherWrapper.hpp
    ${CMAKE_SOURCE_DIR}/merging-unit/sv-subscriber/SampledValuesSubscriberWrapper.hpp
)

## Adding the rmsComputation library subdirectory
add_subdirectory(${CMAKE_SOURCE_DIR}/merging-unit/rms-computation)

# Set the output directory for the binary
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY /opt/virtual-merging-unit)

# Add the executable
add_executable(merging-unit ${SOURCES} ${HEADERS})

# Link the shared libraries
target_link_libraries(merging-unit
    ${LIBIEC61850_LIBRARY}
    rms-computation
)

# Ensure the include directories are available to the merging-unit project
target_include_directories(merging-unit PRIVATE
    ${LIBIEC61850_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/merging-unit/rms-computation
)

# Set the RPATH to find the shared libraries at runtime
set_target_properties(merging-unit PROPERTIES
    BUILD_WITH_INSTALL_RPATH TRUE
    INSTALL_RPATH_USE_LINK_PATH TRUE
    INSTALL_RPATH "/usr/local/lib"
)
