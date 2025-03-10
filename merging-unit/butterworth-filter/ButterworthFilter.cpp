#include "ButterworthFilter.hpp"

ButterworthFilter::~ButterworthFilter()
{

}

ButterworthFilter::ButterworthFilter(uint8_t order, float cuttoffFrequency, float samplingFrequency) : order(order), cutoffFrequency(cutoffFrequency), samplingFrequency(samplingFrequency)
{
    // // vector de polinoame ce se vor compune numitorul filtrului Butterworth ( in timp continuu )
    // std::vector< std::vector<double> > denominatorPoly; 
    // // vector ce va fi utilizat pentru a stoca "polinoamele" ce urmeaza a fi introduse in denominatorPoly 
    // std::vector<double> poly;
    // // Se disting 2 cazuri: n = par ( -2 * pi * cutoffFrequency nu va fi radacina a filtrului ) si n = impar ( -2 * pi * cutoffFrequency va fi radacina a filtrului )
    // if( order % 2 )
    // {
    //     // Adaugam -cutoffFrequency ca radacina a polinomului 
    //     poly = {1, 2 * M_PI * cutoffFrequency};
    //     denominatorPoly.push_back(poly);
    //     poly.clear();
    // }
    // // urmeaza sa introducem in denominatorPoly polinoamele formate din perechi de poli complex-conjugati
    // for(uint8_t k = 1; k <= order / 2; k++)
    // {
    //     poly = {1, 4 * M_PI * cutoffFrequency * sin(M_PI * (2 * k - 1) / (2 * order)), 4 * M_PI * M_PI * cutoffFrequency * cutoffFrequency};
    //     denominatorPoly.push_back(poly);
    //     poly.clear();
    // }

    //CHECKPOINT I, pana aici stim ca e bine, am calculat polinoamele aferente filtrelor butterworth pana la ordinul 6 si all seems to be going great

    // vector de polinoame ce se vor compune numitorul filtrului Butterworth ( in timp discret )
    std::vector< std::vector<double> > denominatorPoly; 
    // vector de polinoame ce se vor compune numaratorul filtrului Butterworth ( in timp discret )
    std::vector< std::vector<double> > numeratorPoly;
    // vector ce va fi utilizat pentru a stoca "polinoamele" ce urmeaza a fi introduse in denominatorPoly si numeratorPoly
    std::vector<double> poly;
    // Se disting 2 cazuri: n = par ( -2 * pi * cutoffFrequency nu va fi radacina a filtrului ) si n = impar ( -2 * pi * cutoffFrequency va fi radacina a filtrului )
    if( order % 2 )
    {
        // Adaugam polinomul aferent numitorului filtrului 
        poly = {2 * M_PI * cutoffFrequency - 2 * samplingFrequency, 2 * M_PI * cutoffFrequency - 2 * samplingFrequency};
        denominatorPoly.push_back(poly);
        poly.clear();

        // Adaugam polinomul aferent numaratorului filtrului 
        poly = {1, 1};
        numeratorPoly.push_back(poly);
        poly.clear();

    }
    // urmeaza sa introducem in denominatorPoly polinoamele formate din perechi de poli complex-conjugati
    for(uint8_t k = 1; k <= order / 2; k++)
    {
        // Adaugam polinomul aferent numitorului filtrului 
        poly = {4 * samplingFrequency * samplingFrequency + 8 * M_PI * cutoffFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) + 4 * M_PI * M_PI * cutoffFrequency * cutoffFrequency, 8 * M_PI * M_PI * cutoffFrequency * cutoffFrequency - 8 * samplingFrequency * samplingFrequency, 4 * samplingFrequency * samplingFrequency - 8 * M_PI * cutoffFrequency * sin(M_PI * (2 * k - 1) / (2 * order)) + 4 * M_PI * M_PI * cutoffFrequency * cutoffFrequency};
        denominatorPoly.push_back(poly);
        poly.clear();

        // Adaugam polinomul aferent numaratorului filtrului 
        poly = {1, 2, 1};
        numeratorPoly.push_back(poly);
        poly.clear();
    }

    //CHECKPOINT II, pana aici stim ca e bine, am calculat formele aferente polinoamelor discretizate, forme ce au fost verificare cu ajutorul MATLAB

    // TODO: Ramane de efectuat inmultirea polinoamelor din cadrul denominatorPoly si numeratorPoly ( convolutia coeficientilor acestora ) si de verificat cu ajutorul Matlab.
    //       Acesta reprezinta pasul final pentru a obtine numeratorCoeff si denominatorCoeff, urmand a se popula previousUnfilteredSamples si previousFilteredSamples cu
    //       0-uri in numar de numeratorCoeff.size() si denominatorCoeff.size()
}
