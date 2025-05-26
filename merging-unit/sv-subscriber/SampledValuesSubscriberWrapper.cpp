#include "SampledValuesSubscriberWrapper.hpp"

// Static member initialization
std::vector<RmsComputationObject> SampledValuesSubscriberWrapper::rmsObject;
std::vector<ButterworthFilter> SampledValuesSubscriberWrapper::butterFilter;
std::vector<FrequencyTracking> SampledValuesSubscriberWrapper::frequencyTracker;

DataFormat SampledValuesSubscriberWrapper::format = DataFormat::pairVI;

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(const nlohmann::json &sampleValuesSettings, const nlohmann::json &postgresSqlProperties)
{
    ParseSettings(sampleValuesSettings);
    ParsePostgresSQL(postgresSqlProperties);
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

bool SampledValuesSubscriberWrapper::parseSVData(std::vector<int32_t> &voltageMeasurements, std::vector<int32_t> &currentMeasurements, const SVSubscriber_ASDU &asdu)
{
    voltageMeasurements.clear();
    currentMeasurements.clear();

    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);
    int offset = 0;

    switch (format)
    {
    case DataFormat::onlyV:
        if (dataSize < 8)
            return false;
        while (offset < dataSize)
        {
            int32_t voltageValue = SVSubscriber_ASDU_getINT32(asdu, offset);
            voltageMeasurements.push_back(voltageValue);
            offset += 4;

            Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
        }
        break;

    case DataFormat::onlyI:
        if (dataSize < 8)
            return false;
        while (offset < dataSize)
        {
            int32_t currentValue = SVSubscriber_ASDU_getINT32(asdu, offset);
            currentMeasurements.push_back(currentValue);
            offset += 4;

            Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
        }
        break;

    case DataFormat::clusterVI:
        if (dataSize < 8)
            return false;
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
        if (dataSize < 8)
            return false;
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
        if (dataSize < 16)
            return false;
        while (offset < dataSize)
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
        if (dataSize < 16)
            return false;
        while (offset < dataSize)
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
        if (dataSize < 16)
            return false;
        while (offset < dataSize)
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

    if (parseSVData(voltageMeasurements, currentMeasurements, asdu))
    {
        if (format == DataFormat::onlyV)
        {
            for (uint32_t index = 0; index < NUMBER_OF_PHASES; index++)
            {
                int32_t filteredValue = butterFilter[index].filter(voltageMeasurements[index]);
                double rms = rmsObject[index].computeValue(filteredValue);
                // double rms = rmsObject[index].computeValue(voltageMeasurements[index]);
                if (params->goosePublishMessageFunction)
                {
                    printf("Checking rms Value for phase %d...\n", index + 1);
                    if (rms * sqrt2 > params->threshold)
                    {
                        (*(params->goosePublishMessageFunction))(true);
                    }
                }
                // double estimatedFrequency = frequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = frequencyTracker[index].frequencyEstimation(voltageMeasurements[index], sampleTimeStamp);
            }
        }

        else if (format == DataFormat::onlyI)
        {
            for (uint32_t index = 0; index < NUMBER_OF_PHASES; index++)
            {
                int32_t filteredValue = butterFilter[index].filter(currentMeasurements[index]);
                double rms = rmsObject[index].computeValue(filteredValue);
                // double rms = rmsObject[index].computeValue(currentMeasurements[index]);
                if (params->goosePublishMessageFunction)
                {
                    printf("Checking rms Value for phase %d...\n", index + 1);
                    if (rms * sqrt2 > params->threshold)
                    {
                        (*(params->goosePublishMessageFunction))(true);
                    }
                }
                // double estimatedFrequency = frequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = frequencyTracker[index].frequencyEstimation(currentMeasurements[index], sampleTimeStamp);
            }
        }
    }
}

void SampledValuesSubscriberWrapper::setRmsObject(const nlohmann::json &signalProperties)
{
    rmsObject.emplace_back(signalProperties);
}

void SampledValuesSubscriberWrapper::setButterFilter(const nlohmann::json &filterProperties)
{
    butterFilter.emplace_back(filterProperties);
}

void SampledValuesSubscriberWrapper::setFrequencyTracker()
{
    frequencyTracker.push_back(FrequencyTracking());
}

void SampledValuesSubscriberWrapper::setDataFormat(const nlohmann::json &dataFormat)
{
    std::string measurementOrder = dataFormat.at("measurementOrder");
    std::string clusteringType = dataFormat.at("clusteringType");
    if (clusteringType == "cluster")
    {
        if (measurementOrder == "voltageFirst")
            format = DataFormat::clusterVI;
        else if (measurementOrder == "currentFirst")
            format = DataFormat::clusterIV;
    }
    else if (clusteringType == "pair")
    {
        if (measurementOrder == "voltageFirst")
            format = DataFormat::pairVI;
        else if (measurementOrder == "currentFirst")
            format = DataFormat::pairIV;
    }
    else if (clusteringType == "single")
    {
        if (measurementOrder == "voltageFirst")
            format = DataFormat::onlyV;
        else if (measurementOrder == "currentFirst")
            format = DataFormat::onlyI;
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

void SampledValuesSubscriberWrapper::ParseSettings(const nlohmann::json &sampleValuesSettings)
{
    _interface = sampleValuesSettings.at("ethernetInterface").get<std::string>();
    _appId = sampleValuesSettings.at("appId").get<uint16_t>();
    _destAddrCheck = sampleValuesSettings.at("dstAddressCheck").get<bool>();
    _threshold = sampleValuesSettings.at("threshold").get<double>();
}

void SampledValuesSubscriberWrapper::ParsePostgresSQL(const nlohmann::json &postgresSqlProperties)
{
    std::string postgresSqlConfigString = "";
    postgresSqlConfigString +=  "dbname=" + postgresSqlProperties.at("dbname").get<std::string>() + " ";
    postgresSqlConfigString +=  "user=" + postgresSqlProperties.at("user").get<std::string>() + " ";
    postgresSqlConfigString +=  "password=" + postgresSqlProperties.at("password").get<std::string>() + " ";
    postgresSqlConfigString +=  "hostaddr=" + postgresSqlProperties.at("hostaddr").get<std::string>();
    dbConn_ = std::make_unique<pqxx::connection>(postgresSqlConfigString);
}
