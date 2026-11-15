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

void SampledValuesSubscriberWrapper::addStream(const nlohmann::json &streamConfig, std::function<void(uint16_t, bool)> publishFn)
{
    auto params = std::make_unique<ListenerParameters>();
    params->appId             = streamConfig.at("appId").get<uint16_t>();
    params->voltageThreshold  = streamConfig.at("threshold").get<double>();
    params->currentThreshold  = streamConfig.at("threshold").get<double>();
    params->goosePublishMessageFunction = std::move(publishFn);
    // Optional: the publisher's smpCnt wrap. Default = libiec61850 SVPublisher (counts 0..65534).
    params->seq = SmpCntTracker(streamConfig.value("smpCntModulus", 65535u));

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

    // ---- per-stream stats (before any parse; every received ASDU counts) ----
    {
        // PrintStats (main thread) snapshots and resets these every 2 s: one lock for the block.
        std::lock_guard<std::mutex> lk(params->statsLock);
        StreamStats &S = params->stats;
        uint16_t smpCnt = SVSubscriber_ASDU_getSmpCnt(asdu);
        if (S.received == 0)
        {
            S.firstArr = sampleTimeStamp;
            if (svID) params->svID = svID;
        }
        S.received++;
        params->seq.observe(smpCnt, S.lost, S.reordered, S.duplicates);
        if (S.haveLastArr)
        {
            double gapMs = std::chrono::duration<double, std::milli>(sampleTimeStamp - S.lastArr).count();
            S.jitterSumMs += gapMs;
            S.jitterN++;
            if (gapMs > S.jitterMaxMs)    S.jitterMaxMs = gapMs;
            if (gapMs > S.winJitterMaxMs) S.winJitterMaxMs = gapMs;
            if (gapMs > 5.0)  S.stalls5ms++;
            if (gapMs > 16.0) S.dark16ms++;   // network-darkness bound (protection blind)
        }
        S.lastArr = sampleTimeStamp;
        S.haveLastArr = true;

        // One-way delay from the publisher's RefrTm stamp (wall clock, shared host kernel).
        if (SVSubscriber_ASDU_hasRefrTm(asdu))
        {
            uint64_t refrMs = SVSubscriber_ASDU_getRefrTmAsMs(asdu);
            if (refrMs > 0)
            {
                auto nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count();
                double owd = static_cast<double>(nowMs) - static_cast<double>(refrMs);
                if (owd >= 0.0 && owd < 10000.0) // discard clock nonsense
                {
                    S.owdSumMs += owd;
                    S.owdN++;
                    if (owd > S.winOwdMaxMs) S.winOwdMaxMs = owd;
                }
            }
        }
    }

    std::vector<int32_t> voltageMeasurements;
    std::vector<int32_t> currentMeasurements;

    if (parseSVData(voltageMeasurements, currentMeasurements, asdu, params->state.format))
    {
        // Aggregate the threshold STATE across all phases of this ASDU and report it
        // once per sample (below). The debounced GOOSE publisher turns the state stream
        // into change-only transitions (true->false->true across runs). Publishing only
        // on breach latched the publisher's last value to 'true' forever, so a re-armed
        // run's breach was a true->true no-op and no GOOSE was ever sent again.
        bool anyAboveThreshold = false;

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

                if (rms > params->voltageThreshold)
                    anyAboveThreshold = true;

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

                if (rms > params->currentThreshold)
                    anyAboveThreshold = true;

                // double estimatedFrequency = params->state.currentFrequencyTracker[index].frequencyEstimation(filteredValue, sampleTimeStamp);
                // double estimatedFrequency = params->state.currentFrequencyTracker[index].frequencyEstimation(currentMeasurements[index], sampleTimeStamp);
            }
        }

        // Report the aggregated threshold state once per sample; the publisher's
        // state-change debounce turns this into transition-only GOOSE.
        if (params->goosePublishMessageFunction)
            params->goosePublishMessageFunction(params->appId, anyAboveThreshold);
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

// Per-stream health snapshot. 'rate' is windowed (samples since last call), so it drops
// to 0 if a stream stalls — the liveness signal a run can gate on. Besides the human
// stdout line, each snapshot appends one JSON line per stream to /tmp/mu-stats.jsonl:
// cumulative counters (reader takes deltas between snapshots) plus window maxima
// win_jmax/win_owdmax (reset here each call; reader takes max over spanned windows).
void SampledValuesSubscriberWrapper::PrintStats()
{
    auto now = std::chrono::steady_clock::now();
    auto epochMs = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();

    std::ofstream jsonl("/tmp/mu-stats.jsonl", std::ios::app);

    printf("---- R-SV per-stream stats ----\n");
    for (auto &p : _listenerParams)
    {
        // Snapshot and window reset in ONE critical section. The receive thread updates these on
        // every sample; with a separate read and reset, a maximum written in between was erased
        // (and every unsynchronised read was a data race).
        StreamStats S;
        std::string svID;
        {
            std::lock_guard<std::mutex> lk(p->statsLock);
            S    = p->stats;
            svID = p->svID;
            p->stats.winJitterMaxMs    = 0.0;
            p->stats.winOwdMaxMs       = 0.0;
            p->stats.lastPrintReceived = S.received;
            p->stats.lastPrintTime     = now;
        }

        double winRate = 0.0;
        if (S.lastPrintTime.time_since_epoch().count() != 0)
        {
            double dt = std::chrono::duration<double>(now - S.lastPrintTime).count();
            if (dt > 0.0) winRate = static_cast<double>(S.received - S.lastPrintReceived) / dt;
        }

        double jmean = (S.jitterN > 0) ? (S.jitterSumMs / static_cast<double>(S.jitterN)) : 0.0;
        double owdMean = (S.owdN > 0) ? (S.owdSumMs / static_cast<double>(S.owdN)) : 0.0;
        uint64_t expected = S.received + S.lost;
        double lossPct = (expected > 0) ? 100.0 * static_cast<double>(S.lost) / static_cast<double>(expected) : 0.0;

        printf("  appId=0x%04X svID=%-8s rx=%llu rate=%.0f sa/s loss=%llu(%.2f%%) reord=%llu dup=%llu "
               "jit mean=%.3fms max=%.3fms stalls>5ms=%llu dark>16ms=%llu owd mean=%.1fms winmax=%.1fms\n",
               p->appId, svID.c_str(),
               static_cast<unsigned long long>(S.received), winRate,
               static_cast<unsigned long long>(S.lost), lossPct,
               static_cast<unsigned long long>(S.reordered),
               static_cast<unsigned long long>(S.duplicates), jmean, S.jitterMaxMs,
               static_cast<unsigned long long>(S.stalls5ms),
               static_cast<unsigned long long>(S.dark16ms), owdMean, S.winOwdMaxMs);

        if (jsonl.is_open())
        {
            jsonl << "{\"ts_ms\":" << epochMs
                  << ",\"appid\":" << p->appId
                  << ",\"svid\":\"" << svID << "\""
                  << ",\"rx\":" << S.received
                  << ",\"rate\":" << winRate
                  << ",\"lost\":" << S.lost
                  << ",\"reordered\":" << S.reordered
                  << ",\"dup\":" << S.duplicates
                  << ",\"jit_sum_ms\":" << S.jitterSumMs
                  << ",\"jit_n\":" << S.jitterN
                  << ",\"win_jmax_ms\":" << S.winJitterMaxMs
                  << ",\"stalls_5ms\":" << S.stalls5ms
                  << ",\"dark_16ms\":" << S.dark16ms
                  << ",\"owd_sum_ms\":" << S.owdSumMs
                  << ",\"owd_n\":" << S.owdN
                  << ",\"win_owdmax_ms\":" << S.winOwdMaxMs
                  << "}\n";
        }
    }
    fflush(stdout);
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
