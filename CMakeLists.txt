cmake_minimum_required(VERSION 3.5.1)

# Project name
project(merging-unit)

# Specify the C++ standard
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Detect if we should cross-compile
if(DEFINED ENV{TOOLCHAIN})
    set(CMAKE_C_COMPILER $ENV{TOOLCHAIN}gcc)
    set(CMAKE_CXX_COMPILER $ENV{TOOLCHAIN}g++)
    set(CMAKE_AR "$ENV{TOOLCHAIN}ar" CACHE FILEPATH "CW archiver" FORCE)
endif()

# Add subdirectory for libiec61850
add_subdirectory(libiec61850)

# Include the libiec61850 headers
include_directories(
    ${CMAKE_SOURCE_DIR}/libiec61850/src/common/inc
    ${CMAKE_SOURCE_DIR}/libiec61850/src/goose
    ${CMAKE_SOURCE_DIR}/libiec61850/src/sampled_values
    ${CMAKE_SOURCE_DIR}/libiec61850/hal/inc
    ${CMAKE_SOURCE_DIR}/libiec61850/src/iec61850/inc
    ${CMAKE_SOURCE_DIR}/libiec61850/src/iec61850/inc_private
    ${CMAKE_SOURCE_DIR}/libiec61850/src/mms/inc
    ${CMAKE_SOURCE_DIR}/libiec61850/src/mms/inc_private
    ${CMAKE_SOURCE_DIR}/libiec61850/src/mms/iso_mms/asn1c
    ${CMAKE_SOURCE_DIR}/libiec61850/src/logging
)

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

# Add the executable
add_executable(merging-unit ${SOURCES} ${HEADERS})

# Link the shared libiec61850 library
target_link_libraries(merging-unit
    iec61850-shared  # Link against the shared library target
)

# Ensure the libiec61850 headers are available to the merging-unit project
target_include_directories(merging-unit PRIVATE ${LIBIEC61850_DIR}/include)
