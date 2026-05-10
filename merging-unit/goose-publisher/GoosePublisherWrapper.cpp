#include "GoosePublisherWrapper.hpp"
#include <fstream>

GoosePublisherWrapper::GoosePublisherWrapper(const nlohmann::json &settings)
{
    ParseSettings(settings);

    _rSession = RSession_create();
    if (_rSession)
    {
        RSession_setRemoteAddress(_rSession, _remoteAddress.c_str(), _remotePort);

        if (!_localAddress.empty())
        {
            RSession_setLocalAddress(_rSession, _localAddress.c_str(), _localPort);
        }

        for (const auto &key : _keys)
        {
            RSecurityAlgorithm secAlgo = R_SESSION_SEC_ALGO_AES_128_GCM;
            if (key.secAlgo == "AES_256_GCM")
                secAlgo = R_SESSION_SEC_ALGO_AES_256_GCM;
            else if (key.secAlgo == "NONE")
                secAlgo = R_SESSION_SEC_ALGO_NONE;

            RSignatureAlgorithm sigAlgo = R_SESSION_SIG_ALGO_NONE;
            if (key.sigAlgo == "HMAC_SHA256_80")
                sigAlgo = R_SESSION_SIG_ALGO_HMAC_SHA256_80;

            RSession_addKey(_rSession, key.id, (uint8_t *)key.key.c_str(), key.key.length(), secAlgo, sigAlgo);
        }

        if (_activeKeyId > 0)
        {
            RSession_setActiveKey(_rSession, _activeKeyId);
        }

        _publisher = GoosePublisher_createRemote(_rSession, _appId);
        if (_publisher != NULL)
        {
            GoosePublisher_setGoCbRef(_publisher, const_cast<char *>(_goCbRef.c_str()));
            GoosePublisher_setGoID(_publisher, const_cast<char *>(_goId.c_str()));
            GoosePublisher_setDataSetRef(_publisher, const_cast<char *>(_dataSetRef.c_str()));
            GoosePublisher_setConfRev(_publisher, _confRev);
            GoosePublisher_setTimeAllowedToLive(_publisher, _timeAllowedToLive);
        }
    }
    else
    {
        printf("Failed to create RSession for rGOOSE publisher\n");
        _publisher = NULL;
    }
}

GoosePublisherWrapper::~GoosePublisherWrapper()
{
    GoosePublisher_destroy(_publisher);
    if (_rSession)
    {
        RSession_destroy(_rSession);
    }
}

void GoosePublisherWrapper::PublishMessage(bool value)
{
    LinkedList dataSetValues = LinkedList_create();

    // Add values to the GOOSE data set
    LinkedList_add(dataSetValues, MmsValue_newBoolean(value)); // example value
    LinkedList_add(dataSetValues, MmsValue_newBitString(23));  // example quality

    GoosePublisher_increaseStNum(_publisher);

    GoosePublisher_publish(_publisher, dataSetValues);

    LinkedList_destroyDeep(dataSetValues, (LinkedListValueDeleteFunction)MmsValue_delete);

    if(value)
    {
        printf("GOOSE message published due to threshold breach\n");
    }
}

void GoosePublisherWrapper::Print()
{
    std::ofstream outputFile("output-goose.txt");
    if (outputFile.is_open())
    {
        outputFile << "GoosePublisherWrapper Configuration (rGOOSE):\n";
        outputFile << "  GoID: " << _goId << "\n";
        outputFile << "  GoCbRef: " << _goCbRef << "\n";
        outputFile << "  TimeAllowedToLive: " << _timeAllowedToLive << "\n";
        outputFile << "  DataSetRef: " << _dataSetRef << "\n";
        outputFile << "  ConfRev: " << _confRev << "\n";
        outputFile << "  AppId: " << _appId << "\n";
        outputFile << "  RemoteAddress: " << _remoteAddress << "\n";
        outputFile << "  RemotePort: " << _remotePort << "\n";
        outputFile.close();
    }
}

void GoosePublisherWrapper::ParseSettings(const nlohmann::json &settings)
{
    _appId = settings.at("appId").get<uint16_t>();
    _goId = settings.at("goId").get<std::string>();
    _goCbRef = settings.at("goCb").get<std::string>();
    _timeAllowedToLive = settings.at("timeAllowedToLive").get<uint32_t>();
    _dataSetRef = settings.at("dataSetRef").get<std::string>();
    _confRev = settings.at("confRev").get<uint32_t>();
    _simulation = settings.value("simulation", false);
    _ndsCom = settings.value("ndsCom", false);

    const auto &rSessionSettings = settings.at("rSessionSettings");
    _remoteAddress = rSessionSettings.at("remoteAddress").get<std::string>();
    _remotePort = rSessionSettings.at("remotePort").get<int>();
    _localAddress = rSessionSettings.value("localAddress", "");
    _localPort = rSessionSettings.value("localPort", -1);
    _activeKeyId = rSessionSettings.value("activeKeyId", 0);

    for (const auto &keyJson : rSessionSettings.at("keys"))
    {
        GooseRSessionKey key;
        key.id = keyJson.at("id").get<int>();
        key.key = keyJson.at("key").get<std::string>();
        key.secAlgo = keyJson.at("secAlgo").get<std::string>();
        key.sigAlgo = keyJson.at("sigAlgo").get<std::string>();
        _keys.push_back(key);
    }
}
