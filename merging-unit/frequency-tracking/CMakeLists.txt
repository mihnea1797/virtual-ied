cmake_minimum_required(VERSION 3.5.1)

# Create the frequency-tracking library
add_library(frequency-tracking STATIC FrequencyTracking.cpp)

# Include current directory
target_include_directories(frequency-tracking PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
