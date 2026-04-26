cmake_minimum_required(VERSION 3.14)
project(sv_goose_latency_web LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# libiec61850
set(LIBIEC61850_DIR ${PROJECT_SOURCE_DIR}/dependencies/libiec61850)

# Build static + PIC (great for containers/embedded)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Enable only the components you use
set(WITH_MMS             OFF CACHE BOOL "" FORCE)
set(WITH_GOOSE            ON CACHE BOOL "" FORCE)
set(WITH_SAMPLED_VALUES   ON CACHE BOOL "" FORCE)
set(WITH_EXAMPLES        ON CACHE BOOL "" FORCE)
set(WITH_TESTS           OFF CACHE BOOL "" FORCE)

# Enable R-SMV and R-GOOSE
set(CONFIG_IEC61850_R_SMV ON CACHE BOOL "" FORCE)
set(CONFIG_IEC61850_R_GOOSE ON CACHE BOOL "" FORCE)

set(CONFIG_USE_EXTERNAL_MBEDTLS_DYNLIB ON CACHE BOOL "" FORCE)
set(CONFIG_EXTERNAL_MBEDTLS_INCLUDE_PATH "/usr/include" CACHE STRING "" FORCE)

# Build the library
add_subdirectory(${LIBIEC61850_DIR} EXCLUDE_FROM_ALL)  # defines target: iec61850

find_package(Threads REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(PCAP REQUIRED libpcap)
find_package(nlohmann_json REQUIRED)

include_directories(
  ${PCAP_INCLUDE_DIRS}
  ${CMAKE_SOURCE_DIR}/third_party  # httplib.h lives here
)

link_directories(${PCAP_LIBRARY_DIRS})

add_executable(sv_goose_latency_web main.cpp)
target_link_libraries(sv_goose_latency_web
  iec61850
  ${PCAP_LIBRARIES}
  nlohmann_json::nlohmann_json
  Threads::Threads
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

# Ensure the include directories are available to the project
target_include_directories(sv_goose_latency_web PRIVATE 
    ${LIBIEC61850_INCLUDE_DIRS}
)
