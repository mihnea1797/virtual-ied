#include "FrequencyTracking.hpp"

FrequencyTracking::FrequencyTracking()
{
}

FrequencyTracking::~FrequencyTracking()
{
}


double FrequencyTracking::frequencyEstimation(int32_t inputSampleValue, std::chrono::steady_clock::time_point inputSampleTimeStamp)
{
    std::chrono::steady_clock::time_point zeroCrossingTime;
    bool zeroCrossingDetected = true;
    // checking to see if a zero-crossing of the input signal is detected
    if( inputSampleValue == 0 )
    {
        zeroCrossingTime = inputSampleTimeStamp;
    } 
    else if( ( previousSampleValue > 0 && inputSampleValue < 0 ) || ( previousSampleValue < 0 && inputSampleValue > 0 ) )
    {
        // if the signs of two consecutive values differ, that means that a zero-crossing happened in between them
        // we compute the 1st order polynomial that houses the two points and determine the timestamp at which the value of this polynomial is equal to 0
        int64_t elapsedTime = std::chrono::duration_cast<std::chrono::microseconds>(inputSampleTimeStamp - previousSampleTimeStamp).count();
        zeroCrossingTime = previousSampleTimeStamp - std::chrono::microseconds( elapsedTime * previousSampleValue / (inputSampleValue - previousSampleValue) );
    }
    else 
    {
        zeroCrossingDetected = false;
    }

    // updating the value and timestamp of the previous sample 
    previousSampleValue = inputSampleValue;
    previousSampleTimeStamp = inputSampleTimeStamp;

    // if a zero-crossing is detected, add the new timestamp to the queue
    // remove the oldest timestamp from the queue if its size reached 7 elements 
    if(zeroCrossingDetected)
    {
        if( zeroCrossingTimeStamps.size() >= 7)
        {
            zeroCrossingTimeStamps.pop_front();
        }
        zeroCrossingTimeStamps.emplace_back(zeroCrossingTime);
    }

    // computing the mean frequency value based on the time frame between two consecutive zero-crossings
    if( zeroCrossingTimeStamps.size() < 7)
    {
        return 0;
    }
    else
    {
        int64_t meanPeriod = 0;
        for(size_t i = 1; i < zeroCrossingTimeStamps.size(); i++)
        {
            meanPeriod += std::chrono::duration_cast<std::chrono::microseconds>(zeroCrossingTimeStamps[i] - zeroCrossingTimeStamps[i-1]).count();
        }
        meanPeriod = meanPeriod / ( zeroCrossingTimeStamps.size() - 1);
        return 1e6 / ( meanPeriod * 2 );
    }
}