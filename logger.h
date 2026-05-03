#pragma once

#include <chrono>
#include <fstream>
#include <mutex>
#include <string>

using Clock = std::chrono::steady_clock;

struct Logger
{
  std::ofstream     file;
  std::mutex        mtx;
  Clock::time_point tStart;

  void open(Clock::time_point t);
  void log(const std::string &event_type);
  void close();
};
