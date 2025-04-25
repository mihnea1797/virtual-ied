#include "SampledValuesSubscriberWrapper.hpp"

// Static member initialization
RmsComputationObject SampledValuesSubscriberWrapper::rmsObject = RmsComputationObject((uint8_t)80,(double)537401.187777);
ButterworthFilter SampledValuesSubscriberWrapper::butterFilter = ButterworthFilter((uint8_t)1,(float)200,(float)4000);
FrequencyTracking SampledValuesSubscriberWrapper::frequencyTracker = FrequencyTracking();
DataFormat SampledValuesSubscriberWrapper::format = DataFormat::pairVI;

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

bool SampledValuesSubscriberWrapper::parseSVData(std::vector<int32_t> & voltageMeasurements, std::vector<int32_t> & currentMeasurements, const SVSubscriber_ASDU & asdu)
{
    voltageMeasurements.clear();
    currentMeasurements.clear();

    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);
    int offset = 0;

    switch(format)
    {
        case DataFormat::clusterVI:
            if( dataSize < 8) return false;
            while (offset < dataSize / 2)
            {
                int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                voltageMeasurements.push_back(voltageValue);
                offset += 4;

                Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }

            while (offset < dataSize)
            {
                int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                currentMeasurements.push_back(currentValue);
                offset += 4;

                Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }
        break;

        case DataFormat::clusterIV:
            if( dataSize < 8) return false;
            while (offset < dataSize / 2)
            {
                int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                currentMeasurements.push_back(currentValue);
                offset += 4;

                Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }

            while (offset < dataSize)
            {
                int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                voltageMeasurements.push_back(voltageValue);
                offset += 4;

                Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }
        break;

        case DataFormat::pairVI:
            if( dataSize < 16) return false;
            while (offset < dataSize )
            {
                int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                voltageMeasurements.push_back(voltageValue);
                offset += 4;

                Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;

                int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                currentMeasurements.push_back(currentValue);
                offset += 4;

                Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }
        break;

        case DataFormat::pairIV:
            if( dataSize < 16) return false;
            while (offset < dataSize )
            {
                int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                currentMeasurements.push_back(currentValue);
                offset += 4;

                Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;

                int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                voltageMeasurements.push_back(voltageValue);
                offset += 4;

                Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }
        break;

        default:
            if( dataSize < 16) return false;
            while (offset < dataSize )
            {
                int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                voltageMeasurements.push_back(voltageValue);
                offset += 4;

                Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;

                int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
                currentMeasurements.push_back(currentValue);
                offset += 4;

                Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
                offset += 4;
            }
        break;
    };

    return true;
}

void SampledValuesSubscriberWrapper::SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu)
{
    static constexpr double sqrt2 = 1.4142135623730951;

    std::chrono::steady_clock::time_point sampleTimeStamp = std::chrono::steady_clock::now();

    ListenerParameters *params = static_cast<ListenerParameters *>(parameter);

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);

    std::vector<int32_t> voltageMeasurements;
    std::vector<int32_t> currentMeasurements;

    if( parseSVData(voltageMeasurements, currentMeasurements, asdu) )
    {
        // int32_t filteredValue = butterFilter.filter(voltageMeasurements[1])
        // double rms = rmsObject.computeValue(filteredValue);
        double rms = rmsObject.computeValue(voltageMeasurements[1]);
        if (params->goosePublishMessageFunction)
        {
            printf("Checking rms Value...\n");
            if (rms * sqrt2> params->threshold)
            {
                (*(params->goosePublishMessageFunction))(true);
            }
        }
        // double estimatedFrequency = frequencyTracker.frequencyEstimation(filteredValue, sampleTimeStamp);
        double estimatedFrequency = frequencyTracker.frequencyEstimation(voltageMeasurements[1], sampleTimeStamp);
    }
}

void SampledValuesSubscriberWrapper::setRmsObject(const RmsComputationObject & rmsObjectReference)
{
    rmsObject = rmsObjectReference;
}

void SampledValuesSubscriberWrapper::setButterFilter(const ButterworthFilter & butterFilterReference)
{
    butterFilter = butterFilterReference;
}

void SampledValuesSubscriberWrapper::setDataFormat(const nlohmann::json & dataFormat)
{
    std::string measurementOrder = dataFormat.at("measurementOrder");
    std::string clusteringType = dataFormat.at("clusteringType");
    if( clusteringType == "cluster" )
    {
        if( measurementOrder == "voltageFirst" )
            format = DataFormat::clusterVI;
        else if( measurementOrder == "currentFirst" )
            format = DataFormat::clusterIV;
    }
    else if( clusteringType == "pair" )
    {
        if( measurementOrder == "voltageFirst" )
            format = DataFormat::pairVI;
        else if( measurementOrder == "currentFirst" )
            format = DataFormat::pairIV;
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
