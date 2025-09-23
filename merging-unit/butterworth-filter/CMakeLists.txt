cmake_minimum_required(VERSION 3.10)

# Create the butterworth-filter library
add_library(butterworth-filter STATIC ButterworthFilter.cpp)

# Include current directory
target_include_directories(butterworth-filter PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
