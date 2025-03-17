#include "ButterworthFilter.hpp"

ButterworthFilter::~ButterworthFilter()
{
}

ButterworthFilter::ButterworthFilter(uint8_t order, float cutoffFrequency, float samplingFrequency) : order(order), cutoffFrequency(cutoffFrequency), samplingFrequency(samplingFrequency)
{
    // Initialization of the numerator and denominator as unitary polynomials ( so that they can be used in polynomial multiplication )
    denominatorCoeff = std::vector<double>({1}); 
    numeratorCoeff = std::vector<double>({1}); 

    // If n is even, add -2 * pi * cutoffFrequency as pole of the filter
    if( order % 2 )
    {
        std::vector<double> intermediatePoly;
         
        intermediatePoly = {1 + samplingFrequency / ( M_PI * cutoffFrequency), 1 - samplingFrequency / ( M_PI * cutoffFrequency)};
        denominatorCoeff = polyMultiplication(denominatorCoeff, intermediatePoly);
        intermediatePoly.clear();
 
        intermediatePoly = {1, 1};
        numeratorCoeff = polyMultiplication(numeratorCoeff, intermediatePoly);
        intermediatePoly.clear();
    }

    // Adding the pairs of complex-conjugate poles
    for(uint8_t k = 1; k <= order / 2; k++)
    {
        std::vector<double> intermediatePoly;

        intermediatePoly = {samplingFrequency * samplingFrequency / ( cutoffFrequency * cutoffFrequency * M_PI * M_PI )  + 2 * samplingFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) / ( M_PI * cutoffFrequency ) + 1, 2 - 2 * samplingFrequency * samplingFrequency / ( M_PI *  M_PI * cutoffFrequency * cutoffFrequency ), samplingFrequency * samplingFrequency / ( cutoffFrequency * cutoffFrequency * M_PI * M_PI )  - 2 * samplingFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) / ( M_PI * cutoffFrequency )+ 1};
        denominatorCoeff = polyMultiplication(denominatorCoeff, intermediatePoly);
        intermediatePoly.clear();

        intermediatePoly = {1, 2, 1};
        numeratorCoeff = polyMultiplication(numeratorCoeff, intermediatePoly);
        intermediatePoly.clear();
    }

    // Normalize the polynomials ( transform the coefficient of the free term from the denominator into 1 )
    if(numeratorCoeff.size() == 0 || denominatorCoeff.size() == 0 || !normalizeVector(numeratorCoeff, denominatorCoeff[0]))
    {
        throw( std::string("Unbable to normalize filter polynomials") );
    }

    normalizeVector(denominatorCoeff, denominatorCoeff[0]);

    // As we know that the first coefficient is 1 ( after normalization ), it should no longer be taken into account
    denominatorCoeff.erase(denominatorCoeff.begin());

    // Initialization ( with 0 ) of the queues of filtered and unfiltered values ​​of the signal
    previousUnfilteredSamples.resize(numeratorCoeff.size(),0);
    previousFilteredSamples.resize(denominatorCoeff.size(),0); 
}

int32_t ButterworthFilter::filter(int32_t inputSample)
{
    // Adding the most recent sample of the signal in the queue of unfiltered values and removing the oldest one
    previousUnfilteredSamples.emplace_back(inputSample);
    previousUnfilteredSamples.pop_front();

    double dOutput = 0.0;

    // Addding to the output the contribution of the unfiltered values, multiplied by the numerator coefficients
    for(uint16_t i = 0; i < numeratorCoeff.size(); i++)
        dOutput += previousUnfilteredSamples[i] * numeratorCoeff[numeratorCoeff.size() - 1 - i];

    // Addding to the output the contribution of the filtered values, multiplied by the denominator coefficients
    for(uint16_t i = 0; i < denominatorCoeff.size(); i++)
        dOutput -= previousFilteredSamples[i] * denominatorCoeff[denominatorCoeff.size() - 1 - i];

    int32_t iOutput = static_cast<int32_t>(dOutput);

    // Adding the most recent sample of the signal in the queue of filtered values and removing the oldest one
    previousFilteredSamples.emplace_back(dOutput);
    previousFilteredSamples.pop_front();
    
    return iOutput;
}

// For more details on the subject, the multiplication of two polynomials represents the convolution operation applied to the coefficients of the two polynomials
std::vector<double> ButterworthFilter::polyMultiplication(const std::vector<double> & polyA, const std::vector<double> & polyB)
{
    if(!polyA.size() || !polyB.size())
        return std::vector<double>();

    std::vector<double> polyProd(polyA.size() + polyB.size() - 1, 0.0); 
    for(uint16_t i = 0; i < polyA.size(); i++)
        for(uint16_t j = 0; j < polyB.size(); j++)
            polyProd[i+j] += polyA[i] * polyB[j];

    return polyProd;
}

bool ButterworthFilter::normalizeVector(std::vector<double> & poly, double normalizationFactor)
{   
    
    if(fabs(normalizationFactor) < std::numeric_limits<float>::lowest())
        return false; 

    for(std::vector<double>::iterator it = poly.begin(); it != poly.end(); it++)
        *it = *it / normalizationFactor;

    return true;
}