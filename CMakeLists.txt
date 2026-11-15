cmake_minimum_required(VERSION 3.10)

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

# libiec61850
set(LIBIEC61850_DIR ${PROJECT_SOURCE_DIR}/dependencies/libiec61850)

# Submodule synchronization and update during cmake config / reconfig 
if(EXISTS "${CMAKE_SOURCE_DIR}/.git")
    message(STATUS "Synchronizing and updating git submodules...")
    execute_process(
        COMMAND git submodule sync --recursive
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    )
    execute_process(
        COMMAND git submodule update --init --recursive
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    )
    execute_process(
        COMMAND git fetch --tags
        WORKING_DIRECTORY ${LIBIEC61850_DIR}
    )
    execute_process(
        COMMAND git checkout origin/v1.6_develop
        WORKING_DIRECTORY ${LIBIEC61850_DIR}
    )
endif()

# Build static + PIC (great for containers/embedded)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Enable only the components you use
set(WITH_MMS             OFF CACHE BOOL "" FORCE)
set(WITH_GOOSE            ON CACHE BOOL "" FORCE)
set(WITH_SAMPLED_VALUES   ON CACHE BOOL "" FORCE)
set(CONFIG_IEC61850_R_SMV ON CACHE BOOL "" FORCE)
set(CONFIG_USE_EXTERNAL_MBEDTLS_DYNLIB ON CACHE BOOL "" FORCE)
set(CONFIG_EXTERNAL_MBEDTLS_INCLUDE_PATH "/usr/include" CACHE STRING "" FORCE)
set(WITH_EXAMPLES        OFF CACHE BOOL "" FORCE)
set(WITH_TESTS           OFF CACHE BOOL "" FORCE)
# Optional (if available in your version):
set(BUILD_DOCUMENTATION  OFF CACHE BOOL "" FORCE)
set(BUILD_TOOLS          OFF CACHE BOOL "" FORCE)

# Build the library
add_subdirectory(${LIBIEC61850_DIR} EXCLUDE_FROM_ALL)  # defines target: iec61850

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

# Adding library subdirectories
add_subdirectory(${CMAKE_SOURCE_DIR}/merging-unit/rms-computation)
add_subdirectory(${CMAKE_SOURCE_DIR}/merging-unit/butterworth-filter)
add_subdirectory(${CMAKE_SOURCE_DIR}/merging-unit/frequency-tracking)

# Set the output directory for the binary
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY /opt/virtual-merging-unit)

# Add the executable
add_executable(merging-unit ${SOURCES} ${HEADERS})

# Link the shared libraries
target_link_libraries(merging-unit
  PRIVATE
    iec61850
    rms-computation
    butterworth-filter
    frequency-tracking
)


# Get libiec61850 include directories from its build configuration
set(LIBIEC61850_INCLUDE_DIRS
    ${LIBIEC61850_DIR}/src/common/inc
    ${LIBIEC61850_DIR}/src/goose
    ${LIBIEC61850_DIR}/src/sampled_values
    ${LIBIEC61850_DIR}/src/r_session
    ${LIBIEC61850_DIR}/src/hal/inc
    ${LIBIEC61850_DIR}/src/iec61850/inc
    ${LIBIEC61850_DIR}/src/iec61850/inc_private
    ${LIBIEC61850_DIR}/src/mms/inc
    ${LIBIEC61850_DIR}/src/mms/inc_private
    ${LIBIEC61850_DIR}/src/mms/iso_mms/asn1c
    ${LIBIEC61850_DIR}/src/logging
    ${LIBIEC61850_DIR}/hal/inc
    ${CMAKE_BINARY_DIR}/dependencies/libiec61850/config
)

# Include directories for your own modules
set(INCLUDE_DIRECTORIES
    ${CMAKE_SOURCE_DIR}/merging-unit/rms-computation
    ${CMAKE_SOURCE_DIR}/merging-unit/butterworth-filter
    ${CMAKE_SOURCE_DIR}/merging-unit/frequency-tracking
)

# Ensure the include directories are available to the merging-unit project
target_include_directories(merging-unit PRIVATE 
    ${INCLUDE_DIRECTORIES}
    ${LIBIEC61850_INCLUDE_DIRS}
)

# Set the RPATH to find the shared libraries at runtime
set_target_properties(merging-unit PROPERTIES
    BUILD_WITH_INSTALL_RPATH TRUE
    INSTALL_RPATH_USE_LINK_PATH TRUE
    INSTALL_RPATH "/usr/local/lib"
)

#Sonarscan
# Always export compile_commands.json
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)