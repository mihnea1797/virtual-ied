#ifndef _BUTTERWORTH_FILTER_H
#define _BUTTERWORTH_FILTER_H

#include <cstdint>
#include <vector>
#include <deque>
#include <cmath>
#include <limits>
#include <string>

class ButterworthFilter
{
private:
    // Order of the Butterworth Filter ( in continuous time )
    uint8_t order;
    // Cutoff frequency of the Butterworth Filter [ Hz ] 
    float cutoffFrequency;
    // Sampling frequency used for filter discretization 
    // For the application at hand, the sampling frequency is calculated as follows : 50 Hz ( frequency of the sine wave signal ) * 80 ( samples per period ) = 4000 Hz
    float samplingFrequency;
    // Filter numerator coefficients ( after discretization, in ascending order of the powers of the delay operator : z^-1 )
    std::vector<double> numeratorCoeff;
    // Filter denominator coefficients ( after discretization, in ascending order of the powers of the delay operator : z^-1 )
    std::vector<double> denominatorCoeff;
    // Deque used for storing the previous values of the unfiltered ( input ) signal
    std::deque<int32_t> previousUnfilteredSamples;
    // Deque used for storing the previous values of the filtered ( output ) signal
    std::deque<double> previousFilteredSamples;
    /** 
     * Helper method used for performing polynomial multiplication
     * @param polyA Array containing coefficients of the first polynomial ( ordered in ascending order of the powers of the polynomial variable )
     * @param polyB Array containing coefficients of the second polynomial ( ordered in ascending order of the powers of the polynomial variable )
     * @return Array containing coefficients of the polynomial product ( ordered in ascending order of the powers of the polynomial variable )
     */ 
    std::vector<double> polyMultiplication(const std::vector<double> & polyA, const std::vector<double> & polyB);
    /**
     * Helper method used for normalization of the polynomial coefficients
     * @param poly Array containing coefficients of polynomial to be normalized ( ordered in ascending order of the powers of the polynomial variable )
     * @param normalizationFactor Value used for normalization 
     * @return Boolean value showing whether the normalization operation could be performed or not
     */
    bool normalizeVector(std::vector<double> & poly, double normalizationFactor);


public:
    ButterworthFilter() = delete;
    ButterworthFilter(uint8_t order, float cuttoffFrequency, float samplingFrequency);
    ~ButterworthFilter();
    /**
     * Method used for data filtering
     * @param inputSample Sample of the unfiltered ( input ) signal
     * @return Sample of the filtered ( output ) signal
     */
    int32_t filter(int32_t inputSample);
};

#endif