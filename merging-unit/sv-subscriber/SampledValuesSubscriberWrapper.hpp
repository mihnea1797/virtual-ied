extern "C"
{
#include <sv_subscriber.h>
}

#include <string>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>
#include <fstream>
#include <vector>
#include "RmsComputationObject.hpp"
#include "ButterworthFilter.hpp"
#include "FrequencyTracking.hpp"
#include <pqxx/pqxx>

// Enum describing the possible formats of SV data
enum class DataFormat
{
    onlyV,
    onlyI,
    clusterVI,
    clusterIV,
    pairVI,
    pairIV
};

struct RSessionKey
{
    int id;
    std::string key;
    std::string secAlgo;
    std::string sigAlgo;
};

// Per-stream processing state — one instance per subscribed appId
struct StreamState
{
    std::vector<RmsComputationObject> voltageRmsObject;
    std::vector<RmsComputationObject> currentRmsObject;
    std::vector<ButterworthFilter>    voltageButterFilter;
    std::vector<ButterworthFilter>    currentButterFilter;
    std::vector<FrequencyTracking>    voltageFrequencyTracker;
    std::vector<FrequencyTracking>    currentFrequencyTracker;
    DataFormat format        = DataFormat::pairVI;
    uint8_t    numberOfPhases = 4;
};

struct ListenerParameters
{
    uint16_t appId;
    double voltageThreshold;
    double currentThreshold;
    std::function<void(bool)> goosePublishMessageFunction; // owned; heap-stable via unique_ptr
    StreamState state;
    pqxx::connection *dbConn = nullptr;                   // non-owning
};

class SampledValuesSubscriberWrapper
{
private:
    SVReceiver _receiver;
    RSession   _rSession = nullptr;

    std::string              _interface;
    bool                     _destAddrCheck;
    std::string              _localAddress;
    int                      _port = 0;
    std::vector<std::string> _multicastGroups;
    std::vector<RSessionKey> _keys;

    std::unique_ptr<pqxx::connection>              _dbConn;
    std::vector<SVSubscriber>                      _subscribers;
    std::vector<std::unique_ptr<ListenerParameters>> _listenerParams;

    void ParseReceiverSettings(const nlohmann::json &settings);

    static std::string ParsePostgresSQL(const nlohmann::json &postgresSqlProperties);
    static bool parseSVData(std::vector<int32_t> &voltageMeasurements, std::vector<int32_t> &currentMeasurements, const SVSubscriber_ASDU &asdu, DataFormat format);
    static void storeRMSinDatabase(pqxx::connection &dbConn, uint16_t appId, uint32_t index, double rms, const std::string &measurement);
    static void SvUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu);

public:
    SampledValuesSubscriberWrapper(const nlohmann::json &receiverSettings);
    ~SampledValuesSubscriberWrapper();

    // Add one data stream: creates an SVSubscriber for the given appId and registers its listener
    void addStream(const nlohmann::json &streamConfig, std::function<void(bool)> publishFn);

    void setPostgresConnection(const nlohmann::json &postgresSqlProperties);

    void Start();
    void Print();
};
