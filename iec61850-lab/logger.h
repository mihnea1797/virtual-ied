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
  void log_goose(double lat_step_ms, double lat_threshold_ms);
  void close();
};
