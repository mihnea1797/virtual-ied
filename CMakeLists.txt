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

# libiec61850 static library (vendored)
set(LIBIEC61850_VENDOR_DIR ${PROJECT_SOURCE_DIR}/vendor/libiec61850)

if(NOT EXISTS "${LIBIEC61850_VENDOR_DIR}/lib/libiec61850.a")
    message(FATAL_ERROR "Missing ${LIBIEC61850_VENDOR_DIR}/lib/libiec61850.a")
endif()

add_library(iec61850 STATIC IMPORTED GLOBAL)

set(IEC61850_INCLUDES
  "${LIBIEC61850_VENDOR_DIR}/include"
  "${LIBIEC61850_VENDOR_DIR}/include/libiec61850"
  "${LIBIEC61850_VENDOR_DIR}/include/hal/inc"
)

set_target_properties(iec61850 PROPERTIES
    IMPORTED_LOCATION "${LIBIEC61850_VENDOR_DIR}/lib/libiec61850.a"
    INTERFACE_INCLUDE_DIRECTORIES 
    "${IEC61850_INCLUDES}"
)

set(LIBIEC61850_INCLUDE_DIR "${LIBIEC61850_VENDOR_DIR}/include")
set(LIBIEC61850_HAL_SOCKET   "${LIBIEC61850_VENDOR_DIR}/include/hal/inc")

# Find PostgreSQL C client (libpq)
find_package(PostgreSQL REQUIRED)
if(NOT PostgreSQL_FOUND)
    message(FATAL_ERROR "PostgreSQL client library not found. Install libpq-dev")
endif()

# Find PostgreSQL C++ API (libpqxx)
find_path(PQXX_INCLUDE_DIR NAMES pqxx/pqxx PATHS /usr/include /usr/local/include)
find_library(PQXX_LIBRARY NAMES pqxx PATHS /usr/lib /usr/local/lib)
if(NOT PQXX_INCLUDE_DIR OR NOT PQXX_LIBRARY)
    message(FATAL_ERROR "libpqxx not found. Install libpqxx-dev")
endif()

# Include directories
set(INCLUDE_DIRECTORIES
    ${LIBIEC61850_INCLUDE_DIR}
    ${LIBIEC61850_HAL_SOCKET}
    ${PostgreSQL_INCLUDE_DIRS}
    ${PQXX_INCLUDE_DIR}
)
include_directories(${INCLUDE_DIRECTORIES})

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
# Share libraries
set(SHARED_LIBRARIES
    iec61850
    rms-computation
    butterworth-filter
    frequency-tracking
    ${PostgreSQL_LIBRARIES}
    ${PQXX_LIBRARY}
)
# Link the shared libraries
target_link_libraries(merging-unit PRIVATE ${SHARED_LIBRARIES})

# Include directories
set(INCLUDE_DIRECTORIES
    ${CMAKE_SOURCE_DIR}/merging-unit/rms-computation
    ${CMAKE_SOURCE_DIR}/merging-unit/butterworth-filter
    ${CMAKE_SOURCE_DIR}/merging-unit/frequency-tracking
)

# Ensure the include directories are available to the merging-unit project
target_include_directories(merging-unit PRIVATE ${INCLUDE_DIRECTORIES})

# Set the RPATH to find the shared libraries at runtime
set_target_properties(merging-unit PROPERTIES
    BUILD_WITH_INSTALL_RPATH TRUE
    INSTALL_RPATH_USE_LINK_PATH TRUE
    INSTALL_RPATH "/usr/local/lib"
)


#Sonarscan
# Always export compile_commands.json
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)