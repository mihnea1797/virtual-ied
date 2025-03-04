cmake_minimum_required(VERSION 3.5.1)

# Create the rms-computation library
add_library(rms-computation STATIC RmsComputationObject.cpp)

# Include current directory
target_include_directories(rms-computation PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})