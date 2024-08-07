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

inline double RMS_computation(int32_t value, double RMS_prev)
{
    // variables used for RMS calculation and update
    static double AUX_RMS_Ch_3, prev_val[SAMPLES_PER_PERIOD];

    // variable used to iterate through the first 2 * SAMPLES_PER_PERIOD RMS values
    static uint8_t Sample_Number;

    // variable used to turn the sample values reading into a voltage value
    double voltage = (static_cast<_Float64>(value)) / SCALING_CONSTANT;

    // for the first SAMPLES_PER_PERIOD - 1 samples, the RMS value should be kept at 0, it can only be
    // calculated after the first SAMPLES_PER_PERIOD samples
    if (Sample_Number <= SAMPLES_PER_PERIOD - 2)
    {
        // population of the vector containing the values ​​of the previous SAMPLES_PER_PERIOD samples,
        // values used for future updates of the RMS value
        prev_val[Sample_Number] = voltage * voltage;

        // summing up the squared values of the sample value reading
        AUX_RMS_Ch_3 += prev_val[Sample_Number];

        // increase the value of the iterator
        Sample_Number++;

        // the RMS value should be kept at 0 for now
        return 0;
    }

    // at the SAMPLES_PER_PERIOD'th sample value reading, we can calculate the real value of the RMS
    // for the first time
    else if (Sample_Number == SAMPLES_PER_PERIOD - 1)
    {
        // population of the vector containing the values ​​of the previous SAMPLES_PER_PERIOD samples,
        // values used for future updates of the RMS value
        prev_val[SAMPLES_PER_PERIOD - 1] = voltage * voltage;

        // adding the last squared voltage value to the sum
        AUX_RMS_Ch_3 += prev_val[SAMPLES_PER_PERIOD - 1];

        // increase the value of the iterator
        Sample_Number++;

        // since we are at the SAMPLES_PER_PERIOD'th sample value reading, we can calculate the first
        // value of the RMS based on the RMS calculation formula
        double RMS = sqrt(AUX_RMS_Ch_3 * SAMPLES_PER_PERIOD);
        return RMS;
    }

    // form here on, we retire the Sample_Number iterator, start using the Sample_Number_2 iterator and just
    // update the values of the RMS, without writing them anywhere
    else
    {
        // update the RMS value based on the update rule formula
        double RMS = sqrt(RMS_prev * RMS_prev + SAMPLES_PER_PERIOD * (voltage * voltage - prev_val[Sample_Number - SAMPLES_PER_PERIOD]));

        // overwrite the value from the vector that holds the previous SAMPLE_VALUE_PERIOD values ​​located at the position behind with
        // SAMPLE_VALUE_PERIOD positions from the current position
        prev_val[Sample_Number - SAMPLES_PER_PERIOD] = voltage * voltage;

        // if the iterator didn't reach SAMPLE_PER_PERIOD value, increase it by 1
        if (Sample_Number < 2 * SAMPLES_PER_PERIOD - 1)
            Sample_Number++;

        // else, reset it to 0
        else
            Sample_Number = SAMPLES_PER_PERIOD;

        return RMS;
    }
}

void SampledValuesSubscriberWrapper::SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu)
{
    // variables whose value we want to persist within each execution of this function

    // variables used for RMS calculation and update
    static double RMS_Ch_3;

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
                RMS_Ch_3 = RMS_computation(value, RMS_Ch_3);
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
            double rms = RMS_Ch_3 * sqrt(2) / SAMPLES_PER_PERIOD;
            bool value = rms > params->threshold;
            if (value == true)
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
