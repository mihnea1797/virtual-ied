#include "SampledValuesSubscriberWrapper.hpp"

// Static member initialization
std::unique_ptr<pqxx::connection> SampledValuesSubscriberWrapper::dbConn_ = nullptr;

std::vector<RmsComputationObject> SampledValuesSubscriberWrapper::voltageRmsObject;
std::vector<RmsComputationObject> SampledValuesSubscriberWrapper::currentRmsObject;

std::vector<ButterworthFilter> SampledValuesSubscriberWrapper::voltageButterFilter;
std::vector<ButterworthFilter> SampledValuesSubscriberWrapper::currentButterFilter;

std::vector<FrequencyTracking> SampledValuesSubscriberWrapper::voltageFrequencyTracker;
std::vector<FrequencyTracking> SampledValuesSubscriberWrapper::currentFrequencyTracker;

DataFormat SampledValuesSubscriberWrapper::format = DataFormat::pairVI;
uint8_t SampledValuesSubscriberWrapper::numberOfPhases = 4;

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(const nlohmann::json &sampleValuesSettings)
{
    ParseSettings(sampleValuesSettings);

    if (!_localAddress.empty())
    {
        _rSession = RSession_create();
        if (_rSession)
        {
            RSession_setLocalAddress(_rSession, const_cast<char *>(_localAddress.c_str()), _port);
            for (const auto &group : _multicastGroups)
            {
                RSession_addMulticastGroup(_rSession, const_cast<char *>(group.c_str()));
            }
            for (const auto &key : _keys)
            {
                RSecurityAlgorithm secAlgo = R_SESSION_SEC_ALGO_AES_128_GCM;
                if (key.secAlgo == "AES_128_GCM")
                    secAlgo = R_SESSION_SEC_ALGO_AES_128_GCM;
                // Add other if needed

                RSignatureAlgorithm sigAlgo = R_SESSION_SIG_ALGO_NONE;
                if (key.sigAlgo == "NONE")
                    sigAlgo = R_SESSION_SIG_ALGO_NONE;
                // Add other if needed

                RSession_addKey(_rSession, key.id, (uint8_t*)key.key.c_str(), key.key.length(), secAlgo, sigAlgo);
            }
            _receiver = SVReceiver_createRemote(_rSession);
        }
        else
        {
            printf("Failed to create RSession\n");
            _receiver = SVReceiver_create();
        }
    }
    else
    {
        _receiver = SVReceiver_create();
    }

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
    if (_rSession)
    {
        RSession_destroy(_rSession);
    }
}

void SampledValuesSubscriberWrapper::SetListener(std::function<void(bool)> goosePublishMessageFunction)
{
    static constexpr double sqrt2 = 1.4142135623730951;
    goosePublishMessageFunction(false);
    _listenerParams.appId = _appId;
    _listenerParams.goosePublishMessageFunction = &goosePublishMessageFunction;
    _listenerParams.voltageThreshold = _voltageThreshold / sqrt2;
    _listenerParams.currentThreshold = _currentThreshold / sqrt2;
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
    std::chrono::steady_clock::time_point sampleTimeStamp = std::chrono::steady_clock::now();

    ListenerParameters *params = static_cast<ListenerParameters *>(parameter);

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);

    std::vector<int32_t> voltageMeasurements;
    std::vector<int32_t> currentMeasurements;

    if (parseSVData(voltageMeasurements, currentMeasurements, asdu))
    {        
        if(format != DataFormat::onlyI)
        {    
            if(voltageMeasurements.size() < numberOfPhases)
            {
                printf("Less voltage measurements than the number of phases! Change the number of phases!\n");
                return;
            }
            for(uint32_t index = 0; index < numberOfPhases; index++)
            {
                int32_t filteredValue = voltageButterFilter[index].filter(voltageMeasurements[index]);
                double rms = voltageRmsObject[index].computeValue(filteredValue);
                // double rms = voltageRmsObject[index].computeValue(voltageMeasurements[index]);

                if(dbConn_)
                {
                    storeRMSinDatabase(params->appId, index, rms, "V");
                }

                if (params->goosePublishMessageFunction)
                {
                    printf("Checking voltage RMS value for phase %d : %.2lf\n", index + 1, rms);
                    if(rms > params->voltageThreshold)
                    {
                        (*(params->goosePublishMessageFunction))(true);
                    }
                }

                // double estimatedFrequency = voltageFrequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = voltageFrequencyTracker[index].frequencyEstimation(voltageMeasurements[index], sampleTimeStamp);
            }
        }

        if(format != DataFormat::onlyV)
        {    
            if(currentMeasurements.size() < numberOfPhases)
            {
                printf("Less current measurements than the number of phases! Change the number of phases!\n");
                return;
            }
            for(uint32_t index = 0; index < numberOfPhases; index++)
            {
                int32_t filteredValue = currentButterFilter[index].filter(currentMeasurements[index]);
                double rms = currentRmsObject[index].computeValue(filteredValue);
                // double rms = currentRmsObject[index].computeValue(currentMeasurements[index]);

                if(dbConn_)
                {
                    storeRMSinDatabase(params->appId, index, rms, "C");
                }

                if (params->goosePublishMessageFunction)
                {
                    if (params->goosePublishMessageFunction)
                    {
                        printf("Checking current RMS value for phase %d : %.2lf\n", index + 1, rms);
                        if(rms > params->currentThreshold)
                        {
                            (*(params->goosePublishMessageFunction))(true);
                        }
                    }
                }

                // double estimatedFrequency = currentFrequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = currentFrequencyTracker[index].frequencyEstimation(currentMeasurements[index], sampleTimeStamp);
            }
        }
    }
}

void SampledValuesSubscriberWrapper::setVoltageRmsObject(const nlohmann::json & signalProperties)
{
    voltageRmsObject.emplace_back(signalProperties);
}

void SampledValuesSubscriberWrapper::setCurrentRmsObject(const nlohmann::json & signalProperties)
{
    currentRmsObject.emplace_back(signalProperties);
}

void SampledValuesSubscriberWrapper::setVoltageButterFilter(const nlohmann::json & filterProperties)
{
    voltageButterFilter.emplace_back(filterProperties);
}

void SampledValuesSubscriberWrapper::setCurrentButterFilter(const nlohmann::json & filterProperties)
{
    currentButterFilter.emplace_back(filterProperties);
}

void SampledValuesSubscriberWrapper::setVoltageFrequencyTracker()
{
    voltageFrequencyTracker.push_back(FrequencyTracking());
}

void SampledValuesSubscriberWrapper::setCurrentFrequencyTracker()
{
    currentFrequencyTracker.push_back(FrequencyTracking());
}

void SampledValuesSubscriberWrapper::setPostgresConnection(const nlohmann::json &postgresSqlProperties)
{
    try {
        dbConn_ = std::make_unique<pqxx::connection>(ParsePostgresSQL(postgresSqlProperties));
    }
    catch(...) {
        printf("Unable to connect to database! Proceeding without connection...\n");
        dbConn_ = nullptr;
    }

}

void SampledValuesSubscriberWrapper::setDataFormat(const nlohmann::json &dataFormat)
{
    std::string measurementOrder = dataFormat.at("measurementOrder").get<std::string>();;
    std::string clusteringType = dataFormat.at("clusteringType").get<std::string>();;
    numberOfPhases = dataFormat.at("numberOfPhases").get<uint8_t>();

    if( clusteringType == "cluster" )
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
        if(format != DataFormat::onlyI)
        {
            outputFile << "  Voltage Threshold: " << _voltageThreshold << "\n";
        }
        if(format != DataFormat::onlyV)
        {
            outputFile << "  Current Threshold: " << _currentThreshold << "\n";
        }
        outputFile.close();
    }
}

void SampledValuesSubscriberWrapper::ParseSettings(const nlohmann::json &sampleValuesSettings)
{
    _interface = sampleValuesSettings.at("ethernetInterface").get<std::string>();
    _appId = sampleValuesSettings.at("appId").get<uint16_t>();
    _destAddrCheck = sampleValuesSettings.at("dstAddressCheck").get<bool>();
    _voltageThreshold = sampleValuesSettings.at("threshold").get<double>();
    _currentThreshold = sampleValuesSettings.at("threshold").get<double>();

    if (sampleValuesSettings.contains("rSessionSettings"))
    {
        const auto &rSession = sampleValuesSettings.at("rSessionSettings");
        _localAddress = rSession.at("localAddress").get<std::string>();
        _port = rSession.at("port").get<int>();
        _multicastGroups = rSession.at("multicastGroups").get<std::vector<std::string>>();
        for (const auto &keyJson : rSession.at("keys"))
        {
            RSessionKey key;
            key.id = keyJson.at("id").get<int>();
            key.key = keyJson.at("key").get<std::string>();
            key.secAlgo = keyJson.at("secAlgo").get<std::string>();
            key.sigAlgo = keyJson.at("sigAlgo").get<std::string>();
            _keys.push_back(key);
        }
    }
}

uint8_t SampledValuesSubscriberWrapper::getNumberOfPhases()
{
    return numberOfPhases;
}

DataFormat SampledValuesSubscriberWrapper::getDataFormat()
{
    return format;
}
std::string SampledValuesSubscriberWrapper::ParsePostgresSQL(const nlohmann::json &postgresSqlProperties)
{
    std::string postgresSqlConfigString = "";
    postgresSqlConfigString += "dbname=" + postgresSqlProperties.at("dbname").get<std::string>() + " ";
    postgresSqlConfigString += "user=" + postgresSqlProperties.at("user").get<std::string>() + " ";
    postgresSqlConfigString += "password=" + postgresSqlProperties.at("password").get<std::string>() + " ";
    postgresSqlConfigString += "hostaddr=" + postgresSqlProperties.at("hostaddr").get<std::string>();

    return postgresSqlConfigString;
}

void SampledValuesSubscriberWrapper::storeRMSinDatabase(uint16_t appId, uint32_t index, double rms, const std::string & measurement)
{
    std::string query =
        "INSERT INTO rms_voltage (time, app_id, phase, rms_value) "
        "VALUES (NOW(), $1, $2, $3, $4);";

    pqxx::work txn(*dbConn_);
    txn.exec_params(query, std::to_string(appId), index, rms, measurement);
    txn.commit();
}
