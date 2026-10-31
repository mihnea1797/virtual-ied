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
#include <chrono>
#include <cstdint>
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

// Per-stream reception stats — updated in the SV listener callback, one per appId.
// Counters are cumulative (a reader takes deltas between snapshots); the win* maxima
// reset at every PrintStats() call, so a reader takes max() over the windows it spans.
struct StreamStats
{
    uint64_t received    = 0;
    uint64_t lost        = 0;  // samples skipped, inferred from smpCnt gaps
    uint64_t duplicates  = 0;
    int32_t  lastSmpCnt  = -1;
    bool     haveLastArr = false;
    std::chrono::steady_clock::time_point firstArr{};
    std::chrono::steady_clock::time_point lastArr{};
    double   jitterSumMs = 0.0; // sum of inter-arrival gaps (for mean)
    double   jitterMaxMs = 0.0; // worst inter-arrival gap seen (since start)
    uint64_t jitterN     = 0;
    uint64_t stalls5ms   = 0;  // inter-arrival gaps > 5 ms (delivery stall)
    uint64_t dark16ms    = 0;  // inter-arrival gaps > 16 ms ("network darkness")
    // one-way delay: arrival wall-clock minus the publisher's RefrTm stamp (shared host clock)
    double   owdSumMs    = 0.0;
    uint64_t owdN        = 0;
    // per-print-window maxima (reset each PrintStats)
    double   winJitterMaxMs = 0.0;
    double   winOwdMaxMs    = 0.0;
    // windowing for a live (per-print) rate, used as the liveness signal
    uint64_t lastPrintReceived = 0;
    std::chrono::steady_clock::time_point lastPrintTime{};
};

struct ListenerParameters
{
    uint16_t appId;
    double voltageThreshold;
    double currentThreshold;
    std::function<void(uint16_t, bool)> goosePublishMessageFunction; // (appId, above); owned; heap-stable via unique_ptr
    StreamState state;
    pqxx::connection *dbConn = nullptr;                   // non-owning
    std::string svID;                                    // captured from first ASDU
    StreamStats stats;
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
    void addStream(const nlohmann::json &streamConfig, std::function<void(uint16_t, bool)> publishFn);

    void setPostgresConnection(const nlohmann::json &postgresSqlProperties);

    void Start();
    void Print();
    void PrintStats(); // per-stream rx/rate/loss/jitter snapshot (call periodically)
};
