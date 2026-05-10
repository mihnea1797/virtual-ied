#include "GoosePublisherWrapper.hpp"
#include <fstream>

GoosePublisherWrapper::GoosePublisherWrapper(const nlohmann::json &settings)
{
    for (const auto &entry : settings)
    {
        _connections.push_back(createConnection(entry));
    }
}

GooseConnection GoosePublisherWrapper::createConnection(const nlohmann::json &settings)
{
    GooseConnection conn;

    uint16_t    appId           = settings.at("appId").get<uint16_t>();
    std::string goId            = settings.at("goId").get<std::string>();
    std::string goCbRef         = settings.at("goCb").get<std::string>();
    uint32_t    timeAllowedToLive = settings.at("timeAllowedToLive").get<uint32_t>();
    std::string dataSetRef      = settings.at("dataSetRef").get<std::string>();
    uint32_t    confRev         = settings.at("confRev").get<uint32_t>();

    const auto &rSessionSettings = settings.at("rSessionSettings");
    std::string remoteAddress   = rSessionSettings.at("remoteAddress").get<std::string>();
    int         remotePort      = rSessionSettings.at("remotePort").get<int>();
    std::string localAddress    = rSessionSettings.value("localAddress", "");
    int         localPort       = rSessionSettings.value("localPort", -1);
    int         activeKeyId     = rSessionSettings.value("activeKeyId", 0);

    conn.rSession = RSession_create();
    if (!conn.rSession)
    {
        printf("Failed to create RSession for rGOOSE publisher (appId %u)\n", appId);
        return conn;
    }

    RSession_setRemoteAddress(conn.rSession, remoteAddress.c_str(), remotePort);
    if (!localAddress.empty())
    {
        RSession_setLocalAddress(conn.rSession, localAddress.c_str(), localPort);
    }

    for (const auto &keyJson : rSessionSettings.at("keys"))
    {
        int         id      = keyJson.at("id").get<int>();
        std::string key     = keyJson.at("key").get<std::string>();
        std::string secStr  = keyJson.at("secAlgo").get<std::string>();
        std::string sigStr  = keyJson.at("sigAlgo").get<std::string>();

        RSecurityAlgorithm secAlgo = R_SESSION_SEC_ALGO_AES_128_GCM;
        if (secStr == "AES_256_GCM")  secAlgo = R_SESSION_SEC_ALGO_AES_256_GCM;
        else if (secStr == "NONE")    secAlgo = R_SESSION_SEC_ALGO_NONE;

        RSignatureAlgorithm sigAlgo = R_SESSION_SIG_ALGO_NONE;
        if (sigStr == "HMAC_SHA256_80") sigAlgo = R_SESSION_SIG_ALGO_HMAC_SHA256_80;

        RSession_addKey(conn.rSession, id, (uint8_t *)key.c_str(), key.length(), secAlgo, sigAlgo);
    }

    if (activeKeyId > 0)
    {
        RSession_setActiveKey(conn.rSession, activeKeyId);
    }

    conn.publisher = GoosePublisher_createRemote(conn.rSession, appId);
    if (conn.publisher)
    {
        GoosePublisher_setGoCbRef(conn.publisher, const_cast<char *>(goCbRef.c_str()));
        GoosePublisher_setGoID(conn.publisher, const_cast<char *>(goId.c_str()));
        GoosePublisher_setDataSetRef(conn.publisher, const_cast<char *>(dataSetRef.c_str()));
        GoosePublisher_setConfRev(conn.publisher, confRev);
        GoosePublisher_setTimeAllowedToLive(conn.publisher, timeAllowedToLive);
    }
    else
    {
        printf("Failed to create GoosePublisher for appId %u\n", appId);
    }

    return conn;
}

GoosePublisherWrapper::~GoosePublisherWrapper()
{
    for (auto &conn : _connections)
    {
        if (conn.publisher) GoosePublisher_destroy(conn.publisher);
        if (conn.rSession)  RSession_destroy(conn.rSession);
    }
}

void GoosePublisherWrapper::PublishMessage(bool value)
{
    LinkedList dataSetValues = LinkedList_create();
    LinkedList_add(dataSetValues, MmsValue_newBoolean(value));
    LinkedList_add(dataSetValues, MmsValue_newBitString(23));

    for (auto &conn : _connections)
    {
        if (!conn.publisher) continue;
        GoosePublisher_increaseStNum(conn.publisher);
        GoosePublisher_publish(conn.publisher, dataSetValues);
    }

    LinkedList_destroyDeep(dataSetValues, (LinkedListValueDeleteFunction)MmsValue_delete);

    if (value)
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
        outputFile << "  Destinations: " << _connections.size() << "\n";
        outputFile.close();
    }
}


