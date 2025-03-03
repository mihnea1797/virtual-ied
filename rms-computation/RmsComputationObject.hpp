#ifndef _RMS_COMPUTATION_H
#define _RMS_COMPUTATION_H

#include <cstdint>
#include <cmath>
#include <queue>
#include <limits>
#include <boost/math/constants/constants.hpp>
#include <boost/multiprecision/cpp_dec_float.hpp>
#include <boost/multiprecision/cpp_int.hpp>

// boost::multiprecision::uint128_t datatype
typedef boost::multiprecision::uint128_t uint128_boost;

// boost::multiprecision::cpp_dec_float_50 datatype
typedef boost::multiprecision::cpp_dec_float_50 float128_boost;

class RmsComputationObject
{
private:
    // Used for scaling the sampled values received from ISA
    static constexpr double SCALING_CONSTANT = 537401.187777;
    // Square root of 2
    static constexpr double SQRT2 = 1.4142135623730951;
    // Number of sample values per signal period
    static constexpr uint8_t SAMPLES_PER_PERIOD = 80;
    // Squared value of SCALING_CONSTANT
    static const float128_boost SCALING_CONSTANT_SQUARED;
    // Used for the RMS update rule
    uint128_boost previousIntermediateValue;
    // Used for storing the sum of the first SAMPLES_PER_PERIOD ​​(unscaled) sample values readings
    uint128_boost auxRmsUnscaled;
    // Used for storing the values of the previous SAMPLES_PER_PERIOD (unscaled) sample value readings
    std::queue<uint64_t> previousSamples;
    // Used to iterate through the first SAMPLES_PER_PERIOD RMS values ( after the first SAMPLES_PER_PERIOD
    // samples it acts as a circular iterator, resetting everytime it reaches the value of SAMPLES_PER_PERIOD)
    uint8_t sampleNumber;

public:
    RmsComputationObject();
    ~RmsComputationObject();
    double computeValue(int32_t value);
};

#endif