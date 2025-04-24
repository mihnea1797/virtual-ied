#ifndef _FREQUENCY_TRACKING_H
#define _FREQUENCY_TRACKING_H

#include <cstdint>
#include <deque>
#include <chrono>

class FrequencyTracking
{
private:
    // Value of the previous sample
    int32_t previousSampleValue;
    // Timestamp of the prvious sample
    std::chrono::steady_clock::time_point previousSampleTimeStamp;
    // Mean value of the signal frequency
    double meanFrequencyValue;
    // Deque used for storing the timestamps of the prvious zero-crossings of the signal
    std::deque<std::chrono::steady_clock::time_point> zeroCrossingtimeStamps;
public:
    FrequencyTracking();
    ~FrequencyTracking(); 
    /**
     * Method used for estimation of the signal frequency
     * @param inputSampleValue Value of the ( input ) sample
     * @param inputSampleValue Timestamp of the ( input ) sample
     * @return Estimated value of the signal frequency
     */
    double frequencyEstimation(int32_t inputSampleValue, std::chrono::steady_clock::time_point inputSampleTimeStamp);
};

#endif