#include "SampledValuesSubscriberWrapper.hpp"
#include <fstream>

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(const nlohmann::json &settings)
{
    ParseSettings(settings);

    _receiver = SVReceiver_create();
    SVReceiver_setInterfaceId(_receiver, const_cast<char *>(_interface.c_str()));

    _subscriber = SVSubscriber_create(NULL, _appId);

    if (_destAddrCheck)
    {
        SVReceiver_enableDestAddrCheck(_receiver);
    }
    else
    {
        SVReceiver_disableDestAddrCheck(_receiver);
    }

    SVReceiver_addSubscriber(_receiver, _subscriber);
}

SampledValuesSubscriberWrapper::~SampledValuesSubscriberWrapper()
{
    SVReceiver_stop(_receiver);
    SVReceiver_destroy(_receiver);
}

void SampledValuesSubscriberWrapper::SetListener(std::function<void(bool)> goosePublishMessageFunction)
{
    _listenerParams.goosePublishMessageFunction = &goosePublishMessageFunction;
    _listenerParams.threshold = _threshold;
    SVSubscriber_setListener(_subscriber, SvUpdateListener, &_listenerParams);
    listenerSet = true;
}

void SampledValuesSubscriberWrapper::Start()
{
    printf("Starting Listener...\n");
    if (!listenerSet)
    {
        printf("Listener not set\n");
        return;
    }

    SVReceiver_start(_receiver);

    if (!SVReceiver_isRunning(_receiver))
    {
        printf("Failed to start SV subscriber. Reason can be that the Ethernet interface doesn't exist or root permission are required.\n");
    }
}

inline double RMS_computation(const int32_t &value, __uint128_t &PREVIOUS_INTERMEDIAR_VALUE_UNSCALED, uint8_t &Sample_Number, __uint128_t &AUX_RMS_UNSCALED, uint64_t *prev_val)
{
    /// function arguments meaning

    // value <-> the ( unscaled ) value of the sample value reading
    //
    // PREVIOUS_INTERMEDIAR_VALUE_UNSCALED <-> variable used for the RMS update rule
    //
    // AUX_RMS_UNSCALED <-> variable used for storing the sum of the first SAMPLES_PER_PERIOD ​​(unscaled) sample values readings
    //
    //
    // prev_val <-> array used for storing the values of the previous SAMPLES_PER_PERIOD (unscaled) sample value readings
    //
    // Sample_Number <-> variable used to iterate through the first SAMPLES_PER_PERIOD RMS values ( after the first SAMPLES_PER_PERIOD
    //                   samples it acts as a circular iterator, resetting everytime it reaches the value of SAMPLES_PER_PERIOD)

    /* Block of code used for debugging the RMS_computation function using files
    static std::ofstream outputFile;
    static uint8_t flag = 1;
    static uint8_t nr_of_readings = 255;

    if(flag)
    {
        outputFile.open("/opt/virtual-merging-unit/RMS.txt");
        flag = 0;
    }
    */

    // variable used for storing the absolute value of the current (unscaled) sample value reading
    uint64_t voltage_unscaled = (uint64_t)(value > 0 ? value : (-1) * value);

    // for the first SAMPLES_PER_PERIOD - 1 samples, the RMS value should be kept at 0, it can only be
    // calculated after the first SAMPLES_PER_PERIOD samples
    if (Sample_Number <= SAMPLES_PER_PERIOD - 2)
    {
        // population of the vector containing the values ​​of the previous SAMPLES_PER_PERIOD (unscaled) samples,
        // values used for future updates of the RMS value
        prev_val[Sample_Number] = voltage_unscaled * voltage_unscaled;

        // summing up the squared values of the (unscaled) sample value readings
        AUX_RMS_UNSCALED += (__uint128_t)prev_val[Sample_Number];

        // increase the value of the iterator
        Sample_Number++;

        /* Block of code used for debugging the RMS_computation function using files
        outputFile << 0 << " ";
        */

        // the RMS value should be kept at 0 for now
        return 0;
    }

    // at the SAMPLES_PER_PERIOD'th sample value reading, we can calculate the real value of the RMS
    // for the first time
    else if (Sample_Number == SAMPLES_PER_PERIOD - 1)
    {
        // population of the vector containing the values ​​of the previous SAMPLES_PER_PERIOD (unscaled) samples,
        // values used for future updates of the RMS value
        prev_val[SAMPLES_PER_PERIOD - 1] = voltage_unscaled * voltage_unscaled;

        // adding the last squared (unscaled) voltage value to the sum
        AUX_RMS_UNSCALED += (__uint128_t)prev_val[SAMPLES_PER_PERIOD - 1];

        // increase the value of the iterator
        Sample_Number++;

        // assign value to PREVIOUS_INTERMEDIATE_VALUE_UNSCALED for the first time
        PREVIOUS_INTERMEDIAR_VALUE_UNSCALED = AUX_RMS_UNSCALED * SAMPLES_PER_PERIOD;

        // since we are at the SAMPLES_PER_PERIOD'th sample value reading, we can calculate the first
        // value of the RMS based on the RMS calculation formula
        _Float128 AUX_SCALED = ((_Float128)AUX_RMS_UNSCALED) / SCALING_CONSTANT_SQUARED;
        double RMS = sqrt(((double)AUX_SCALED) * SAMPLES_PER_PERIOD);

        /* Block of code used for debugging the RMS_computation function using files
        outputFile << RMS * SQRT2 / SAMPLES_PER_PERIOD << " ";
        */

        return RMS * SQRT2 / SAMPLES_PER_PERIOD;
    }

    // from here on, the Sample_Number iterator acts as a circular iterator, resetting everytime it reaches the value of SAMPLES_PER_PERIOD
    else
    {

        // calculate an intermediate integer value that's going to be used in the update of the RMS value based on the update rule formula
        uint64_t newest_voltage_squared = voltage_unscaled * voltage_unscaled;
        __uint128_t INTERMEDIAR_VALUE_UNSCALED = PREVIOUS_INTERMEDIAR_VALUE_UNSCALED + ((__uint128_t)(newest_voltage_squared)) * SAMPLES_PER_PERIOD;
        __uint128_t SUBSTRACT_OLDEST_VALUE = ((__uint128_t)(prev_val[Sample_Number - SAMPLES_PER_PERIOD])) * SAMPLES_PER_PERIOD;
        INTERMEDIAR_VALUE_UNSCALED = (INTERMEDIAR_VALUE_UNSCALED > SUBSTRACT_OLDEST_VALUE ? INTERMEDIAR_VALUE_UNSCALED - SUBSTRACT_OLDEST_VALUE : 0);

        // overwrite the value from the array that holds the previous SAMPLE_VALUE_PERIOD values ​​located at the position behind with
        // SAMPLE_VALUE_PERIOD positions from the current position
        prev_val[Sample_Number - SAMPLES_PER_PERIOD] = newest_voltage_squared;

        // update the value of PREVIOUS_INTERMEDIAR_VALUE_UNSCALED
        PREVIOUS_INTERMEDIAR_VALUE_UNSCALED = INTERMEDIAR_VALUE_UNSCALED;

        // if the iterator didn't reach SAMPLE_PER_PERIOD value, increase it by 1
        if (Sample_Number < 2 * SAMPLES_PER_PERIOD - 1)
            Sample_Number++;

        // else, reset it to 0
        else
            Sample_Number = SAMPLES_PER_PERIOD;

        // using the intermediate integer value mentioned above, we can now compute the value of the RMS
        _Float128 INTERMEDIAR_VALUE_SCALED = ((_Float128)INTERMEDIAR_VALUE_UNSCALED) / SCALING_CONSTANT_SQUARED;
        double RMS = sqrt(((double)INTERMEDIAR_VALUE_SCALED));

        /* Block of code used for debugging the RMS_computation function using files
        if( nr_of_readings-- >= 2)
        {
           outputFile << RMS * SQRT2 / SAMPLES_PER_PERIOD << " ";
        }

        else if( nr_of_readings-- == 1)
        {
           outputFile << RMS << " ";
           outputFile.close();
        }

        else
        {
        }
        */

        return RMS * SQRT2 / SAMPLES_PER_PERIOD;
    }
}

void SampledValuesSubscriberWrapper::SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu)
{
    // variables whose value we want to persist within each execution of this function
    static __uint128_t PREVIOUS_INTERMEDIAR_VALUE_UNSCALED = 0;
    static uint8_t Sample_Number = 0;
    static __uint128_t AUX_RMS_UNSCALED = 0;
    static uint64_t prev_val[SAMPLES_PER_PERIOD];

    // variable used to store the RMS value
    double RMS;

    ListenerParameters *params = static_cast<ListenerParameters *>(parameter);

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);
    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);

    if (dataSize >= 16)
    {
        int offset = 0;
        int counter = 0;
        while (offset < dataSize)
        {
            int32_t value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;

            // counter represents the number of the phase. In this example, we monitor only the third phase, processing only the
            // sample values coresponding to this phase
            if (counter == 3)
            {
                RMS = RMS_computation(value, PREVIOUS_INTERMEDIAR_VALUE_UNSCALED, Sample_Number, AUX_RMS_UNSCALED, prev_val);
            }

            Quality quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;

            quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            counter++;
        }

        if (params->goosePublishMessageFunction)
        {
            printf("Checking RMS Value...\n");
            bool value = RMS > params->threshold;
            if (value)
            {
                (*(params->goosePublishMessageFunction))(value);
            }
        }
    }
}

void SampledValuesSubscriberWrapper::Print()
{
    std::ofstream outputFile("output-sv.txt");
    if (outputFile.is_open())
    {
        outputFile << "SampledValuesSubscriberWrapper Configuration:\n";
        outputFile << "  Interface: " << _interface << "\n";
        outputFile << "  AppId: " << _appId << "\n";
        outputFile << "  DestAddrCheck: " << (_destAddrCheck ? "true" : "false") << "\n";
        outputFile << "  Threshold: " << _listenerParams.threshold << "\n";
        outputFile.close();
    }
}

void SampledValuesSubscriberWrapper::ParseSettings(const nlohmann::json &settings)
{
    _interface = settings.at("ethernetInterface").get<std::string>();
    _appId = settings.at("appId").get<uint16_t>();
    _destAddrCheck = settings.at("dstAddressCheck").get<bool>();
    _threshold = settings.at("threshold").get<double>();
}
