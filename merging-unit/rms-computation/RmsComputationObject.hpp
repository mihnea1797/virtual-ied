#ifndef _RMS_COMPUTATION_H
#define _RMS_COMPUTATION_H

#include <cstdint>
#include <cmath>
#include <queue>
#include <limits>
#include <boost/math/constants/constants.hpp>
#include <boost/multiprecision/cpp_dec_float.hpp>
#include <boost/multiprecision/cpp_int.hpp>
#include <nlohmann/json.hpp>

// boost::multiprecision::uint128_t datatype
typedef boost::multiprecision::uint128_t uint128_boost;

// boost::multiprecision::cpp_dec_float_50 datatype
typedef boost::multiprecision::cpp_dec_float_50 float128_boost;

class RmsComputationObject
{
private:
    // Number of sample values per signal period
    uint8_t samplesPerPeriod;
    // Used for scaling the sampled values
    double scalingConstant;
    // Squared value of scalingConstant
    float128_boost scalingConstantSquared;
    // Used for the RMS update rule
    uint128_boost previousIntermediateValue;
    // Used for storing the sum of the first samplesPerPeriod ​​(unscaled) sample values readings
    uint128_boost auxRmsUnscaled;
    // Used for storing the values of the previous samplesPerPeriod (unscaled) sample value readings
    std::queue<uint64_t> previousSamples;
    // Used to iterate through the first samplesPerPeriod RMS values ( after the first samplesPerPeriod
    // samples it acts as a circular iterator, resetting everytime it reaches the value of samplesPerPeriod)
    uint8_t sampleNumber;

public:
    RmsComputationObject() = delete;
    RmsComputationObject(const nlohmann::json & signalProperties);
    RmsComputationObject(uint8_t samplesPerPeriod, double scalingConstant);
    ~RmsComputationObject();
    double computeValue(int32_t value);
};

#endif