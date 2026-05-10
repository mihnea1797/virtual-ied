#include "SampledValuesSubscriberWrapper.hpp"

SampledValuesSubscriberWrapper::SampledValuesSubscriberWrapper(const nlohmann::json &receiverSettings)
{
    ParseReceiverSettings(receiverSettings);

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

    if (_destAddrCheck)
    {
        SVReceiver_enableDestAddrCheck(_receiver);
    }
    else
    {
        SVReceiver_disableDestAddrCheck(_receiver);
    }
}

SampledValuesSubscriberWrapper::~SampledValuesSubscriberWrapper()
{
    SVReceiver_stop(_receiver);
    for (SVSubscriber subscriber : _subscribers)
    {
        SVSubscriber_destroy(subscriber);
    }
    SVReceiver_destroy(_receiver);
    if (_rSession)
    {
        RSession_destroy(_rSession);
    }
}

void SampledValuesSubscriberWrapper::addStream(const nlohmann::json &streamConfig, std::function<void(bool)> publishFn)
{
    auto params = std::make_unique<ListenerParameters>();
    params->appId             = streamConfig.at("appId").get<uint16_t>();
    params->voltageThreshold  = streamConfig.at("threshold").get<double>();
    params->currentThreshold  = streamConfig.at("threshold").get<double>();
    params->goosePublishMessageFunction = std::move(publishFn);
    params->dbConn = _dbConn.get();

    // Parse data format
    const auto &dataFormat        = streamConfig.at("dataFormat");
    std::string measurementOrder  = dataFormat.at("measurementOrder").get<std::string>();
    std::string clusteringType    = dataFormat.at("clusteringType").get<std::string>();
    params->state.numberOfPhases  = dataFormat.at("numberOfPhases").get<uint8_t>();

    if (clusteringType == "cluster")
    {
        if (measurementOrder == "voltageFirst")  params->state.format = DataFormat::clusterVI;
        else if (measurementOrder == "currentFirst") params->state.format = DataFormat::clusterIV;
    }
    else if (clusteringType == "pair")
    {
        if (measurementOrder == "voltageFirst")  params->state.format = DataFormat::pairVI;
        else if (measurementOrder == "currentFirst") params->state.format = DataFormat::pairIV;
    }
    else if (clusteringType == "single")
    {
        if (measurementOrder == "voltageFirst")  params->state.format = DataFormat::onlyV;
        else if (measurementOrder == "currentFirst") params->state.format = DataFormat::onlyI;
    }

    const auto &signalProperties = streamConfig.at("signalProperties");
    const auto &filterProperties = streamConfig.at("filterProperties");

    for (uint32_t i = 0; i < params->state.numberOfPhases; i++)
    {
        if (params->state.format != DataFormat::onlyI)
        {
            params->state.voltageRmsObject.emplace_back(signalProperties);
            params->state.voltageButterFilter.emplace_back(filterProperties);
            params->state.voltageFrequencyTracker.push_back(FrequencyTracking());
        }
        if (params->state.format != DataFormat::onlyV)
        {
            params->state.currentRmsObject.emplace_back(signalProperties);
            params->state.currentButterFilter.emplace_back(filterProperties);
            params->state.currentFrequencyTracker.push_back(FrequencyTracking());
        }
    }

    SVSubscriber subscriber = SVSubscriber_create(NULL, params->appId);
    SVSubscriber_setListener(subscriber, SvUpdateListener, params.get());
    SVReceiver_addSubscriber(_receiver, subscriber);

    _subscribers.push_back(subscriber);
    _listenerParams.push_back(std::move(params));
}

void SampledValuesSubscriberWrapper::Start()
{
    printf("Starting Listener...\n");
    if (_subscribers.empty())
    {
        printf("No streams added — call addStream() before Start()\n");
        return;
    }

    SVReceiver_start(_receiver);

    if (!SVReceiver_isRunning(_receiver))
    {
        printf("Failed to start SV subscriber. Reason can be that the Ethernet interface doesn't exist or root permission are required.\n");
    }
}

bool SampledValuesSubscriberWrapper::parseSVData(std::vector<int32_t> &voltageMeasurements, std::vector<int32_t> &currentMeasurements, const SVSubscriber_ASDU &asdu, DataFormat format)
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
            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
            voltageMeasurements.push_back(voltageValue);
            offset += 4;

            Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
        }

        while (offset < dataSize)
        {
            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
            currentMeasurements.push_back(currentValue);
            offset += 4;

            Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
        }

        while (offset < dataSize)
        {
            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
            voltageMeasurements.push_back(voltageValue);
            offset += 4;

            Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
            currentMeasurements.push_back(currentValue);
            offset += 4;

            Quality currentQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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
            int32_t voltageValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
            voltageMeasurements.push_back(voltageValue);
            offset += 4;

            Quality voltageQuality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;

            int32_t currentValue = static_cast<int32_t>(SVSubscriber_ASDU_getFLOAT32(asdu, offset) * 1000.0f);
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

    if (parseSVData(voltageMeasurements, currentMeasurements, asdu, params->state.format))
    {
        if (params->state.format != DataFormat::onlyI)
        {
            if (voltageMeasurements.size() < params->state.numberOfPhases)
            {
                printf("Less voltage measurements than the number of phases! Change the number of phases!\n");
                return;
            }
            for (uint32_t index = 0; index < params->state.numberOfPhases; index++)
            {
                int32_t filteredValue = params->state.voltageButterFilter[index].filter(voltageMeasurements[index]);
                double rms = params->state.voltageRmsObject[index].computeValue(filteredValue);
                // double rms = params->state.voltageRmsObject[index].computeValue(voltageMeasurements[index]);

                if (params->dbConn)
                {
                    storeRMSinDatabase(*params->dbConn, params->appId, index, rms, "V");
                }

                if (params->goosePublishMessageFunction)
                {
                    printf("Checking voltage RMS value for phase %d : %.2lf\n", index + 1, rms);
                    if (rms > params->voltageThreshold)
                    {
                        params->goosePublishMessageFunction(true);
                    }
                }

                // double estimatedFrequency = params->state.voltageFrequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = params->state.voltageFrequencyTracker[index].frequencyEstimation(voltageMeasurements[index], sampleTimeStamp);
            }
        }

        if (params->state.format != DataFormat::onlyV)
        {
            if (currentMeasurements.size() < params->state.numberOfPhases)
            {
                printf("Less current measurements than the number of phases! Change the number of phases!\n");
                return;
            }
            for (uint32_t index = 0; index < params->state.numberOfPhases; index++)
            {
                int32_t filteredValue = params->state.currentButterFilter[index].filter(currentMeasurements[index]);
                double rms = params->state.currentRmsObject[index].computeValue(filteredValue);
                // double rms = params->state.currentRmsObject[index].computeValue(currentMeasurements[index]);

                if (params->dbConn)
                {
                    storeRMSinDatabase(*params->dbConn, params->appId, index, rms, "C");
                }

                if (params->goosePublishMessageFunction)
                {
                    printf("Checking current RMS value for phase %d : %.2lf\n", index + 1, rms);
                    if (rms > params->currentThreshold)
                    {
                        params->goosePublishMessageFunction(true);
                    }
                }

                // double estimatedFrequency = params->state.currentFrequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = params->state.currentFrequencyTracker[index].frequencyEstimation(currentMeasurements[index], sampleTimeStamp);
            }
        }
    }
}

void SampledValuesSubscriberWrapper::setPostgresConnection(const nlohmann::json &postgresSqlProperties)
{
    try {
        _dbConn = std::make_unique<pqxx::connection>(ParsePostgresSQL(postgresSqlProperties));
    }
    catch(...) {
        printf("Unable to connect to database! Proceeding without connection...\n");
        _dbConn = nullptr;
    }
}

void SampledValuesSubscriberWrapper::Print()
{
    std::ofstream outputFile("output-sv.txt");
    if (outputFile.is_open())
    {
        outputFile << "SampledValuesSubscriberWrapper Configuration:\n";
        outputFile << "  Interface: " << _interface << "\n";
        outputFile << "  DestAddrCheck: " << (_destAddrCheck ? "true" : "false") << "\n";
        for (const auto &params : _listenerParams)
        {
            outputFile << "  Stream appId: " << params->appId << "\n";
            if (params->state.format != DataFormat::onlyI)
                outputFile << "    Voltage Threshold: " << params->voltageThreshold << "\n";
            if (params->state.format != DataFormat::onlyV)
                outputFile << "    Current Threshold: " << params->currentThreshold << "\n";
        }
        outputFile.close();
    }
}

void SampledValuesSubscriberWrapper::ParseReceiverSettings(const nlohmann::json &receiverSettings)
{
    _interface    = receiverSettings.at("ethernetInterface").get<std::string>();
    _destAddrCheck = receiverSettings.at("dstAddressCheck").get<bool>();

    if (receiverSettings.contains("rSessionSettings"))
    {
        const auto &rSession = receiverSettings.at("rSessionSettings");
        _localAddress    = rSession.at("localAddress").get<std::string>();
        _port            = rSession.at("port").get<int>();
        _multicastGroups = rSession.at("multicastGroups").get<std::vector<std::string>>();
        for (const auto &keyJson : rSession.at("keys"))
        {
            RSessionKey key;
            key.id      = keyJson.at("id").get<int>();
            key.key     = keyJson.at("key").get<std::string>();
            key.secAlgo = keyJson.at("secAlgo").get<std::string>();
            key.sigAlgo = keyJson.at("sigAlgo").get<std::string>();
            _keys.push_back(key);
        }
    }
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

void SampledValuesSubscriberWrapper::storeRMSinDatabase(pqxx::connection &dbConn, uint16_t appId, uint32_t index, double rms, const std::string &measurement)
{
    std::string query =
        "INSERT INTO rms_voltage (time, app_id, phase, rms_value) "
        "VALUES (NOW(), $1, $2, $3, $4);";

    pqxx::work txn(dbConn);
    txn.exec_params(query, std::to_string(appId), index, rms, measurement);
    txn.commit();
}
