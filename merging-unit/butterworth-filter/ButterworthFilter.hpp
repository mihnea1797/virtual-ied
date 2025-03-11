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
    // TODO: Atributele clasei ButterworthFilter, cel mai probabil acestea fiind:
    //       1) Ordinul filtrului: uint8_t -> posibil nu atat de util dupa discretizare
    //          cand polinoamele de la numarator si numitor se vor modifica in urma 
    //          aplicarii metodei Tustin
    uint8_t order;
    //       2) Frecventa de taiere a filtrului: float -> aceasta isi va pastra importanta
    //          chiar si in urma discretizarii
    float cutoffFrequency;
    //       3) Frecventa de esantionare a filtrului: float -> aceasta va fi
    //          setata la 50Hz * 80 samples / period = 4000 Hz, caz in care,
    //          conform teoremei de esantionare Nyquist-Shannon: f_cutoff < 
    //          f_sampling / 2, ne va rezulta ca frecventa de taiere a filtrului
    //          ar trebui sa fie cel mult 2000 Hz, pentru a se evita fenomenul de 
    //          aliere in frecventa
    float samplingFrequency;
    //       4) Vector ce contine coeficientii numaratorului filtrului 
    //          ( in urma discretizarii ) : std::vector<double>
    std::vector<double> numeratorCoeff;
    //       5) Vector ce contine coeficientii numitorului filtrului 
    //          ( in urma discretizarii ) : std::vector<double>
    std::vector<double> denominatorCoeff;
    //       6) Queue ce va contine valorile anterioare ale semnalului nefiltrat :
    //          std::queue<int32_t>
    std::deque<int32_t> previousUnfilteredSamples;
    //       7) Queue ce va contine valorile anterioare ale semnalului filtrat :
    //          std::queue<int32_t> -> in teorie acestea ar trebui sa fie float 
    //          sau double, dar, considerand ca lucram cu numere mari, rotunjirea 
    //          la cel mai apropiat intreg ar duce la o pierdere de acuratete scazuta
    //          si o reducere semnificativa a timpului de executie
    std::deque<int32_t> previousFilteredSamples;
    //       8) Helper function utilizat pentru realizarea produsului de polinoame:
    //          std::vector<double> (const std::vector<double> &, const std::vector<double> &)
    std::vector<double> polyMultiplication(const std::vector<double> & polyA, const std::vector<double> & polyB);
    //       9) Helper function utilizat pentru normalizarea polinoamelor 
    //          bool (std::vector<double>, double)
    bool normalizeVector(std::vector<double> & poly, double normalizationFactor);


public:
    ButterworthFilter() = delete;
    // TODO : Constructor cu parametri, cel mai probabil acesti parametri vor fi:
    //        1) Ordinul filtrului: uint8_t
    //        2) Frecventa de taiere a filtrului: float -> de gandit daca valoare 
    //           normalizata sau nenormalizata a pulsatiei de taiere, cel mai probabil
    //           nenormalizata ( bazat pe lucrarea stintifica )
    //        3) Frecventa de esantionare a filtrului: float
    //
    //        Acest constructor va avea urmatoarele atributii:
    //        1) Caluleaza polii functiei de transfer aferente filtrului folosind 
    //           radacinile de ordin n ale unitatii : s^n = 1
    //        2) Calculeaza coeficientii pe baza polilor calculati anterior
    //        3) Discretizeaza acest filtru folosind metoda de discretizare Tustin
    //           ( in cazul nostru, perioada noastra de esantionare este 50Hz * 80 
    //           samples / period = 4000 Hz )   
    ButterworthFilter(uint8_t order, float cuttoffFrequency, float samplingFrequency);

    ~ButterworthFilter();
    // TODO : Adaugare metoda de filtrare avand, cel mai probabil, semnatura:
    //        int32_t filter( int32_t )
    //        , unde parametrul va fi esantionul tocmai primit din semnalul nefiltrat
    //        iar valoarea returnata va fi valoarea aferenta esantionului respectiv
    //        din semnalul filtrat
    int32_t filter(int32_t inputSample);
};

#endif