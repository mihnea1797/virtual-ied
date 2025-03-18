#include "RmsComputationObject.hpp"

RmsComputationObject::RmsComputationObject(uint8_t samplesPerPeriod, double scalingConstant): samplesPerPeriod(samplesPerPeriod), scalingConstant(scalingConstant) 
{
    this->previousIntermediateValue = 0;
    this->sampleNumber = 0;
    this->auxRmsUnscaled = 0;
    this->scalingConstantSquared = ((float128_boost)this->scalingConstant) * ((float128_boost)this->scalingConstant);
}

RmsComputationObject::RmsComputationObject(const nlohmann::json & signalProperties)
{
    uint8_t samplesPerPeriod = signalProperties.at("samplesPerPeriod");
    double scalingConstant = signalProperties.at("scalingConstant");
    *this = RmsComputationObject(samplesPerPeriod, scalingConstant);
}

RmsComputationObject::~RmsComputationObject()
{
}

double RmsComputationObject::computeValue(int32_t value)
{

    uint64_t voltageUnscaled = std::abs(value);

    // for the first samplesPerPeriod - 1 samples, the RMS value should be kept at 0
    if (sampleNumber <= samplesPerPeriod - 2)
    {
        uint64_t newestVoltageSquared = voltageUnscaled * voltageUnscaled;
        previousSamples.push(newestVoltageSquared);

        auxRmsUnscaled += newestVoltageSquared;

        sampleNumber++;
        return 0;
    }

    // at the samplesPerPeriod'th sample value reading, we can calculate the real value of the rms
    // for the first time
    else if (sampleNumber == samplesPerPeriod - 1)
    {
        uint64_t newestVoltageSquared = voltageUnscaled * voltageUnscaled;
        previousSamples.push(newestVoltageSquared);

        auxRmsUnscaled += newestVoltageSquared;

        sampleNumber++;

        // assign value to previousIntermediateValue for the first time
        previousIntermediateValue = auxRmsUnscaled * samplesPerPeriod;

        // since we are at the samplesPerPeriod'th sample value reading, we can calculate the first
        // value of the rms

        // at first sight, a cast to double instead of float128_boost would've been possible here due to the fact that
        // the upper limit of a double variable is greater than the upper limit of uint128_boost, but due to the nature
        // of a double variable ( 11 bit exponential and 52 bit mantissa ), it might not be able to store large values
        // of 128 bit integers
        // float128_boost has enough headroom for the entire range of values of an 128 bit integer
        float128_boost auxScaled = ((float128_boost)auxRmsUnscaled) / scalingConstantSquared;

        // after performing the scaling, if the value stored inside of intermediateValueUnscaled exceeds the upper
        // bound for a double variable, it means that something went wrong and an error should be thrown so that the
        // application stops running
        if (auxScaled < std::numeric_limits<double>::lowest() || auxScaled > std::numeric_limits<double>::max())
        {
            throw std::overflow_error("Value exceeds upper bound of double datatype.");
        }
        double rms = sqrt(((double)auxScaled) * samplesPerPeriod);

        return rms / samplesPerPeriod;
    }

    else
    {

        // calculate an intermediate integer value that's going to be used in the update of the rms value based on the update rule
        uint64_t newestVoltageSquared = voltageUnscaled * voltageUnscaled;
        uint128_boost intermediateValueUnscaled = previousIntermediateValue + ((uint128_boost)(newestVoltageSquared)) * samplesPerPeriod;
        uint128_boost subtractOldestValue = ((uint128_boost)(previousSamples.front())) * samplesPerPeriod;
        intermediateValueUnscaled = (intermediateValueUnscaled > subtractOldestValue ? intermediateValueUnscaled - subtractOldestValue : 0);

        previousSamples.pop();
        previousSamples.push(newestVoltageSquared);

        previousIntermediateValue = intermediateValueUnscaled;

        float128_boost intermediateValueScaled = ((float128_boost)intermediateValueUnscaled) / scalingConstantSquared;

        if (intermediateValueScaled < std::numeric_limits<double>::lowest() || intermediateValueScaled > std::numeric_limits<double>::max())
        {
            throw std::overflow_error("Value exceeds upper bound of double datatype.");
        }
        double rms = sqrt(((double)intermediateValueScaled));

        return rms / samplesPerPeriod;
    }
}