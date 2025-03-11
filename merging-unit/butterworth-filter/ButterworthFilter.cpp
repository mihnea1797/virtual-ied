#include "ButterworthFilter.hpp"

ButterworthFilter::~ButterworthFilter()
{

}

ButterworthFilter::ButterworthFilter(uint8_t order, float cuttoffFrequency, float samplingFrequency) : order(order), cutoffFrequency(cutoffFrequency), samplingFrequency(samplingFrequency)
{
    // vector de polinoame ce se vor compune numitorul filtrului Butterworth ( in timp discret )
    denominatorCoeff = std::vector<double>({1}); 
    // vector de polinoame ce se vor compune numaratorul filtrului Butterworth ( in timp discret )
    numeratorCoeff = std::vector<double>({1}); 
    // Se disting 2 cazuri: n = par ( -2 * pi * cutoffFrequency nu va fi radacina a filtrului ) si n = impar ( -2 * pi * cutoffFrequency va fi radacina a filtrului )
    if( order % 2 )
    {
        // vector ce va fi utilizat pentru a stoca "polinoamele" ce urmeaza a fi introduse in denominatorCoeff si numeratorCoeff
        std::vector<double> intermediatePoly;
        // Adaugam polinomul aferent numitorului filtrului 
        intermediatePoly = {1 + samplingFrequency / ( M_PI * cutoffFrequency), 1 - samplingFrequency / ( M_PI * cutoffFrequency)};
        denominatorCoeff = polyMultiplication(denominatorCoeff, intermediatePoly);
        intermediatePoly.clear();

        // Adaugam polinomul aferent numaratorului filtrului 
        intermediatePoly = {1, 1};
        numeratorCoeff = polyMultiplication(numeratorCoeff, intermediatePoly);
        intermediatePoly.clear();

    }
    // urmeaza sa introducem in denominatorCoeff polinoamele formate din perechi de poli complex-conjugati
    for(uint8_t k = 1; k <= order / 2; k++)
    {
        // vector ce va fi utilizat pentru a stoca "polinoamele" ce urmeaza a fi introduse in denominatorCoeff si numeratorCoeff
        std::vector<double> intermediatePoly;
        // Adaugam polinomul aferent numitorului filtrului 
        intermediatePoly = {samplingFrequency * samplingFrequency / ( cutoffFrequency * cutoffFrequency * M_PI * M_PI )  + 2 * samplingFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) / ( M_PI * cutoffFrequency ) + 1, 2 - 2 * samplingFrequency * samplingFrequency / ( M_PI *  M_PI * cutoffFrequency * cutoffFrequency ), samplingFrequency * samplingFrequency / ( cutoffFrequency * cutoffFrequency * M_PI * M_PI )  - 2 * samplingFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) / ( M_PI * cutoffFrequency )+ 1};
        denominatorCoeff = polyMultiplication(denominatorCoeff, intermediatePoly);
        intermediatePoly.clear();

        // Adaugam polinomul aferent numaratorului filtrului 
        intermediatePoly = {1, 2, 1};
        numeratorCoeff = polyMultiplication(numeratorCoeff, intermediatePoly);
        intermediatePoly.clear();
    }

    // normalizam polinoamele (transformam temenul dominant de la numitor in 1)
    if(numeratorCoeff.size() == 0 || denominatorCoeff.size() == 0 || !normalizeVector(numeratorCoeff, denominatorCoeff[0]))
    {
        throw( std::string("Unbable to normalize filter polynomials") );
    }

    normalizeVector(denominatorCoeff, denominatorCoeff[0]);

    // initializare cu 0 a cozilor de valori filtrate si nefiltrate ale semnalului
    previousUnfilteredSamples.resize(numeratorCoeff.size(),0);
    previousFilteredSamples.resize(denominatorCoeff.size(),0);
  
}

std::vector<double> polyMultiplication(const std::vector<double> & polyA, const std::vector<double> & polyB)
{
    if(!polyA.size() || !polyB.size())
        return std::vector<double>();

    std::vector<double> polyProd(polyA.size() + polyB.size() - 1, 0.0); 
    for(uint16_t i = 0; i < polyA.size(); i++)
        for(uint16_t j = 0; j < polyB.size(); j++)
            polyProd[i+j] += polyA[i] * polyB[j];

    return polyProd;
}

bool normalizeVector(std::vector<double> & poly, double normalizationFactor)
{   
    
    if(fabs(normalizationFactor) < std::numeric_limits<float>::lowest())
        return false; 

    for(std::vector<double>::iterator it = poly.begin(); it != poly.end(); it++)
        *it = *it / normalizationFactor;

    return true;
}