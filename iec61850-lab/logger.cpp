#include "logger.h"

#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>

void Logger::open(Clock::time_point t)
{
  auto now_sys = std::chrono::system_clock::now();
  auto tt      = std::chrono::system_clock::to_time_t(now_sys);
  std::tm tm_buf;
  gmtime_r(&tt, &tm_buf);
  char fname[64];
  std::strftime(fname, sizeof(fname), "loggerOutput/sv_goose_%Y%m%d_%H%M%S.csv", &tm_buf);

  std::lock_guard<std::mutex> lk(mtx);
  tStart = t;
  file.open(fname);
  file << "timestamp,event_type,time_since_start_ms,latency_step_ms,latency_threshold_ms\n";
  file.flush();
  std::cout << "[LOG] Writing to " << fname << '\n';
}

void Logger::log(const std::string &event_type)
{
  auto now_steady = Clock::now();
  auto now_sys    = std::chrono::system_clock::now();
  double elapsed_ms =
    std::chrono::duration<double, std::milli>(now_steady - tStart).count();

  auto tt = std::chrono::system_clock::to_time_t(now_sys);
  auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
              now_sys.time_since_epoch()) % 1000;
  std::tm tm_buf;
  gmtime_r(&tt, &tm_buf);

  std::lock_guard<std::mutex> lk(mtx);
  if (!file.is_open()) return;
  file << std::put_time(&tm_buf, "%Y-%m-%dT%H:%M:%S")
       << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z'
       << ',' << event_type
       << ',' << std::fixed << std::setprecision(3) << elapsed_ms
       << ",,\n";
  file.flush();
}

void Logger::log_goose(double lat_step_ms, double lat_threshold_ms)
{
  auto now_steady = Clock::now();
  auto now_sys    = std::chrono::system_clock::now();
  double elapsed_ms =
    std::chrono::duration<double, std::milli>(now_steady - tStart).count();

  auto tt = std::chrono::system_clock::to_time_t(now_sys);
  auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
              now_sys.time_since_epoch()) % 1000;
  std::tm tm_buf;
  gmtime_r(&tt, &tm_buf);

  std::lock_guard<std::mutex> lk(mtx);
  if (!file.is_open()) return;
  file << std::put_time(&tm_buf, "%Y-%m-%dT%H:%M:%S")
       << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z'
       << ",goose"
       << ',' << std::fixed << std::setprecision(3) << elapsed_ms
       << ',';
  if (lat_step_ms >= 0.0)
    file << std::fixed << std::setprecision(3) << lat_step_ms;
  file << ',';
  if (lat_threshold_ms >= 0.0)
    file << std::fixed << std::setprecision(3) << lat_threshold_ms;
  file << '\n';
  file.flush();
}

void Logger::close()
{
  std::lock_guard<std::mutex> lk(mtx);
  if (file.is_open()) file.close();
}
